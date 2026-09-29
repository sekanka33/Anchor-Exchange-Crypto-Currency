const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

// SOL is deliberately used by exactly one test (the first one) so its price is
// guaranteed to be uncached when the upstream is down.
describe("live price unavailable", () => {
    test("buy fails with 502 and changes nothing when the price feed is down and uncached", async () => {
        const user = await h.createUser();
        h.upstream.fail = true;
        try {
            const res = await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "SOL", amountUsd: 100, paymentMethod: "card" } });
            assert.equal(res.status, 502);
        } finally {
            h.upstream.fail = false;
        }

        assert.deepEqual(await h.balance(user.id, "SOL"), { available: 0, locked: 0 });
        const orders = await h.pool.query("SELECT 1 FROM orders WHERE user_id = $1", [user.id]);
        assert.equal(orders.rowCount, 0);
    });
});

describe("POST /api/orders/buy", () => {
    test("computes amount and fee server-side and credits the wallet", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });

        assert.equal(res.status, 201);
        assert.equal(res.body.demo, true, "must be flagged as a demo payment");
        assert.equal(Number(res.body.order.price), 50000);
        assert.equal(Number(res.body.order.fee), 1);
        assert.equal(Number(res.body.order.total), 100);
        assert.equal(Number(res.body.transaction.total), 101, "user is charged amount + 1% fee");
        assert.equal(res.body.order.side, "BUY");

        assert.equal((await h.balance(user.id, "BTC")).available, 0.002);
    });

    test("ignores a client-supplied price / fee / amount of crypto", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/orders/buy", {
            token: user.token,
            body: { asset: "BTC", amountUsd: 100, paymentMethod: "card", price: 1, fee: 0, cryptoAmount: 9999, total: 1 }
        });

        assert.equal(res.status, 201);
        assert.equal(Number(res.body.order.price), 50000);
        assert.equal((await h.balance(user.id, "BTC")).available, 0.002);
    });

    test("asset symbol is case-insensitive", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "eth", amountUsd: 250, paymentMethod: "bank" } });
        assert.equal(res.status, 201);
        assert.equal((await h.balance(user.id, "ETH")).available, 0.1);
    });

    for (const [name, body] of [
        ["unsupported asset", { asset: "SHIB", amountUsd: 100, paymentMethod: "card" }],
        ["missing asset", { amountUsd: 100, paymentMethod: "card" }],
        ["zero amount", { asset: "BTC", amountUsd: 0, paymentMethod: "card" }],
        ["negative amount", { asset: "BTC", amountUsd: -50, paymentMethod: "card" }],
        ["non-numeric amount", { asset: "BTC", amountUsd: "abc", paymentMethod: "card" }],
        ["NaN-like amount", { asset: "BTC", amountUsd: null, paymentMethod: "card" }],
        ["below minimum", { asset: "BTC", amountUsd: 9.99, paymentMethod: "card" }],
        ["above maximum", { asset: "BTC", amountUsd: 10000.01, paymentMethod: "card" }],
        ["invalid payment method", { asset: "BTC", amountUsd: 100, paymentMethod: "paypal" }],
        ["missing payment method", { asset: "BTC", amountUsd: 100 }]
    ]) {
        test(`rejects ${name} with 400 and creates nothing`, async () => {
            const user = await h.createUser();
            const res = await h.api("POST", "/api/orders/buy", { token: user.token, body });
            assert.equal(res.status, 400);
            assert.equal((await h.pool.query("SELECT 1 FROM orders WHERE user_id = $1", [user.id])).rowCount, 0);
        });
    }

    test("requires authentication", async () => {
        const res = await h.api("POST", "/api/orders/buy", { body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        assert.equal(res.status, 401);
    });

    test("boundary amounts ($10 and $10,000) are accepted", async () => {
        const user = await h.createUser();
        for (const amountUsd of [10, 10000]) {
            const res = await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd, paymentMethod: "card" } });
            assert.equal(res.status, 201, `amount ${amountUsd}`);
        }
    });

    test("10 concurrent buys for one user all land with no lost update", async () => {
        const user = await h.createUser();
        const results = await Promise.all(
            Array.from({ length: 10 }, () =>
                h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } })
            )
        );

        assert.ok(results.every((r) => r.status === 201));
        assert.equal((await h.balance(user.id, "BTC")).available, 0.02);
        assert.equal((await h.pool.query("SELECT 1 FROM orders WHERE user_id = $1", [user.id])).rowCount, 10);
        assert.equal((await h.pool.query("SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'BUY'", [user.id])).rowCount, 10);
    });
});

