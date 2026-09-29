const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

const webhook = (payload, { signature, sign = true } = {}) => {
    const signed = h.signWebhook(payload);
    return h.api("POST", "/api/webhooks/payments", {
        raw: signed.body,
        headers: { "Content-Type": "application/json", ...(sign ? { "X-Webhook-Signature": signature ?? signed.signature } : {}) }
    });
};

const createPendingDeposit = async (user, amount = 100, paymentMethod = "card") => {
    const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount, paymentMethod } });
    assert.equal(res.status, 201);
    return res.body.deposit;
};

describe("fiat deposits", () => {
    test("creating a deposit does NOT credit the wallet; only the webhook does", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user);

        assert.equal(deposit.status, "PENDING");
        assert.equal(Number(deposit.fee), 1.5, "card deposits carry a 1.5% fee");
        assert.equal(Number(deposit.net_amount), 98.5);
        assert.equal((await h.balance(user.id, "USD")).available, 0, "not credited at initiation");
    });

    test("the simulated provider callback completes the deposit and credits net amount", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user, 200, "bank");

        await h.waitFor(async () => (await h.balance(user.id, "USD")).available === 200, { message: "wallet credit via demo webhook" });

        const status = await h.api("GET", `/api/deposits/${deposit.id}`, { token: user.token });
        assert.equal(status.body.deposit.status, "COMPLETED");
        assert.equal((await h.pool.query("SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'DEPOSIT'", [user.id])).rowCount, 1);
    });

    test("forceFail leads to FAILED with no balance change", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount: 100, paymentMethod: "card", forceFail: true } });

        await h.waitFor(async () => (await h.api("GET", `/api/deposits/${res.body.deposit.id}`, { token: user.token })).body.deposit.status === "FAILED", { message: "FAILED status" });
        assert.equal((await h.balance(user.id, "USD")).available, 0);
    });

    for (const [name, body] of [
        ["below minimum", { amount: 9, paymentMethod: "card" }],
        ["above maximum", { amount: 10001, paymentMethod: "card" }],
        ["negative", { amount: -5, paymentMethod: "card" }],
        ["non-numeric", { amount: "x", paymentMethod: "card" }],
        ["bad payment method", { amount: 100, paymentMethod: "cash" }]
    ]) {
        test(`rejects ${name} with 400`, async () => {
            const user = await h.createUser();
            const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body });
            assert.equal(res.status, 400);
        });
    }

    test("deposit status is private to its owner", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        const deposit = await createPendingDeposit(alice);

        assert.equal((await h.api("GET", `/api/deposits/${deposit.id}`, { token: bob.token })).status, 404);
        assert.equal((await h.api("GET", "/api/deposits", { token: bob.token })).body.deposits.length, 0);
    });
});

describe("payment webhook security", () => {
    test("rejects a missing signature", async () => {
        const res = await webhook({ reference: "X", status: "completed" }, { sign: false });
        assert.equal(res.status, 401);
    });

    test("rejects a wrong signature and does not credit", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user);
        const res = await webhook({ reference: deposit.provider_reference, status: "completed" }, { signature: "0".repeat(64) });

        assert.equal(res.status, 401);
        assert.equal((await h.balance(user.id, "USD")).available, 0);
    });

    test("rejects a signature computed over a different body (tampering)", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user);
        const good = h.signWebhook({ reference: deposit.provider_reference, status: "failed" });
        const res = await webhook({ reference: deposit.provider_reference, status: "completed" }, { signature: good.signature });
        assert.equal(res.status, 401);
    });

    test("a correctly signed replay is an idempotent no-op (no double credit)", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user, 100, "bank");
        await h.waitFor(async () => (await h.balance(user.id, "USD")).available === 100, { message: "first credit" });

        const replay1 = await webhook({ reference: deposit.provider_reference, status: "completed" });
        const replay2 = await webhook({ reference: deposit.provider_reference, status: "completed" });

        assert.equal(replay1.status, 200);
        assert.equal(replay2.status, 200);
        assert.equal((await h.balance(user.id, "USD")).available, 100);
        assert.equal((await h.pool.query("SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'DEPOSIT'", [user.id])).rowCount, 1);
    });

    test("concurrent duplicate webhooks credit exactly once", async () => {
        const user = await h.createUser();
        // Insert directly so the demo provider's own callback can't race the test.
        const ref = `TESTREF-${Date.now()}`;
        await h.pool.query(
            `INSERT INTO deposits(user_id, type, asset, amount, fee, net_amount, payment_method, status, provider_reference)
             VALUES($1, 'FIAT', 'USD', 100, 0, 100, 'bank', 'PENDING', $2)`, [user.id, ref]
        );

        const results = await Promise.all(Array.from({ length: 6 }, () => webhook({ reference: ref, status: "completed" })));

        assert.ok(results.every((r) => r.status === 200));
        assert.equal((await h.balance(user.id, "USD")).available, 100);
    });

    test("unknown reference -> 404; malformed payload -> 400", async () => {
        assert.equal((await webhook({ reference: "NOPE", status: "completed" })).status, 404);
        assert.equal((await webhook({ status: "completed" })).status, 400);
        assert.equal((await webhook({ reference: "X", status: "bogus" })).status, 400);
    });

    test("a failed webhook after a completed one cannot reverse or re-fail the deposit", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user, 100, "bank");
        await h.waitFor(async () => (await h.balance(user.id, "USD")).available === 100, { message: "credit" });

        await webhook({ reference: deposit.provider_reference, status: "failed" });

        assert.equal((await h.balance(user.id, "USD")).available, 100);
        assert.equal((await h.api("GET", `/api/deposits/${deposit.id}`, { token: user.token })).body.deposit.status, "COMPLETED");
    });
});

