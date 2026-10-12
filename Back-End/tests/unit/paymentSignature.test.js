require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const demo = require("../../services/payments/demoPaymentProvider");
const custody = require("../../services/custody/demoCustody");
const { sign: signPayload, verifySignature, chargeInstant } = demo;

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
    test("instant charges are clearly marked demo", async () => {
        const result = await chargeInstant({ amount: "10.00", currency: "USD", method: "card" });
        assert.equal(result.success, true);
        assert.equal(result.demo, true);
        assert.match(result.providerReference, /^DEMO-[0-9A-F]{16}$/);
    });

    test("references are unique", async () => {
        const refs = new Set();
        for (let i = 0; i < 200; i++) refs.add((await chargeInstant({ amount: "1.00", currency: "USD", method: "card" })).providerReference);
        assert.equal(refs.size, 200);
    });

    test("bank-transfer instructions never contain a bank account", async () => {
        const { instructions } = await demo.createDeposit({ reference: "DEP-T", amount: "100.00", currency: "ZAR", method: "bank", webhookUrl: "http://127.0.0.1:9/none" });
        assert.equal(instructions.demo, true);
        assert.equal(instructions.reference, "DEP-T");
        assert.equal(JSON.stringify(instructions).match(/account\s*number|\b\d{9,}\b/i), null);
        demo.controls.reset();
    });
});

describe("demo custody", () => {
    test("custody webhooks use their own signature, and demo tx hashes are unmistakable", async () => {
        const body = '{"x":1}';
        assert.equal(custody.verifySignature(body, custody.sign(body)), true);
        assert.equal(custody.verifySignature(body, signPayload(body)), false, "a payment-provider signature must not pass as custody");
        const address = await custody.getDepositAddress({ userId: 1, asset: "BTC", network: "BTC" });
        assert.ok(address.address.startsWith("bc1q"));
    });
});
