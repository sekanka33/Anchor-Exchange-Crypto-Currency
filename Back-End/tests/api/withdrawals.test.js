const { test, describe, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");
const demoPayments = require("../../services/payments/demoPaymentProvider");
const demoCustody = require("../../services/custody/demoCustody");

before(h.start);
after(h.stop);
afterEach(() => {
    demoPayments.controls.reset();
    demoCustody.controls.reset();
});

const BTC = { asset: "BTC", network: "BTC", amount: 0.01, address: h.validAddresses.BTC };

const tokenFor = async (withdrawalId) =>
    (await h.pool.query("SELECT confirmation_token FROM withdrawals WHERE id = $1", [withdrawalId])).rows[0].confirmation_token;

const request = (user, body = BTC, headers = {}) => h.api("POST", "/api/withdrawals/crypto", { token: user.token, body, headers });
const confirm = async (id) => h.api("GET", `/api/withdrawals/confirm?token=${await tokenFor(id)}`);
const status = async (user, id) => (await h.api("GET", `/api/withdrawals/${id}`, { token: user.token })).body.withdrawal;
const journals = async (id) => (await h.pool.query(
    "SELECT journal_key FROM ledger_journals WHERE reference_type = 'withdrawal' AND reference_id = $1 ORDER BY id", [id]
)).rows.map((r) => r.journal_key.split(":")[2]);
const waitForStatus = (user, id, wanted) =>
    h.waitFor(async () => (await status(user, id)).status === wanted, { message: `withdrawal ${id} ${wanted}` });
const clean = async () => assert.deepEqual(await h.reconcile(), { balanceMismatches: [], unbalancedJournals: [] });

describe("crypto withdrawal request", () => {
    test("moves the amount from available to locked and returns PENDING_CONFIRMATION", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);

        const res = await request(user);

        assert.equal(res.status, 201);
        assert.equal(res.body.withdrawal.status, "PENDING_CONFIRMATION");
        assert.equal(res.body.withdrawal.reference, `WD-${res.body.withdrawal.id}`);
        assert.equal(Number(res.body.withdrawal.fee), 0.0005);
        assert.equal(Number(res.body.withdrawal.receive_amount), 0.0095);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 });
        assert.equal(res.body.withdrawal.confirmation_token, undefined, "token must never be in the API response");
        assert.deepEqual(await journals(res.body.withdrawal.id), ["reserve"], "reserved, not paid out");
        const history = (await h.pool.query("SELECT status FROM transactions WHERE user_id = $1 AND type = 'WITHDRAWAL'", [user.id])).rows;
        assert.deepEqual(history.map((r) => r.status), ["PENDING_CONFIRMATION"], "visible in history as pending");
        await clean();
    });

    test("cannot withdraw more than available; nothing is locked", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.005);
        const res = await request(user);

        assert.equal(res.status, 400);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.005, locked: 0 });
    });

    test("funds already locked by one request can't be reserved by a second", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.015);

        assert.equal((await request(user)).status, 201);
        assert.equal((await request(user)).status, 400);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.005, locked: 0.01 });
    });

    test("5 concurrent requests with funds for 3: exactly 3 reserve, no overdraft", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.03);

        const results = await Promise.all(Array.from({ length: 5 }, () => request(user)));

        assert.equal(results.filter((r) => r.status === 201).length, 3);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0, locked: 0.03 });
        await clean();
    });

    test("an Idempotency-Key makes retries (even concurrent ones) return the same withdrawal", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const headers = { "Idempotency-Key": "retry-key-0001" };

        const results = await Promise.all(Array.from({ length: 4 }, () => request(user, BTC, headers)));
        const ids = new Set(results.map((r) => r.body.withdrawal?.id));

        assert.equal(results.filter((r) => r.status === 201).length, 1);
        assert.equal(results.filter((r) => r.status === 200).length, 3);
        assert.equal(ids.size, 1);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 }, "reserved once");
        assert.equal((await request(user, BTC, { "Idempotency-Key": "bad key!" })).status, 400);
    });

    for (const [name, override, reason] of [
        ["address for the wrong network", { address: h.validAddresses.ERC20 }],
        ["garbage address", { address: "not-an-address" }],
        ["missing address", { address: undefined }],
        ["SQL/HTML in address", { address: "'; DROP TABLE users;--<script>" }],
        ["unsupported network for asset", { network: "ERC20", address: h.validAddresses.ERC20 }],
        ["unsupported asset", { asset: "SHIB" }],
        ["amount not above the network fee", { amount: 0.0005 }, /network fee/i],
        ["zero amount", { amount: 0 }],
        ["negative amount", { amount: -1 }],
        ["non-numeric amount", { amount: "all of it" }],
        ["more than 8 decimal places", { amount: "0.012345678" }],
        ["below $25 minimum value", { asset: "ETH", network: "ERC20", address: h.validAddresses.ERC20, amount: 0.008 }, /minimum withdrawal value/i],
        ["above $10,000 maximum value", { amount: 1 }, /maximum withdrawal value/i]
    ]) {
        test(`rejects ${name}`, async () => {
            const user = await h.createUser();
            const asset = override.asset || "BTC";
            await h.fund(user.id, asset, 5);
            const res = await request(user, { ...BTC, ...override });

            assert.equal(res.status, 400);
            if (reason) assert.match(res.body.message, reason);
            assert.deepEqual(await h.balance(user.id, asset), { available: 5, locked: 0 }, "nothing reserved on a rejected request");
        });
    }

    test("XRP-style memo must be numeric", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "XRP", 1000);
        const res = await h.api("POST", "/api/withdrawals/crypto", {
            token: user.token,
            body: { asset: "XRP", network: "XRP", amount: 100, address: "rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY", memo: "abc" }
        });
        assert.equal(res.status, 400);
    });

    test("requires authentication", async () => {
        assert.equal((await h.api("POST", "/api/withdrawals/crypto", { body: BTC })).status, 401);
    });
});

