const { test, describe, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const h = require("../helpers/harness");
const demoPayments = require("../../services/payments/demoPaymentProvider");

before(h.start);
after(h.stop);
afterEach(() => demoPayments.controls.reset());

const createPendingDeposit = async (user, amount = 100, paymentMethod = "card", currency) => {
    const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount, paymentMethod, ...(currency ? { currency } : {}) } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.deposit;
};

// A PENDING deposit the demo provider will NOT call back for, so the test
// alone drives its webhooks.
const insertPendingDeposit = async (user, { amount = "100", asset = "USD", fee = "0" } = {}) => {
    const ref = `TESTREF-${crypto.randomBytes(6).toString("hex")}`;
    const net = (Number(amount) - Number(fee)).toFixed(2);
    const row = (await h.pool.query(
        `INSERT INTO deposits (user_id, type, asset, amount, fee, net_amount, payment_method, status, provider, provider_reference)
         VALUES ($1, 'FIAT', $2, $3, $4, $5, 'bank', 'PENDING', 'demo', $6) RETURNING id`,
        [user.id, asset, amount, fee, net, ref]
    )).rows[0];
    return { id: row.id, ref };
};

const depositStatus = async (user, id) => (await h.api("GET", `/api/deposits/${id}`, { token: user.token })).body.deposit;

