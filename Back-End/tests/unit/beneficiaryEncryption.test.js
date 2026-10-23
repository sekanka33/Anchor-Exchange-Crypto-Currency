require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const b = require("../../services/beneficiaries");

// Synthetic account numbers and random keys only.
const ACCOUNT = "62012345678";
const randomKey = () => crypto.randomBytes(32);

const withEnv = (overrides, fn) => {
    const saved = {};
    for (const key of Object.keys(overrides)) {
        saved[key] = process.env[key];
        if (overrides[key] === undefined) delete process.env[key]; else process.env[key] = overrides[key];
    }
    try {
        return fn();
    } finally {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    }
};

const flipByte = (b64) => {
    const buf = Buffer.from(b64, "base64");
    buf[0] ^= 0x01;
    return buf.toString("base64");
};

describe("beneficiary account-number encryption (AES-256-GCM)", () => {
    test("round-trips, never contains the plaintext, and uses a fresh IV each time", () => {
        const one = b.encrypt(ACCOUNT);
        const two = b.encrypt(ACCOUNT);
        assert.equal(b.decrypt(one), ACCOUNT);
        assert.ok(!one.includes(ACCOUNT));
        assert.notEqual(one, two, "random IV: same input, different ciphertext");
        const [version, iv, tag] = one.split(":");
        assert.equal(version, "v1");
        assert.equal(Buffer.from(iv, "base64").length, 12);
        assert.equal(Buffer.from(tag, "base64").length, 16);
    });

    test("tampered ciphertext, IV or tag is rejected with a generic error", () => {
        const [v, iv, tag, body] = b.encrypt(ACCOUNT).split(":");
        for (const tampered of [
            [v, iv, tag, flipByte(body)],
            [v, flipByte(iv), tag, body],
            [v, iv, flipByte(tag), body]
        ]) {
            assert.throws(() => b.decrypt(tampered.join(":")), (error) => {
                assert.equal(error.code, "BENEFICIARY_DECRYPT_FAILED");
                assert.ok(!error.message.includes(ACCOUNT));
                return true;
            });
        }
    });

    test("a truncated authentication tag is rejected (no short-tag forgery)", () => {
        const [v, iv, tag, body] = b.encrypt(ACCOUNT).split(":");
        const short = Buffer.from(tag, "base64").subarray(0, 4).toString("base64");
        assert.throws(() => b.decrypt([v, iv, short, body].join(":")), { code: "BENEFICIARY_DECRYPT_FAILED" });
    });

    test("malformed payloads and unknown versions fail safely", () => {
        for (const bad of ["", "v1", "v1:a:b", "v2:a:b:c", "not:base64:at:all", null, undefined]) {
            assert.throws(() => b.decrypt(bad), { code: "BENEFICIARY_DECRYPT_FAILED" }, String(bad));
        }
    });

    test("the wrong key cannot decrypt; nothing is stored in plaintext when encryption can't run", () => {
        const payload = b.encryptWith(randomKey(), ACCOUNT);
        assert.throws(() => b.decrypt(payload), { code: "BENEFICIARY_DECRYPT_FAILED" });
        assert.throws(() => b.encrypt(""), "empty input is refused rather than stored");
        withEnv({ NODE_ENV: "production", BENEFICIARY_ENCRYPTION_KEY: undefined }, () => {
            assert.throws(() => b.encrypt(ACCOUNT), { status: 503 });
        });
    });

    test("during a rotation, rows written under the previous key stay readable; new rows use the new key", () => {
        const oldKey = randomKey();
        const newKey = randomKey();
        const oldRow = b.encryptWith(oldKey, ACCOUNT);
        withEnv({ BENEFICIARY_ENCRYPTION_KEY: newKey.toString("hex"), BENEFICIARY_ENCRYPTION_KEY_PREVIOUS: oldKey.toString("hex") }, () => {
            assert.equal(b.decrypt(oldRow), ACCOUNT);
            assert.equal(b.decryptWith(newKey, b.encrypt(ACCOUNT)), ACCOUNT);
        });
        withEnv({ BENEFICIARY_ENCRYPTION_KEY: newKey.toString("hex"), BENEFICIARY_ENCRYPTION_KEY_PREVIOUS: undefined }, () => {
            assert.throws(() => b.decrypt(oldRow), { code: "BENEFICIARY_DECRYPT_FAILED" }, "without the previous key the old row is unreadable");
        });
    });
});

describe("beneficiary fingerprints", () => {
    test("use a key derived from (not equal to) the encryption key, and still recognise the original scheme", () => {
        const key = randomKey();
        const current = b.fingerprintWith(key, ACCOUNT);
        const legacy = crypto.createHmac("sha256", key).update(`account:${ACCOUNT}`).digest("hex");
        assert.notEqual(current, legacy);
        withEnv({ BENEFICIARY_ENCRYPTION_KEY: key.toString("hex") }, () => {
            assert.deepEqual(b.candidateFingerprints(ACCOUNT).slice(0, 2), [current, legacy]);
            assert.equal(b.fingerprint(ACCOUNT), current);
        });
    });
});

describe("masking", () => {
    test("API and withdrawal views expose only the last four digits", () => {
        const row = {
            id: 1, currency: "ZAR", label: null, account_holder: "Test", bank_name: "Bank", branch_code: "250655", account_type: "cheque",
            account_number_last4: ACCOUNT.slice(-4), account_number_encrypted: b.encrypt(ACCOUNT), account_fingerprint: "f", created_at: new Date()
        };
        for (const view of [b.mask(row), b.destinationSnapshot(row)]) {
            const json = JSON.stringify(view);
            assert.ok(!json.includes(ACCOUNT));
            assert.ok(!json.includes(row.account_number_encrypted), "ciphertext isn't exposed either");
            assert.equal(view.accountNumberMasked, "•••• 5678");
        }
        assert.equal(b.payoutDetails(row).accountNumber, ACCOUNT, "full number only for the payout call");
    });
});