describe("email confirmation (the anti-takeover control)", () => {
    test("confirming submits to the custodian; only its confirmation completes the payout", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        const token = await tokenFor(id);

        const ok = await h.api("GET", `/api/withdrawals/confirm?token=${token}`);
        assert.equal(ok.status, 200);
        assert.match(ok.body.message, /sent for processing/i);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 }, "still reserved while processing");
        assert.equal((await status(user, id)).status, "PROCESSING");

        await waitForStatus(user, id, "COMPLETED");
        const done = await status(user, id);
        assert.match(done.tx_hash, /^demo-/);
        assert.ok(done.provider_reference);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
        assert.deepEqual(await journals(id), ["reserve", "settle"]);
        const fees = (await h.pool.query("SELECT SUM(amount)::text AS fee FROM ledger_entries e JOIN ledger_journals j ON j.id = e.journal_id WHERE j.journal_key = $1 AND e.account = 'platform:fees'", [`withdrawal:${id}:settle`])).rows[0].fee;
        assert.equal(Number(fees), 0.0005, "the network fee is booked explicitly");

        const replay = await h.api("GET", `/api/withdrawals/confirm?token=${token}`);
        assert.equal(replay.status, 400);
        await clean();
    });

    test("concurrent clicks on the same link submit exactly once and settle exactly once", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        const token = await tokenFor(id);

        const results = await Promise.all(Array.from({ length: 5 }, () => h.api("GET", `/api/withdrawals/confirm?token=${token}`)));

        assert.equal(results.filter((r) => r.status === 200).length, 1);
        await waitForStatus(user, id, "COMPLETED");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
        assert.deepEqual(await journals(id), ["reserve", "settle"]);
    });

    test("missing / unknown tokens are rejected", async () => {
        assert.equal((await h.api("GET", "/api/withdrawals/confirm")).status, 400);
        assert.equal((await h.api("GET", "/api/withdrawals/confirm?token=deadbeef")).status, 400);
    });

    test("a stolen session token alone cannot complete a withdrawal (no API path skips the email)", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;

        await h.api("POST", `/api/withdrawals/${id}/confirm`, { token: user.token });
        await h.api("PATCH", `/api/withdrawals/${id}`, { token: user.token, body: { status: "COMPLETED" } });
        await h.paymentEvent("payout.completed", { reference: `WD-${id}` }, { signature: "0".repeat(64) });
        const listed = await h.api("GET", "/api/withdrawals", { token: user.token });
        assert.ok(!JSON.stringify(listed.body).includes(await tokenFor(id)), "list must not leak the token");

        assert.equal((await h.pool.query("SELECT status FROM withdrawals WHERE id = $1", [id])).rows[0].status, "PENDING_CONFIRMATION");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 });
    });

    test("a genuine payout event can't complete a withdrawal that was never confirmed", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;

        const res = await h.custodyEvent("withdrawal.updated", { reference: `WD-${id}`, txHash: "x", state: "confirmed" });
        assert.equal(res.status, 409, "the custodian has no such transfer");
        demoCustody.controls.setWithdrawalStatus(`WD-${id}`, "completed");
        const agreed = await h.custodyEvent("withdrawal.updated", { reference: `WD-${id}`, txHash: "x", state: "confirmed" });
        assert.equal(agreed.status, 200, "even when the custodian agrees, an unconfirmed withdrawal is not paid");
        assert.equal((await status(user, id)).status, "PENDING_CONFIRMATION");
        assert.deepEqual(await journals(id), ["reserve"]);
    });

    test("an expired link is rejected, and the next read releases the funds", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        const token = await tokenFor(id);
        await h.pool.query("UPDATE withdrawals SET confirmation_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [id]);

        assert.equal((await h.api("GET", `/api/withdrawals/confirm?token=${token}`)).status, 400);

        assert.equal((await status(user, id)).status, "EXPIRED");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
        assert.deepEqual(await journals(id), ["reserve", "release"]);
    });
});

