const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

const BTC = { asset: "BTC", network: "BTC", amount: 0.01, address: h.validAddresses.BTC };

const tokenFor = async (withdrawalId) =>
    (await h.pool.query("SELECT confirmation_token FROM withdrawals WHERE id = $1", [withdrawalId])).rows[0].confirmation_token;

const request = (user, body = BTC) => h.api("POST", "/api/withdrawals/crypto", { token: user.token, body });

describe("crypto withdrawal request", () => {
    test("moves the amount from available to locked and returns PENDING_CONFIRMATION", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);

        const res = await request(user);

        assert.equal(res.status, 201);
        assert.equal(res.body.withdrawal.status, "PENDING_CONFIRMATION");
        assert.equal(Number(res.body.withdrawal.fee), 0.0005);
        assert.equal(Number(res.body.withdrawal.receive_amount), 0.0095);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 });
        assert.equal(res.body.withdrawal.confirmation_token, undefined, "token must never be in the API response");
        assert.equal((await h.pool.query("SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'WITHDRAWAL'", [user.id])).rowCount, 0, "no ledger entry until confirmed");
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
    test("a valid token finalises: locked funds are burned, ledger row written, token is single-use", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);
        const token = await tokenFor(req.body.withdrawal.id);

        const ok = await h.api("GET", `/api/withdrawals/confirm?token=${token}`);
        assert.equal(ok.status, 200);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });

        const status = await h.api("GET", `/api/withdrawals/${req.body.withdrawal.id}`, { token: user.token });
        assert.equal(status.body.withdrawal.status, "COMPLETED");
        assert.ok(status.body.withdrawal.tx_hash);
        assert.equal((await h.pool.query("SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'WITHDRAWAL'", [user.id])).rowCount, 1);

        const replay = await h.api("GET", `/api/withdrawals/confirm?token=${token}`);
        assert.equal(replay.status, 400);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 }, "replay must not debit again");
    });

    test("concurrent clicks on the same link debit exactly once", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);
        const token = await tokenFor(req.body.withdrawal.id);

        const results = await Promise.all(Array.from({ length: 5 }, () => h.api("GET", `/api/withdrawals/confirm?token=${token}`)));

        assert.equal(results.filter((r) => r.status === 200).length, 1);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
        assert.equal((await h.pool.query("SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'WITHDRAWAL'", [user.id])).rowCount, 1);
    });

    test("missing / unknown tokens are rejected", async () => {
        assert.equal((await h.api("GET", "/api/withdrawals/confirm")).status, 400);
        assert.equal((await h.api("GET", "/api/withdrawals/confirm?token=deadbeef")).status, 400);
    });

    test("a stolen session token alone cannot complete a withdrawal (no API path skips the email)", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);

        // Everything an attacker holding only the JWT can try:
        await h.api("POST", `/api/withdrawals/${req.body.withdrawal.id}/confirm`, { token: user.token });
        await h.api("PATCH", `/api/withdrawals/${req.body.withdrawal.id}`, { token: user.token, body: { status: "COMPLETED" } });
        const listed = await h.api("GET", "/api/withdrawals", { token: user.token });
        assert.ok(!JSON.stringify(listed.body).includes(await tokenFor(req.body.withdrawal.id)), "list must not leak the token");

        const row = (await h.pool.query("SELECT status FROM withdrawals WHERE id = $1", [req.body.withdrawal.id])).rows[0];
        assert.equal(row.status, "PENDING_CONFIRMATION");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0.01 });
    });

    test("an expired link is rejected, and the next read releases the funds", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);
        const id = req.body.withdrawal.id;
        const token = await tokenFor(id);
        await h.pool.query("UPDATE withdrawals SET confirmation_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [id]);

        assert.equal((await h.api("GET", `/api/withdrawals/confirm?token=${token}`)).status, 400);

        const read = await h.api("GET", `/api/withdrawals/${id}`, { token: user.token });
        assert.notEqual(read.body.withdrawal.status, "PENDING_CONFIRMATION");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
    });
});

describe("cancel", () => {
    test("cancelling releases the lock exactly once", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);
        const id = req.body.withdrawal.id;

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: user.token })).status, 200);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: user.token })).status, 404, "second cancel finds nothing pending");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
    });

    test("a cancelled withdrawal's emailed link no longer works", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);
        const token = await tokenFor(req.body.withdrawal.id);
        await h.api("POST", `/api/withdrawals/${req.body.withdrawal.id}/cancel`, { token: user.token });

        assert.equal((await h.api("GET", `/api/withdrawals/confirm?token=${token}`)).status, 400);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
    });

    test("a user cannot cancel or view someone else's withdrawal", async () => {
        const alice = await h.createUser();
        const mallory = await h.createUser();
        await h.fund(alice.id, "BTC", 0.05);
        const req = await request(alice);
        const id = req.body.withdrawal.id;

        assert.equal((await h.api("POST", `/api/withdrawals/${id}/cancel`, { token: mallory.token })).status, 404);
        assert.equal((await h.api("GET", `/api/withdrawals/${id}`, { token: mallory.token })).status, 404);
        assert.deepEqual(await h.balance(alice.id, "BTC"), { available: 0.04, locked: 0.01 });
    });

    test("cannot cancel a completed withdrawal", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const req = await request(user);
        await h.api("GET", `/api/withdrawals/confirm?token=${await tokenFor(req.body.withdrawal.id)}`);

        assert.equal((await h.api("POST", `/api/withdrawals/${req.body.withdrawal.id}/cancel`, { token: user.token })).status, 404);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
    });
});

describe("fiat withdrawal", () => {
    const bank = { accountHolderName: "Test User", accountNumber: "1234567890", bankName: "First National" };

    test("reserves, applies the 1% fee, and completes on confirmation", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 500);

        const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: 100, bankDetails: bank } });
        assert.equal(res.status, 201);
        assert.equal(Number(res.body.withdrawal.fee), 1);
        assert.equal(Number(res.body.withdrawal.receive_amount), 99);
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 400, locked: 100 });

        await h.api("GET", `/api/withdrawals/confirm?token=${await tokenFor(res.body.withdrawal.id)}`);
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 400, locked: 0 });
    });

    for (const [name, body] of [
        ["below $20", { amount: 19, bankDetails: bank }],
        ["above $10,000", { amount: 10001, bankDetails: bank }],
        ["missing bank details", { amount: 100 }],
        ["blank account number", { amount: 100, bankDetails: { ...bank, accountNumber: "  " } }],
        ["non-numeric amount", { amount: "x", bankDetails: bank }]
    ]) {
        test(`rejects ${name}`, async () => {
            const user = await h.createUser();
            await h.fund(user.id, "USD", 500);
            const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body });
            assert.equal(res.status, 400);
            assert.deepEqual(await h.balance(user.id, "USD"), { available: 500, locked: 0 });
        });
    }

    test("cannot withdraw more USD than the balance", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 50);
        const res = await h.api("POST", "/api/withdrawals/fiat", { token: user.token, body: { amount: 100, bankDetails: bank } });
        assert.equal(res.status, 400);
    });
});
