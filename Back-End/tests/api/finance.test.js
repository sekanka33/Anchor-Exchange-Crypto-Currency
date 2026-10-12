const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

const buy = (user, body) => h.api("POST", "/api/orders/buy", { token: user.token, body });
const sell = (user, body) => h.api("POST", "/api/orders/sell", { token: user.token, body });
const clean = async () => assert.deepEqual(await h.reconcile(), { balanceMismatches: [], unbalancedJournals: [] });

// Test prices (upstreamStub): BTC $50,000; ZAR = 18 × USD, so BTC R900,000.

describe("trading in ZAR and from the wallet balance", () => {
    test("buying with the wallet's ZAR balance: exact fee, exact quantity, booked to the ledger", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "ZAR", 2000);

        const res = await buy(user, { asset: "BTC", amount: "900", currency: "ZAR", paymentMethod: "wallet" });

        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.order.pair, "BTC/ZAR");
        assert.equal(Number(res.body.order.price), 900000);
        assert.equal(Number(res.body.order.amount), 0.001, "R900 at R900,000 buys exactly 0.001 BTC");
        assert.equal(Number(res.body.order.fee), 9, "1% fee in rand");
        assert.deepEqual(await h.balance(user.id, "ZAR"), { available: 1091, locked: 0 }, "900 + 9 fee debited");
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.001, locked: 0 });

        const fee = (await h.pool.query(
            `SELECT e.amount FROM ledger_entries e JOIN ledger_journals j ON j.id = e.journal_id
             WHERE j.journal_key = $1 AND e.account = 'platform:fees'`, [`order:${res.body.order.id}:fill`]
        )).rows[0];
        assert.equal(Number(fee.amount), 9, "the fee is an explicit ledger entry");
        await clean();
    });

    test("selling for ZAR credits proceeds net of fee to the ZAR balance only", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.01);

        const res = await sell(user, { asset: "BTC", amount: "0.01", currency: "ZAR" });

        assert.equal(res.status, 201);
        assert.deepEqual(await h.balance(user.id, "ZAR"), { available: 8910, locked: 0 }, "R9,000 − 1% fee");
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 0, locked: 0 });
        await clean();
    });

    test("a wallet-paid buy needs enough of that currency, including the fee", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 100);
        await h.fund(user.id, "ZAR", 100000);

        const res = await buy(user, { asset: "BTC", amount: "100", paymentMethod: "wallet" });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /insufficient usd balance/i);
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 100, locked: 0 }, "ZAR doesn't pay for USD orders");
        assert.equal((await h.pool.query("SELECT 1 FROM orders WHERE user_id = $1", [user.id])).rowCount, 0);
    });

    test("concurrent wallet-paid buys never overdraw", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 303); // room for exactly three $100 buys at 1% fee

        const results = await Promise.all(Array.from({ length: 6 }, () => buy(user, { asset: "ETH", amount: "100", paymentMethod: "wallet" })));

        assert.equal(results.filter((r) => r.status === 201).length, 3);
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 0, locked: 0 });
        await clean();
    });

    test("ZAR trade limits and precision are enforced", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "ZAR", 500000);
        for (const amount of ["99", "200001", "100.001", "-100", "abc"]) {
            assert.equal((await buy(user, { asset: "BTC", amount, currency: "ZAR", paymentMethod: "wallet" })).status, 400, amount);
        }
        assert.equal((await buy(user, { asset: "BTC", amount: "100", currency: "JPY", paymentMethod: "wallet" })).status, 400);
    });
});

describe("transaction history filters", () => {
    test("filters by fiat/crypto, fees, status, reference and date; always scoped to the user", async () => {
        const user = await h.createUser();
        const other = await h.createUser();
        await h.fund(user.id, "USD", 1000);
        const order = await buy(user, { asset: "BTC", amount: "100", paymentMethod: "wallet" });
        await h.api("POST", "/api/withdrawals/fiat", {
            token: user.token,
            body: { amount: 50, bankDetails: { accountHolderName: "T", accountNumber: "1234567890", bankName: "Bank" } }
        });
        const list = (query) => h.api("GET", `/api/transactions?${query}`, { token: user.token }).then((r) => r.body.transactions);

        assert.deepEqual((await list("category=crypto")).map((t) => t.type), ["BUY"]);
        assert.deepEqual((await list("category=fiat")).map((t) => `${t.type}:${t.status}`), ["WITHDRAWAL:PENDING_CONFIRMATION"]);
        assert.deepEqual((await list("status=PENDING_CONFIRMATION")).map((t) => t.type), ["WITHDRAWAL"]);
        assert.deepEqual((await list("feesOnly=true")).map((t) => t.type).sort(), ["BUY", "WITHDRAWAL"]);
        assert.equal((await list(`search=${order.body.transaction.reference}`)).length, 1);
        assert.equal((await list("startDate=2000-01-01&endDate=2000-01-02")).length, 0);
        const today = new Date().toISOString().slice(0, 10);
        assert.equal((await list(`startDate=${today}&endDate=${today}`)).length, 2, "a date-only end date includes the whole day");

        const bad = await h.api("GET", "/api/transactions?startDate=not-a-date&endDate=';DROP", { token: user.token });
        assert.equal(bad.status, 200, "invalid dates are ignored, not a server error");
        assert.equal((await h.api("GET", "/api/transactions", { token: other.token })).body.transactions.length, 0);
    });
});