describe("provider outcomes", () => {
    test("the custodian rejecting the withdrawal fails it and releases the funds once", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        demoCustody.controls.setNextWithdrawal({ submit: "reject" });

        const res = await confirm(id);

        assert.equal(res.status, 200);
        assert.match(res.body.message, /rejected/i);
        assert.equal((await status(user, id)).status, "FAILED");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
        assert.deepEqual(await journals(id), ["reserve", "release"]);
    });

    test("a payout that fails after submission releases funds exactly once, however often it's reported", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        demoCustody.controls.setNextWithdrawal({ submit: "ok", settle: "none" });
        await confirm(id);

        demoCustody.controls.setWithdrawalStatus(`WD-${id}`, "failed");
        const failed = { reference: `WD-${id}`, state: "failed", reason: "rejected by network" };
        await Promise.all([1, 2, 3].map(() => h.custodyEvent("withdrawal.updated", failed)));
        await h.custodyEvent("withdrawal.updated", { reference: `WD-${id}`, txHash: "late", state: "confirmed" });

        assert.equal((await status(user, id)).status, "FAILED");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
        assert.deepEqual(await journals(id), ["reserve", "release"], "a late success can't pay out released funds");
        await clean();
    });

    test("an unknown outcome keeps the funds locked until the provider's answer is known", async () => {
        const admin = await h.createUser({ role: "admin" });
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        demoCustody.controls.setNextWithdrawal({ submit: "timeout", afterTimeout: "completed" });

        await confirm(id);
        const held = await status(user, id);
        assert.equal(held.status, "UNDER_REVIEW");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 }, "never auto-released");
        assert.deepEqual(await journals(id), ["reserve"]);

        assert.equal((await h.api("POST", `/api/admin/withdrawals/${id}/recheck`, { token: user.token })).status, 403);
        const recheck = await h.api("POST", `/api/admin/withdrawals/${id}/recheck`, { token: admin.token });
        assert.equal(recheck.status, 200);
        assert.equal(recheck.body.providerStatus, "completed");
        assert.equal((await status(user, id)).status, "COMPLETED");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
        assert.equal((await h.pool.query("SELECT 1 FROM audit_logs WHERE action = 'WITHDRAWAL_RECHECK' AND target_id = $1", [String(id)])).rowCount, 1);
        await clean();
    });

    test("if the provider never received it, a re-check resubmits it (same reference, no double pay)", async () => {
        const admin = await h.createUser({ role: "admin" });
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        demoCustody.controls.setNextWithdrawal({ submit: "timeout", afterTimeout: "not_found" });
        await confirm(id);
        assert.equal((await status(user, id)).status, "UNDER_REVIEW");

        const recheck = await h.api("POST", `/api/admin/withdrawals/${id}/recheck`, { token: admin.token });
        assert.match(recheck.body.message, /resubmitted/i);
        await waitForStatus(user, id, "COMPLETED");
        assert.deepEqual(await journals(id), ["reserve", "settle"]);
    });
});

