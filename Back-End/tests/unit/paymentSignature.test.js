require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { signPayload, verifySignature, chargePaymentMethod } = require("../../services/paymentProviderService");

describe("webhook HMAC", () => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;

    test("signPayload is HMAC-SHA256 (hex) over the exact body", () => {
        const body = JSON.stringify({ reference: "R", status: "completed" });
        assert.equal(signPayload(body), crypto.createHmac("sha256", secret).update(body).digest("hex"));
    });

    test("an object and its JSON string sign identically", () => {
        const obj = { a: 1, b: "x" };
        assert.equal(signPayload(obj), signPayload(JSON.stringify(obj)));
    });

    test("verifySignature accepts the right signature", () => {
        const body = '{"reference":"R"}';
        assert.equal(verifySignature(body, signPayload(body)), true);
    });

    test("verifySignature rejects: wrong, empty, missing, truncated, longer, wrong-case, and tampered-body signatures", () => {
        const body = '{"reference":"R"}';
        const good = signPayload(body);

        assert.equal(verifySignature(body, "0".repeat(64)), false);
        assert.equal(verifySignature(body, ""), false);
        assert.equal(verifySignature(body, undefined), false);
        assert.equal(verifySignature(body, good.slice(0, 63)), false);
        assert.equal(verifySignature(body, good + "0"), false);
        assert.equal(verifySignature(body, good.toUpperCase()), false);
        assert.equal(verifySignature(body + " ", good), false, "one extra byte in the body must invalidate the signature");
    });

    test("verifySignature never throws on odd-length or non-hex signatures", () => {
        assert.doesNotThrow(() => verifySignature("x", "zz"));
        assert.doesNotThrow(() => verifySignature("x", "é".repeat(32)));
    });
});

describe("demo payment provider", () => {
    test("charges succeed only in demo mode and are clearly marked demo", async () => {
        const result = await chargePaymentMethod({ amount: 10, method: "card" });
        assert.equal(result.success, true);
        assert.equal(result.demo, true);
        assert.match(result.reference, /^DEMO-[0-9A-F]{16}$/);
    });

    test("references are unique", async () => {
        const refs = new Set();
        for (let i = 0; i < 200; i++) refs.add((await chargePaymentMethod({ amount: 1, method: "card" })).reference);
        assert.equal(refs.size, 200);
    });
});