describe("administrator finance tools", () => {
    const setup = async () => {
        const admin = await h.createUser({ role: "admin" });
        const user = await h.createUser();
        await h.fund(user.id, "ZAR", 5000);
        const res = await h.api("POST", "/api/withdrawals/fiat", {
            token: user.token,
            body: { amount: "1000", currency: "ZAR", bankDetails: { accountHolderName: "Thabo M", accountNumber: "62000011223", bankName: "Bank", branchCode: "250655" } }
        });
        return { admin, user, withdrawal: res.body.withdrawal };
    };

    test("search and filter withdrawals; details show risk and the ledger, never the account number", async () => {
        const { admin, user, withdrawal } = await setup();

        const byRef = await h.api("GET", `/api/admin/withdrawals?search=WD-${withdrawal.id}&asset=ZAR`, { token: admin.token });
        assert.equal(byRef.status, 200);
        assert.equal(byRef.body.withdrawals.length, 1);
        assert.equal(byRef.body.withdrawals[0].bank_account_masked, "•••• 1223");
        assert.equal((await h.api("GET", `/api/admin/withdrawals?search=${encodeURIComponent(user.email)}&status=COMPLETED`, { token: admin.token })).body.withdrawals.length, 0);

        const detail = await h.api("GET", `/api/admin/withdrawals/${withdrawal.id}`, { token: admin.token });
        assert.equal(detail.status, 200);
        assert.ok(!JSON.stringify(detail.body).includes("62000011223"), "no full account number for admins either");
        assert.equal(detail.body.withdrawal.confirmation_token, undefined);
        assert.equal(detail.body.risk.completed_withdrawals, 0);
        assert.deepEqual(detail.body.ledger.map((j) => j.kind), ["WITHDRAWAL_RESERVE"]);
    });

    test("deposit search by reference and detail with provider events", async () => {
        const admin = await h.createUser({ role: "admin" });
        const user = await h.createUser();
        const created = await h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount: "500", currency: "ZAR", paymentMethod: "bank" } });
        const ref = created.body.deposit.provider_reference;
        await h.waitFor(async () => (await h.balance(user.id, "ZAR")).available === 500, { message: "credit" });

        const found = await h.api("GET", `/api/admin/deposits?search=${ref}&asset=ZAR&status=COMPLETED`, { token: admin.token });
        assert.equal(found.body.deposits.length, 1);
        assert.equal(found.body.deposits[0].provider, "demo");

        const detail = await h.api("GET", `/api/admin/deposits/${created.body.deposit.id}`, { token: admin.token });
        assert.deepEqual(detail.body.ledger.map((j) => j.kind), ["DEPOSIT"]);
        assert.deepEqual(detail.body.providerEvents.map((e) => e.outcome), ["credited"]);
    });

    test("reconciliation, stats, audit log and asset registry are admin-only and built from real records", async () => {
        const { admin, user } = await setup();

        for (const path of ["/api/admin/reconciliation", "/api/admin/audit-logs", "/api/admin/assets", "/api/admin/withdrawals/1", "/api/admin/deposits/1"]) {
            assert.equal((await h.api("GET", path, { token: user.token })).status, 403, path);
            assert.equal((await h.api("GET", path)).status, 401, path);
        }

        const rec = await h.api("GET", "/api/admin/reconciliation", { token: admin.token });
        assert.equal(rec.status, 200);
        assert.deepEqual(rec.body.ledger, { balanceMismatches: [], unbalancedJournals: [] });
        assert.ok(rec.body.platformAccounts.some((a) => a.account === "external:test-funding" && a.asset === "ZAR"));

        const stats = (await h.api("GET", "/api/admin/stats", { token: admin.token })).body;
        assert.ok(stats.withdrawals.statusCounts.PENDING_CONFIRMATION >= 1);
        assert.equal(typeof stats.reconciliation.exceptions, "number");
        assert.equal(typeof stats.users.suspended, "number");

        await h.api("PATCH", `/api/admin/users/${user.id}/suspension`, { token: admin.token, body: { suspended: true, reason: "Fraud review" } });
        const logs = (await h.api("GET", `/api/admin/audit-logs?targetType=user&targetId=${user.id}`, { token: admin.token })).body.auditLogs;
        assert.equal(logs[0].action, "USER_SUSPEND");
        assert.equal(logs[0].actor_email, admin.email);
        assert.deepEqual(logs[0].after_state, { is_suspended: true });

        const assets = (await h.api("GET", "/api/admin/assets", { token: admin.token })).body;
        assert.deepEqual(assets.fiat.map((f) => f.code).sort(), ["USD", "ZAR"]);
        assert.equal(assets.demo, true);
    });

    test("there is no API for an administrator to change a balance or edit the ledger", async () => {
        const { admin, user } = await setup();
        const before = await h.balance(user.id, "ZAR");
        for (const [method, path] of [
            ["PATCH", `/api/admin/users/${user.id}/balance`], ["POST", "/api/admin/ledger"], ["PATCH", "/api/admin/ledger/1"],
            ["POST", `/api/admin/users/${user.id}/credit`], ["PATCH", "/api/admin/deposits/1"], ["PATCH", "/api/admin/withdrawals/1"]
        ]) {
            const res = await h.api(method, path, { token: admin.token, body: { amount: 1000000, asset: "ZAR", status: "COMPLETED" } });
            assert.equal(res.status, 404, `${method} ${path}`);
        }
        assert.deepEqual(await h.balance(user.id, "ZAR"), before);
    });
});

describe("public finance configuration", () => {
    test("exposes currencies, limits, fees, networks and demo status without secrets", async () => {
        const res = await h.api("GET", "/api/config/finance");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.fiatCurrencies.map((c) => c.code), ["ZAR", "USD"]);
        assert.equal(res.body.fiatCurrencies[0].deposit.min, "100");
        assert.equal(res.body.demo, true);
        assert.ok(res.body.crypto.find((c) => c.asset === "USDT").networks.length === 3);
        assert.ok(!/secret|key/i.test(JSON.stringify(Object.keys(res.body))));
    });
});