describe("POST /api/orders/sell", () => {
    test("debits crypto and credits USD net of fee", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.5);

        const res = await h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } });

        assert.equal(res.status, 201);
        assert.equal(Number(res.body.order.total), 500, "gross value");
        assert.equal(Number(res.body.order.fee), 5);
        assert.equal(Number(res.body.transaction.total), 495, "net to user");
        assert.equal((await h.balance(user.id, "BTC")).available, 0.49);
        assert.equal((await h.balance(user.id, "USD")).available, 495);
    });

    test("cannot sell more than the balance, and balance is untouched", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.01);

        const res = await h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.02 } });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /insufficient/i);
        assert.equal((await h.balance(user.id, "BTC")).available, 0.01);
        assert.equal((await h.balance(user.id, "USD")).available, 0);
    });

    test("cannot sell an asset the user does not hold", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "ETH", amount: 1 } });
        assert.equal(res.status, 400);
    });

    test("locked funds (pending withdrawal) cannot be sold", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.01);
        await h.pool.query(
            `UPDATE wallet_balances SET available_balance = 0, locked_balance = 0.01
             WHERE asset_symbol = 'BTC' AND wallet_id = (SELECT id FROM wallets WHERE user_id = $1)`, [user.id]
        );

        const res = await h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } });
        assert.equal(res.status, 400);
    });

    for (const [name, body] of [
        ["unsupported asset", { asset: "SHIB", amount: 1 }],
        ["zero amount", { asset: "BTC", amount: 0 }],
        ["negative amount", { asset: "BTC", amount: -1 }],
        ["non-numeric amount", { asset: "BTC", amount: "lots" }],
        ["below $10 value", { asset: "BTC", amount: 0.0001 }],
        ["above $10,000 value", { asset: "BTC", amount: 1 }]
    ]) {
        test(`rejects ${name} with 400`, async () => {
            const user = await h.createUser();
            await h.fund(user.id, "BTC", 5);
            const res = await h.api("POST", "/api/orders/sell", { token: user.token, body });
            assert.equal(res.status, 400);
            assert.equal((await h.balance(user.id, "BTC")).available, 5);
        });
    }

    test("5 concurrent sells with funds for only 4: exactly 4 succeed, balance never negative", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.04); // 0.01 BTC per sale

        const results = await Promise.all(
            Array.from({ length: 5 }, () => h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } }))
        );

        assert.equal(results.filter((r) => r.status === 201).length, 4);
        assert.equal(results.filter((r) => r.status === 400).length, 1);
        assert.equal((await h.balance(user.id, "BTC")).available, 0);
        assert.equal((await h.balance(user.id, "USD")).available, 4 * 495);
    });

    test("concurrent buy and sell interleave without corrupting the balance", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.1);

        const ops = [
            ...Array.from({ length: 5 }, () => h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 500, paymentMethod: "card" } })),
            ...Array.from({ length: 5 }, () => h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } }))
        ];
        const results = await Promise.all(ops);

        assert.ok(results.every((r) => r.status === 201));
        // +5 * 0.01 (buys of $500) - 5 * 0.01 (sells) => unchanged
        assert.equal((await h.balance(user.id, "BTC")).available, 0.1);
    });
});

describe("order & transaction reads", () => {
    test("GET /api/orders lists own orders, filters by side, paginates", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 1);
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        await h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } });

        const all = await h.api("GET", "/api/orders", { token: user.token });
        assert.equal(all.status, 200);
        assert.equal(all.body.orders.length, 3);

        const sells = await h.api("GET", "/api/orders?side=SELL", { token: user.token });
        assert.equal(sells.body.orders.length, 1);
        assert.equal(sells.body.orders[0].side, "SELL");

        const paged = await h.api("GET", "/api/orders?limit=2&page=2", { token: user.token });
        assert.equal(paged.body.orders.length, 1);
    });

    test("a user cannot read another user's order or transaction (404, not 403/200)", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        const buy = await h.api("POST", "/api/orders/buy", { token: alice.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });

        assert.equal((await h.api("GET", `/api/orders/${buy.body.order.id}`, { token: alice.token })).status, 200);
        assert.equal((await h.api("GET", `/api/orders/${buy.body.order.id}`, { token: bob.token })).status, 404);
        assert.equal((await h.api("GET", `/api/transactions/${buy.body.transaction.id}`, { token: alice.token })).status, 200);
        assert.equal((await h.api("GET", `/api/transactions/${buy.body.transaction.id}`, { token: bob.token })).status, 404);

        const bobList = await h.api("GET", "/api/orders", { token: bob.token });
        assert.equal(bobList.body.orders.length, 0);
    });

    test("transactions filter by type (incl. comma-separated), asset, and paginate", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 1);
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "ETH", amountUsd: 100, paymentMethod: "card" } });
        await h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } });

        const buys = await h.api("GET", "/api/transactions?type=BUY", { token: user.token });
        assert.equal(buys.body.transactions.length, 2);

        const buysAndSells = await h.api("GET", "/api/transactions?type=BUY,SELL", { token: user.token });
        assert.equal(buysAndSells.body.pagination.total, 3);

        const eth = await h.api("GET", "/api/transactions?asset=ETH", { token: user.token });
        assert.equal(eth.body.transactions.length, 1);

        const page = await h.api("GET", "/api/transactions?limit=1&page=3", { token: user.token });
        assert.equal(page.body.transactions.length, 1);
        assert.equal(page.body.pagination.totalPages, 3);
    });

    test("transaction filters are injection-safe", async () => {
        const user = await h.createUser();
        const res = await h.api("GET", `/api/transactions?type=${encodeURIComponent("BUY' OR '1'='1")}&asset=${encodeURIComponent("x'; DROP TABLE users;--")}`, { token: user.token });
        assert.ok(res.status === 200 || res.status === 400, `got ${res.status}`);
        assert.equal((await h.pool.query("SELECT 1 FROM users LIMIT 1")).rowCount, 1);
    });

    test("GET /api/wallet prices holdings live and totals them", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.1);
        await h.fund(user.id, "USD", 250);

        const res = await h.api("GET", "/api/wallet", { token: user.token });
        assert.equal(res.status, 200);

        const btc = res.body.balances.find((b) => b.assetSymbol === "BTC");
        assert.equal(btc.availableBalance, 0.1);
        assert.equal(btc.usdValue, 5000);
        const usd = res.body.balances.find((b) => b.assetSymbol === "USD");
        assert.equal(usd.usdValue, 250);
    });
});
