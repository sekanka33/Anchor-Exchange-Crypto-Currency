const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");
const { migrate } = require("../../db/migrate");

before(h.start);
after(h.stop);

describe("migrations", () => {
    test("a fresh database (baseline schema.sql + migrations) has every migration recorded", async () => {
        const fs = require("fs");
        const files = fs.readdirSync(require("path").join(__dirname, "../../db/migrations")).filter((f) => f.endsWith(".sql")).sort();
        const applied = (await h.pool.query("SELECT name FROM schema_migrations ORDER BY name")).rows.map((r) => r.name);
        assert.deepEqual(applied, files);
    });

    test("re-running is a no-op", async () => {
        assert.deepEqual(await migrate(h.pool, () => {}), []);
    });

    test("a failing migration rolls back completely and is not recorded", async () => {
        const fs = require("fs");
        const path = require("path");
        const bad = path.join(__dirname, "../../db/migrations/999_broken_test_only.sql");
        fs.writeFileSync(bad, "CREATE TABLE should_not_survive(id int); SELECT nonexistent_column FROM users;");
        try {
            await assert.rejects(migrate(h.pool, () => {}), /999_broken_test_only\.sql failed and was rolled back/);
            assert.equal((await h.pool.query("SELECT to_regclass('should_not_survive') AS t")).rows[0].t, null);
            assert.equal((await h.pool.query("SELECT 1 FROM schema_migrations WHERE name = '999_broken_test_only.sql'")).rowCount, 0);
        } finally {
            fs.unlinkSync(bad);
        }
    });

    test("the production indexes exist", async () => {
        const names = (await h.pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((r) => r.indexname);
        for (const idx of ["idx_deposits_provider_reference", "idx_users_verification_token", "idx_users_reset_token", "idx_orders_user_created", "idx_transactions_user_created"]) {
            assert.ok(names.includes(idx), idx);
        }
    });

    test("the webhook lookup can use its index", async () => {
        await h.pool.query("SET enable_seqscan = off");
        try {
            const plan = (await h.pool.query("EXPLAIN SELECT * FROM deposits WHERE provider_reference = 'x'")).rows.map((r) => r["QUERY PLAN"]).join("\n");
            assert.match(plan, /idx_deposits_provider_reference/);
        } finally {
            await h.pool.query("SET enable_seqscan = on");
        }
    });
});

describe("database-level money invariants", () => {
    test("the DB itself refuses a negative available or locked balance", async () => {
        const user = await h.createUser();
        const wallet = (await h.pool.query("SELECT id FROM wallets WHERE user_id = $1", [user.id])).rows[0].id;

        await assert.rejects(h.pool.query("UPDATE wallet_balances SET available_balance = -1 WHERE wallet_id = $1", [wallet]), /wallet_balances_available_nonnegative/);
        await assert.rejects(h.pool.query("UPDATE wallet_balances SET locked_balance = -0.00000001 WHERE wallet_id = $1", [wallet]), /wallet_balances_locked_nonnegative/);
    });

    test("cascade delete removes every trace of a user (no orphaned financial rows)", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        await h.api("POST", "/api/withdrawals/crypto", { token: user.token, body: { asset: "BTC", network: "BTC", amount: 0.01, address: h.validAddresses.BTC } });

        await h.pool.query("DELETE FROM users WHERE id = $1", [user.id]);

        for (const table of ["wallets", "orders", "transactions", "withdrawals", "notifications", "deposits"]) {
            assert.equal((await h.pool.query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [user.id])).rowCount, 0, table);
        }
    });

    test("duplicate emails are rejected at the DB level, case-sensitively as designed", async () => {
        const user = await h.createUser();
        await assert.rejects(
            h.pool.query("INSERT INTO users(email, password) VALUES($1, 'x')", [user.email]),
            /users_email_key/
        );
    });
});