describe("fiat deposits", () => {
    test("creating a deposit does NOT credit the wallet; only the verified provider callback does", async () => {
        demoPayments.controls.setNextPayout(null);
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user);

        assert.equal(deposit.status, "PENDING");
        assert.equal(deposit.asset, "USD", "no currency means USD (backwards compatible)");
        assert.equal(Number(deposit.fee), 1.5, "card deposits carry a 1.5% fee");
        assert.equal(Number(deposit.net_amount), 98.5);
        assert.equal((await h.balance(user.id, "USD")).available, 0, "not credited at initiation");
    });

    test("the demo provider's callback completes the deposit, credits the net amount, and reconciles", async () => {
        const user = await h.createUser();
        const deposit = await createPendingDeposit(user, 200, "bank");

        await h.waitFor(async () => (await h.balance(user.id, "USD")).available === 200, { message: "wallet credit via demo webhook" });

        const done = await depositStatus(user, deposit.id);
        assert.equal(done.status, "COMPLETED");
        assert.ok(done.completed_at);
        const history = (await h.pool.query("SELECT status FROM transactions WHERE user_id = $1 AND type = 'DEPOSIT'", [user.id])).rows;
        assert.deepEqual(history.map((r) => r.status), ["COMPLETED"], "one history row, following the deposit");
        assert.deepEqual(await h.reconcile(), { balanceMismatches: [], unbalancedJournals: [] });
    });

    test("ZAR bank-transfer deposits: provider instructions with the reference, no invented bank account", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount: "1500.50", currency: "ZAR", paymentMethod: "bank" } });

        assert.equal(res.status, 201);
        const { deposit } = res.body;
        assert.equal(deposit.asset, "ZAR");
        assert.equal(Number(deposit.fee), 0, "bank transfers are free");
        assert.equal(deposit.instructions.kind, "bank_transfer");
        assert.equal(deposit.instructions.reference, deposit.provider_reference);
        assert.equal(deposit.instructions.demo, true);
        assert.equal(res.body.demo, true);
        assert.equal(JSON.stringify(deposit.instructions).match(/account\s*number|\b\d{9,}\b/i), null, "demo must never show a bank account");

        await h.waitFor(async () => (await h.balance(user.id, "ZAR")).available === 1500.5, { message: "ZAR credit" });
        assert.equal((await h.balance(user.id, "USD")).available, 0, "currencies never mix");
    });

    test("forceFail leads to FAILED with no balance change", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount: 100, paymentMethod: "card", forceFail: true } });

        await h.waitFor(async () => (await depositStatus(user, res.body.deposit.id)).status === "FAILED", { message: "FAILED status" });
        assert.equal((await h.balance(user.id, "USD")).available, 0);
        assert.ok((await depositStatus(user, res.body.deposit.id)).failure_reason);
    });

    for (const [name, body] of [
        ["below minimum", { amount: 9, paymentMethod: "card" }],
        ["above maximum", { amount: 10001, paymentMethod: "card" }],
        ["below the ZAR minimum", { amount: 99, currency: "ZAR", paymentMethod: "bank" }],
        ["above the ZAR maximum", { amount: 200001, currency: "ZAR", paymentMethod: "bank" }],
        ["negative", { amount: -5, paymentMethod: "card" }],
        ["zero", { amount: 0, paymentMethod: "card" }],
        ["non-numeric", { amount: "x", paymentMethod: "card" }],
        ["more precise than cents", { amount: "100.001", paymentMethod: "card" }],
        ["unsupported currency", { amount: 100, currency: "EUR", paymentMethod: "card" }],
        ["bad payment method", { amount: 100, paymentMethod: "cash" }]
    ]) {
        test(`rejects ${name} with 400`, async () => {
            const user = await h.createUser();
            const res = await h.api("POST", "/api/deposits/fiat", { token: user.token, body });
            assert.equal(res.status, 400);
            assert.equal((await h.pool.query("SELECT 1 FROM deposits WHERE user_id = $1", [user.id])).rowCount, 0, "nothing recorded");
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

describe("payment webhook security and idempotency", () => {
    test("rejects a missing signature", async () => {
        const signed = h.signWebhook({ id: "e1", type: "deposit.completed", data: { reference: "X" } });
        const res = await h.api("POST", "/api/webhooks/payments", { raw: signed.body, headers: { "Content-Type": "application/json" } });
        assert.equal(res.status, 401);
    });

    test("rejects a wrong signature and does not credit", async () => {
        const user = await h.createUser();
        const { ref } = await insertPendingDeposit(user);
        const res = await h.paymentEvent("deposit.completed", { reference: ref, amount: "100", currency: "USD" }, { signature: "0".repeat(64) });

        assert.equal(res.status, 401);
        assert.equal((await h.balance(user.id, "USD")).available, 0);
    });

    test("rejects a signature computed over a different body (tampering)", async () => {
        const user = await h.createUser();
        const { ref } = await insertPendingDeposit(user);
        const good = h.signWebhook({ id: "x", type: "deposit.failed", data: { reference: ref } });
        const res = await h.paymentEvent("deposit.completed", { reference: ref, amount: "100", currency: "USD" }, { signature: good.signature });
        assert.equal(res.status, 401);
    });

    test("a redelivered event (same id) and a duplicate event (new id) both credit nothing extra", async () => {
        const user = await h.createUser();
        const { ref } = await insertPendingDeposit(user);
        const data = { reference: ref, amount: "100.00", currency: "USD" };

        assert.equal((await h.paymentEvent("deposit.completed", data, { id: "evt_same" + ref })).status, 200);
        const redelivered = await h.paymentEvent("deposit.completed", data, { id: "evt_same" + ref });
        const duplicate = await h.paymentEvent("deposit.completed", data);

        assert.equal(redelivered.status, 200);
        assert.match(redelivered.body.message, /already received/i);
        assert.equal(duplicate.status, 200);
        assert.equal((await h.balance(user.id, "USD")).available, 100);
        assert.equal((await h.pool.query("SELECT 1 FROM ledger_journals WHERE journal_key LIKE 'deposit:%' AND reference_id = (SELECT id FROM deposits WHERE provider_reference = $1)", [ref])).rowCount, 1);
    });

    test("concurrent duplicate webhooks credit exactly once", async () => {
        const user = await h.createUser();
        const { ref } = await insertPendingDeposit(user);

        const results = await Promise.all(Array.from({ length: 6 }, () =>
            h.paymentEvent("deposit.completed", { reference: ref, amount: "100", currency: "USD" })
        ));

        assert.ok(results.every((r) => r.status === 200), results.map((r) => r.status).join(","));
        assert.equal((await h.balance(user.id, "USD")).available, 100);
    });

    test("a provider report of a different amount or currency is held for review, not credited", async () => {
        const user = await h.createUser();
        const short = await insertPendingDeposit(user, { amount: "100" });
        const wrongCurrency = await insertPendingDeposit(user, { amount: "100" });

        await h.paymentEvent("deposit.completed", { reference: short.ref, amount: "99.99", currency: "USD" });
        await h.paymentEvent("deposit.completed", { reference: wrongCurrency.ref, amount: "100", currency: "ZAR" });

        assert.equal((await depositStatus(user, short.id)).status, "UNDER_REVIEW");
        assert.equal((await depositStatus(user, wrongCurrency.id)).status, "UNDER_REVIEW");
        assert.equal((await h.balance(user.id, "USD")).available, 0);
        assert.equal((await h.pool.query("SELECT outcome FROM provider_events WHERE payload->'data'->>'reference' = $1", [short.ref])).rows[0].outcome, "amount_mismatch");
    });

    test("unknown reference -> 404; malformed payload or unsupported type -> 400", async () => {
        assert.equal((await h.paymentEvent("deposit.completed", { reference: "NOPE", amount: "1", currency: "USD" })).status, 404);
        assert.equal((await h.paymentEvent("deposit.completed", {})).status, 400);
        assert.equal((await h.paymentEvent("deposit.bogus", { reference: "X" })).status, 400);
        const noId = h.signWebhook({ type: "deposit.completed", data: { reference: "X" } });
        assert.equal((await h.api("POST", "/api/webhooks/payments", { raw: noId.body, headers: { "Content-Type": "application/json", "X-Webhook-Signature": noId.signature } })).status, 400);
    });

    test("a failed event after a completed one cannot reverse or re-fail the deposit", async () => {
        const user = await h.createUser();
        const { id, ref } = await insertPendingDeposit(user);
        await h.paymentEvent("deposit.completed", { reference: ref, amount: "100", currency: "USD" });

        await h.paymentEvent("deposit.failed", { reference: ref });

        assert.equal((await h.balance(user.id, "USD")).available, 100);
        assert.equal((await depositStatus(user, id)).status, "COMPLETED");
    });
});

const custody = (data, options) => h.custodyEvent("deposit.updated", data, options);

describe("crypto deposits", () => {
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
        assert.match(a1.body.qrCode, /^data:image\/png;base64,/, "QR generated locally");
        assert.equal(a1.body.requiredConfirmations, 2);
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
        assert.equal(sim.status, 202);
        assert.equal(sim.body.demo, true);
        assert.match(sim.body.txHash, /^demo-/, "demo hashes can't be mistaken for real ones");
        assert.equal((await h.balance(user.id, "BTC")).available, 0, "not credited before confirmations");

        await h.waitFor(async () => (await h.balance(user.id, "BTC")).available === 0.5, { timeout: 12000, message: "crypto deposit credit" });
        const list = (await h.api("GET", "/api/deposits", { token: user.token })).body.deposits;
        assert.equal(list.length, 1);
        assert.equal(list[0].status, "COMPLETED");
        assert.equal(list[0].confirmations, list[0].required_confirmations);
        assert.equal(list[0].tx_hash, sim.body.txHash);

        await new Promise((r) => setTimeout(r, 600));
        assert.equal((await h.balance(user.id, "BTC")).available, 0.5, "no double credit after extra events");
    });

    test("custody events: progress, out-of-order confirmations, duplicates, and exactly one credit", async () => {
        const user = await h.createUser();
        const { address } = (await h.api("GET", "/api/deposits/crypto/address?asset=ETH&network=ERC20", { token: user.token })).body;
        const base = { txHash: `0x${crypto.randomBytes(32).toString("hex")}`, network: "ERC20", asset: "ETH", address, amount: "1.25" };

        await custody({ ...base, confirmations: 0, state: "pending" });
        let deposit = (await h.api("GET", "/api/deposits", { token: user.token })).body.deposits[0];
        assert.equal(deposit.status, "DETECTED");

        await custody({ ...base, confirmations: 2, state: "pending" });
        await custody({ ...base, confirmations: 1, state: "pending" }); // late, out of order
        deposit = (await h.api("GET", "/api/deposits", { token: user.token })).body.deposits[0];
        assert.equal(deposit.status, "CONFIRMING");
        assert.equal(deposit.confirmations, 2, "confirmations never go backwards");
        assert.equal((await h.balance(user.id, "ETH")).available, 0);

        await Promise.all([1, 2, 3].map(() => custody({ ...base, confirmations: 3, state: "confirmed" })));
        assert.equal((await h.balance(user.id, "ETH")).available, 1.25);
        assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM deposits WHERE tx_hash = $1", [base.txHash])).rows[0].n, 1);
        assert.deepEqual(await h.reconcile(), { balanceMismatches: [], unbalancedJournals: [] });
    });

    test("an address we never issued is recorded but credits nobody", async () => {
        const res = await custody({ txHash: "0xabc", network: "ERC20", asset: "ETH", address: "0x0000000000000000000000000000000000000001", amount: "5", confirmations: 10, state: "confirmed" });
        assert.equal(res.status, 200);
        const event = (await h.pool.query("SELECT outcome FROM provider_events WHERE payload->'data'->>'txHash' = '0xabc'")).rows[0];
        assert.equal(event.outcome, "unknown_address");
        assert.equal((await h.pool.query("SELECT 1 FROM deposits WHERE tx_hash = '0xabc'")).rowCount, 0);
    });

    test("an event for another asset/network at our address, or a bad signature, credits nothing", async () => {
        const user = await h.createUser();
        const { address } = (await h.api("GET", "/api/deposits/crypto/address?asset=ETH&network=ERC20", { token: user.token })).body;

        await custody({ txHash: "0xusdt1", network: "ERC20", asset: "USDT", address, amount: "50", confirmations: 9, state: "confirmed" });
        await custody({ txHash: "0xbtc1", network: "BTC", asset: "BTC", address, amount: "1", confirmations: 9, state: "confirmed" });
        const forged = await custody({ txHash: "0xeth1", network: "ERC20", asset: "ETH", address, amount: "1", confirmations: 9, state: "confirmed" }, { signature: "f".repeat(64) });

        assert.equal(forged.status, 401);
        assert.equal((await h.balance(user.id, "USDT")).available, 0);
        assert.equal((await h.balance(user.id, "ETH")).available, 0);
    });

    test("a reversal before credit fails the deposit; after credit it is held for review and never silently debited", async () => {
        const user = await h.createUser();
        const { address } = (await h.api("GET", "/api/deposits/crypto/address?asset=SOL&network=SOL", { token: user.token })).body;
        const early = { txHash: "sol-early-" + crypto.randomBytes(4).toString("hex"), network: "SOL", asset: "SOL", address, amount: "3" };
        const late = { ...early, txHash: "sol-late-" + crypto.randomBytes(4).toString("hex") };

        await custody({ ...early, confirmations: 0, state: "pending" });
        await custody({ ...early, confirmations: 0, state: "reverted" });

        await custody({ ...late, confirmations: 1, state: "confirmed" });
        assert.equal((await h.balance(user.id, "SOL")).available, 3);
        await custody({ ...late, confirmations: 1, state: "reverted" });

        const rows = (await h.pool.query("SELECT tx_hash, status FROM deposits WHERE user_id = $1 ORDER BY id", [user.id])).rows;
        assert.deepEqual(rows.map((r) => r.status), ["FAILED", "UNDER_REVIEW"]);
        assert.equal((await h.balance(user.id, "SOL")).available, 3, "no automatic debit");
    });

    test("a confirmed deposit below the minimum is held for review, not credited", async () => {
        const user = await h.createUser();
        const { address } = (await h.api("GET", "/api/deposits/crypto/address?asset=BTC&network=BTC", { token: user.token })).body;
        await custody({ txHash: "dust-" + crypto.randomBytes(4).toString("hex"), network: "BTC", asset: "BTC", address, amount: "0.00001", confirmations: 6, state: "confirmed" });

        const [row] = (await h.pool.query("SELECT status FROM deposits WHERE user_id = $1", [user.id])).rows;
        assert.equal(row.status, "UNDER_REVIEW");
        assert.equal((await h.balance(user.id, "BTC")).available, 0);
    });

    test("GET /api/deposits unifies fiat and crypto rows for the user", async () => {
        const user = await h.createUser();
        await createPendingDeposit(user);
        const { address } = (await h.api("GET", "/api/deposits/crypto/address?asset=ETH&network=ERC20", { token: user.token })).body;
        await custody({ txHash: "unify-" + crypto.randomBytes(4).toString("hex"), network: "ERC20", asset: "ETH", address, amount: "1", confirmations: 0, state: "pending" });

        const list = await h.api("GET", "/api/deposits", { token: user.token });
        assert.deepEqual(list.body.deposits.map((d) => d.type).sort(), ["CRYPTO", "FIAT"]);
    });
});