describe("crypto deposits (demo)", () => {
    test("address is stable per user/asset/network, distinct across users, and flagged demo", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        const q = "/api/deposits/crypto/address?asset=BTC&network=BTC";

        const a1 = await h.api("GET", q, { token: alice.token });
        const a2 = await h.api("GET", q, { token: alice.token });
        const b1 = await h.api("GET", q, { token: bob.token });

        assert.equal(a1.status, 200);
        assert.equal(a1.body.demo, true);
        assert.ok(a1.body.warning);
        assert.equal(a1.body.address, a2.body.address);
        assert.notEqual(a1.body.address, b1.body.address);
    });

    test("rejects unsupported asset / wrong network for asset", async () => {
        const user = await h.createUser();
        assert.equal((await h.api("GET", "/api/deposits/crypto/address?asset=SHIB&network=BTC", { token: user.token })).status, 400);
        assert.equal((await h.api("GET", "/api/deposits/crypto/address?asset=BTC&network=ERC20", { token: user.token })).status, 400);
    });

    test("simulated deposit needs an address first, enforces the minimum, then confirms and credits exactly once", async () => {
        const user = await h.createUser();
        const body = { asset: "BTC", network: "BTC", amount: 0.5 };

        assert.equal((await h.api("POST", "/api/deposits/crypto/simulate", { token: user.token, body })).status, 400, "no address yet");

        await h.api("GET", "/api/deposits/crypto/address?asset=BTC&network=BTC", { token: user.token });

        assert.equal((await h.api("POST", "/api/deposits/crypto/simulate", { token: user.token, body: { ...body, amount: 0.00001 } })).status, 400, "below minimum");
        assert.equal((await h.api("POST", "/api/deposits/crypto/simulate", { token: user.token, body: { ...body, amount: -1 } })).status, 400);

        const sim = await h.api("POST", "/api/deposits/crypto/simulate", { token: user.token, body });
        assert.equal(sim.status, 201);
        assert.equal(sim.body.demo, true);
        assert.equal((await h.balance(user.id, "BTC")).available, 0, "not credited before confirmations");

        await h.waitFor(async () => (await h.balance(user.id, "BTC")).available === 0.5, { timeout: 12000, message: "crypto deposit credit" });
        const done = await h.api("GET", `/api/deposits/${sim.body.deposit.id}`, { token: user.token });
        assert.equal(done.body.deposit.status, "COMPLETED");
        assert.equal(done.body.deposit.confirmations, done.body.deposit.required_confirmations);

        await new Promise((r) => setTimeout(r, 2500));
        assert.equal((await h.balance(user.id, "BTC")).available, 0.5, "no double credit after extra ticks");
    });

    test("GET /api/deposits unifies fiat and crypto rows for the user", async () => {
        const user = await h.createUser();
        await createPendingDeposit(user);
        await h.api("GET", "/api/deposits/crypto/address?asset=ETH&network=ERC20", { token: user.token });
        await h.api("POST", "/api/deposits/crypto/simulate", { token: user.token, body: { asset: "ETH", network: "ERC20", amount: 1 } });

        const list = await h.api("GET", "/api/deposits", { token: user.token });
        const types = list.body.deposits.map((d) => d.type).sort();
        assert.deepEqual(types, ["CRYPTO", "FIAT"]);
    });
});