describe("cancel", () => {
    test("cancelling releases the lock exactly once", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: user.token })).status, 200);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: user.token })).status, 404, "second cancel finds nothing pending");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
        assert.deepEqual(await journals(id), ["reserve", "release"]);
    });

    test("a cancelled withdrawal's emailed link no longer works", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        const token = await tokenFor(id);
        await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: user.token });

        assert.equal((await h.api("GET", `/api/withdrawals/confirm?token=${token}`)).status, 400);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
    });

    test("a user cannot cancel or view someone else's withdrawal", async () => {
        const alice = await h.createUser();
        const mallory = await h.createUser();
        await h.fund(alice.id, "BTC", 0.05);
        const { id } = (await request(alice)).body.withdrawal;

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: mallory.token })).status, 404);
        assert.equal((await h.api("GET", `/api/withdrawals/${id}`, { token: mallory.token })).status, 404);
        assert.deepEqual(await h.balance(alice.id, "BTC"), { available: 0.04, locked: 0.01 });
    });

    test("cannot cancel a withdrawal once it has been confirmed", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        await confirm(id);

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: user.token })).status, 404);
        await waitForStatus(user, id, "COMPLETED");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
    });
});

describe("fiat withdrawal", () => {
    const bank = { accountHolderName: "Test User", accountNumber: "1234567890", bankName: "First National" };
    const zarBank = { ...bank, branchCode: "250655", accountType: "cheque" };

    test("reserves, applies the 1% fee, pays out through the provider, and never exposes the account number", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 500);

        const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: 100, bankDetails: bank } });
        assert.equal(res.status, 201);
        assert.equal(Number(res.body.withdrawal.fee), 1);
        assert.equal(Number(res.body.withdrawal.receive_amount), 99);
        assert.equal(res.body.withdrawal.bank_details.accountNumberMasked, "•••• 7890");
        assert.ok(!JSON.stringify(res.body).includes("1234567890"), "full account number never returned");
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 400, locked: 100 });

        const stored = (await h.pool.query("SELECT account_number_encrypted, account_number_last4 FROM bank_beneficiaries WHERE user_id = $1", [user.id])).rows[0];
        assert.ok(!stored.account_number_encrypted.includes("1234567890"), "encrypted at rest");
        assert.equal(stored.account_number_last4, "7890");

        await confirm(res.body.withdrawal.id);
        await waitForStatus(user, res.body.withdrawal.id, "COMPLETED");
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 400, locked: 0 });
        await clean();
    });

    test("ZAR payout to a saved beneficiary; the beneficiary can be reused and is private", async () => {
        const user = await h.createUser();
        const other = await h.createUser();
        await h.fund(user.id, "ZAR", 5000);

        const saved = await h.api("POST", "/api/withdrawals/beneficiaries", { token: user.token, body: { ...zarBank, currency: "ZAR", label: "Main" } });
        assert.equal(saved.status, 201);
        const beneficiaryId = saved.body.beneficiary.id;
        assert.equal(saved.body.beneficiary.accountNumberMasked, "•••• 7890");

        const list = await h.api("GET", "/api/withdrawals/beneficiaries", { token: user.token });
        assert.equal(list.body.beneficiaries.length, 1);
        assert.equal((await h.api("GET", "/api/withdrawals/beneficiaries", { token: other.token })).body.beneficiaries.length, 0);

        const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: "1000", currency: "ZAR", beneficiaryId } });
        assert.equal(res.status, 201);
        assert.equal(res.body.withdrawal.asset, "ZAR");
        assert.equal(Number(res.body.withdrawal.fee), 10);
        assert.deepEqual(await h.balance(user.id, "ZAR"), { available: 4000, locked: 1000 });

        const stolen = await h.api("POST", "/api/withdrawals/fiat", { token: other.token, body: { amount: "300", currency: "ZAR", beneficiaryId } });
        assert.equal(stolen.status, 400, "someone else's beneficiary");
    });

    test("a provider-failed bank payout returns the money exactly once", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 500);
        const { id } = (await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: 100, bankDetails: bank } })).body.withdrawal;
        demoPayments.controls.setNextPayout({ submit: "ok", settle: "failed" });

        await confirm(id);
        await waitForStatus(user, id, "FAILED");

        assert.deepEqual(await h.balance(user.id, "USD"), { available: 500, locked: 0 });
        assert.match((await status(user, id)).failure_reason, /rejected/i);
        await h.paymentEvent("payout.completed", { reference: `WD-${id}` });
        assert.deepEqual(await journals(id), ["reserve", "release"]);
    });

    const pendingFiatPayout = async (user, amount = 100) => {
        const { id } = (await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount, bankDetails: bank } })).body.withdrawal;
        demoPayments.controls.setNextPayout({ submit: "ok", settle: "none" });
        await confirm(id);
        assert.equal((await status(user, id)).status, "PROCESSING");
        return id;
    };

    test("a payout event must match the amount and currency we asked the provider to pay", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 500);
        const wrongAmount = await pendingFiatPayout(user);
        const noAmount = await pendingFiatPayout(user);
        demoPayments.controls.setPayoutStatus(`WD-${wrongAmount}`, "completed");
        demoPayments.controls.setPayoutStatus(`WD-${noAmount}`, "completed");

        assert.equal((await h.paymentEvent("payout.completed", { reference: `WD-${wrongAmount}`, amount: "990.00", currency: "USD" })).status, 200);
        assert.equal((await h.paymentEvent("payout.completed", { reference: `WD-${noAmount}` })).status, 200);

        for (const id of [wrongAmount, noAmount]) {
            const w = await status(user, id);
            assert.equal(w.status, "UNDER_REVIEW");
            assert.deepEqual(await journals(id), ["reserve"], "neither settled nor released");
        }
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 300, locked: 200 });
        await clean();
    });

    test("a 'failed' payout the provider doesn't confirm can't hand the reserved money back", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 500);
        const id = await pendingFiatPayout(user);

        const res = await h.paymentEvent("payout.failed", { reference: `WD-${id}`, amount: "99.00", currency: "USD" });
        assert.equal(res.status, 409, "the provider still reports it as processing");
        assert.equal((await status(user, id)).status, "PROCESSING");
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 400, locked: 100 });
    });

    test("payment-provider events can't settle a crypto withdrawal (channels are bound even though both adapters are 'demo')", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const { id } = (await request(user)).body.withdrawal;
        demoCustody.controls.setNextWithdrawal({ submit: "ok", settle: "none" });
        await confirm(id);
        demoPayments.controls.setPayoutStatus(`WD-${id}`, "completed");

        const res = await h.paymentEvent("payout.completed", { reference: `WD-${id}`, amount: "0.0095", currency: "BTC" });
        assert.equal(res.status, 404);
        assert.equal((await status(user, id)).status, "PROCESSING");
        assert.deepEqual(await journals(id), ["reserve"]);
    });

    test("bank details that can't be decrypted stop the payout before it is sent; funds stay reserved", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 500);
        const { id } = (await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: 100, bankDetails: bank } })).body.withdrawal;
        await h.pool.query(
            "UPDATE bank_beneficiaries SET account_number_encrypted = regexp_replace(account_number_encrypted, ':[^:]+$', ':AAAAAAAAAAAA') WHERE user_id = $1",
            [user.id]
        );

        await confirm(id);
        const w = (await h.pool.query("SELECT status, provider_status, provider_reference FROM withdrawals WHERE id = $1", [id])).rows[0];
        assert.equal(w.status, "UNDER_REVIEW");
        assert.equal(w.provider_status, "not_submitted");
        assert.equal(w.provider_reference, null, "nothing reached the provider");
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 400, locked: 100 });
    });

    test("beneficiaries saved under the original fingerprint scheme are recognised and upgraded, not duplicated", async () => {
        const user = await h.createUser();
        const first = await h.api("POST", "/api/withdrawals/beneficiaries", { token: user.token, body: { ...bank, currency: "USD" } });
        const key = Buffer.from(process.env.BENEFICIARY_ENCRYPTION_KEY, "hex");
        const legacy = require("node:crypto").createHmac("sha256", key).update(`account:${bank.accountNumber}`).digest("hex");
        await h.pool.query("UPDATE bank_beneficiaries SET account_fingerprint = $2 WHERE id = $1", [first.body.beneficiary.id, legacy]);

        const again = await h.api("POST", "/api/withdrawals/beneficiaries", { token: user.token, body: { ...bank, currency: "USD" } });
        assert.equal(again.body.beneficiary.id, first.body.beneficiary.id);
        const rows = (await h.pool.query("SELECT account_fingerprint FROM bank_beneficiaries WHERE user_id = $1", [user.id])).rows;
        assert.equal(rows.length, 1);
        assert.notEqual(rows[0].account_fingerprint, legacy, "upgraded to the derived-key fingerprint");
    });

    test("another user can't archive, list or pay out to someone's beneficiary", async () => {
        const owner = await h.createUser();
        const other = await h.createUser();
        const saved = await h.api("POST", "/api/withdrawals/beneficiaries", { token: owner.token, body: { ...bank, currency: "USD" } });
        assert.equal((await h.api("DELETE", `/api/withdrawals/beneficiaries/${saved.body.beneficiary.id}`, { token: other.token })).status, 404);
        assert.equal((await h.api("GET", "/api/withdrawals/beneficiaries", { token: owner.token })).body.beneficiaries.length, 1);
        assert.equal((await h.api("GET", "/api/withdrawals/beneficiaries")).status, 401);
    });

    for (const [name, body] of [
        ["below $20", { amount: 19, bankDetails: bank }],
        ["above $10,000", { amount: 10001, bankDetails: bank }],
        ["below the R200 minimum", { amount: 199, currency: "ZAR", bankDetails: zarBank }],
        ["ZAR without a branch code", { amount: 500, currency: "ZAR", bankDetails: bank }],
        ["a bad account type", { amount: 500, currency: "ZAR", bankDetails: { ...zarBank, accountType: "crypto" } }],
        ["missing bank details", { amount: 100 }],
        ["blank account number", { amount: 100, bankDetails: { ...bank, accountNumber: "  " } }],
        ["letters in the account number", { amount: 100, bankDetails: { ...bank, accountNumber: "12345abc90" } }],
        ["non-numeric amount", { amount: "x", bankDetails: bank }],
        ["unknown beneficiary", { amount: 100, beneficiaryId: 999999 }]
    ]) {
        test(`rejects ${name}`, async () => {
            const user = await h.createUser();
            await h.fund(user.id, "USD", 500);
            await h.fund(user.id, "ZAR", 5000);
            const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body });
            assert.equal(res.status, 400);
            assert.deepEqual(await h.balance(user.id, "USD"), { available: 500, locked: 0 });
            assert.deepEqual(await h.balance(user.id, "ZAR"), { available: 5000, locked: 0 });
        });
    }

    test("cannot withdraw more than the balance in that currency", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 50);
        await h.fund(user.id, "ZAR", 50000);
        const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: 100, bankDetails: bank } });
        assert.equal(res.status, 400);
    });
});
