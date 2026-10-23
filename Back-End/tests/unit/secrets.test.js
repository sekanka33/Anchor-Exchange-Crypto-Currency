require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { readSecret, beneficiaryKeys } = require("../../config/secrets");
const demoPayments = require("../../services/payments/demoPaymentProvider");
const demoCustody = require("../../services/custody/demoCustody");
const { generateDepositAddress } = require("../../services/cryptoDepositService");

// Runs fn with a modified environment, then restores it exactly.
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

describe("secrets fail closed in production", () => {
    for (const name of ["PAYMENT_WEBHOOK_SECRET", "CUSTODY_WEBHOOK_SECRET", "CRYPTO_ADDRESS_SECRET"]) {
        test(`missing ${name} in production throws a generic 503 that names the variable only server-side`, () => {
            assert.throws(() => readSecret(name, { NODE_ENV: "production" }), (error) => {
                assert.equal(error.status, 503);
                assert.equal(error.secret, name);
                assert.doesNotMatch(error.message, new RegExp(name));
                return true;
            });
        });
    }

    test("a published development value is refused in production", () => {
        assert.throws(() => readSecret("PAYMENT_WEBHOOK_SECRET", { NODE_ENV: "production", PAYMENT_WEBHOOK_SECRET: "demo-webhook-secret-do-not-use-in-production" }));
    });

    test("outside production a missing secret falls back to a clearly labelled development value", () => {
        assert.match(readSecret("CUSTODY_WEBHOOK_SECRET", { NODE_ENV: "development" }), /do-not-use-in-production/);
    });

    test("the demo adapters can't sign or verify in production without their own secret", () => {
        withEnv({ NODE_ENV: "production", PAYMENT_WEBHOOK_SECRET: undefined }, () => {
            assert.throws(() => demoPayments.sign("{}"), { status: 503 });
            assert.throws(() => demoPayments.verifySignature("{}", "0".repeat(64)), { status: 503 });
        });
        withEnv({ NODE_ENV: "production", CUSTODY_WEBHOOK_SECRET: undefined }, () => {
            assert.throws(() => demoCustody.sign("{}"), { status: 503 }, "never falls back to CRYPTO_ADDRESS_SECRET");
        });
        withEnv({ NODE_ENV: "production", CRYPTO_ADDRESS_SECRET: undefined }, () => {
            assert.throws(() => generateDepositAddress(1, "BTC", "BTC"), { status: 503 });
        });
    });

    test("custody signatures depend only on CUSTODY_WEBHOOK_SECRET", () => {
        const body = '{"id":"e"}';
        const before = demoCustody.sign(body);
        withEnv({ CRYPTO_ADDRESS_SECRET: crypto.randomBytes(32).toString("hex") }, () => {
            assert.equal(demoCustody.sign(body), before);
        });
    });

    test("beneficiary keys: missing in production or malformed anywhere is refused", () => {
        assert.throws(() => beneficiaryKeys({ NODE_ENV: "production" }), { status: 503 });
        assert.throws(() => beneficiaryKeys({ NODE_ENV: "development", BENEFICIARY_ENCRYPTION_KEY: "too-short" }), { status: 503 });
        assert.throws(() => beneficiaryKeys({ BENEFICIARY_ENCRYPTION_KEY: "ab".repeat(32), BENEFICIARY_ENCRYPTION_KEY_PREVIOUS: "bad" }), { status: 503 });
        assert.equal(beneficiaryKeys({ BENEFICIARY_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64") }).current.length, 32);
    });
});

describe("demo crypto addresses", () => {
    test("are deterministic per user/asset/network and change only with CRYPTO_ADDRESS_SECRET", () => {
        const a = generateDepositAddress(7, "BTC", "BTC").address;
        assert.equal(generateDepositAddress(7, "BTC", "BTC").address, a);
        assert.notEqual(generateDepositAddress(8, "BTC", "BTC").address, a);
        withEnv({ CRYPTO_ADDRESS_SECRET: crypto.randomBytes(32).toString("hex") }, () => {
            assert.notEqual(generateDepositAddress(7, "BTC", "BTC").address, a, "new secret, new addresses (stored ones are kept in the DB)");
        });
    });
});
