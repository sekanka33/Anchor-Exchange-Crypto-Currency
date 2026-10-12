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
        for (const idx of ["uq_deposits_provider_reference", "idx_users_verification_token", "idx_users_reset_token", "idx_orders_user_created", "idx_transactions_user_created"]) {
            assert.ok(names.includes(idx), idx);
        }
    });

    test("the webhook lookup can use its index", async () => {
        await h.pool.query("SET enable_seqscan = off");
        try {
            const plan = (await h.pool.query("EXPLAIN SELECT * FROM deposits WHERE provider_reference = 'x'")).rows.map((r) => r["QUERY PLAN"]).join("\n");
            assert.match(plan, /uq_deposits_provider_reference/);
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

    test("a user with no financial history is deleted cleanly (no orphaned rows)", async () => {
        const user = await h.createUser();
        await h.api("GET", "/api/deposits/crypto/address?asset=BTC&network=BTC", { token: user.token });

        await h.pool.query("DELETE FROM users WHERE id = $1", [user.id]);

        for (const table of ["wallets", "orders", "transactions", "withdrawals", "notifications", "deposits", "deposit_addresses"]) {
            assert.equal((await h.pool.query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [user.id])).rowCount, 0, table);
        }
    });

    test("a user with financial history can't be deleted: the ledger keeps the records", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });

        await assert.rejects(h.pool.query("DELETE FROM users WHERE id = $1", [user.id]), /ledger_entries/);
        assert.equal((await h.pool.query("SELECT 1 FROM orders WHERE user_id = $1", [user.id])).rowCount, 1);
    });

    test("duplicate emails are rejected at the DB level, case-sensitively as designed", async () => {
        const user = await h.createUser();
        await assert.rejects(
            h.pool.query("INSERT INTO users(email, password) VALUES($1, 'x')", [user.email]),
            /users_email_key/
        );
    });
});

describe("ledger invariants (enforced by the database)", () => {
    const ledger = require("../../services/ledger");

    const inTx = async (work) => {
        const client = await h.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await work(client);
            await client.query("COMMIT");
            return result;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    };

    test("a journal that doesn't balance is rejected at commit, even if written by hand", async () => {
        await assert.rejects(inTx(async (client) => {
            const j = (await client.query("INSERT INTO ledger_journals (journal_key, kind) VALUES ('manual-unbalanced', 'TEST') RETURNING id")).rows[0].id;
            await client.query("INSERT INTO ledger_entries (journal_id, account, asset, amount) VALUES ($1, 'platform:fees', 'USD', 10)", [j]);
            await client.query("INSERT INTO ledger_entries (journal_id, account, asset, amount) VALUES ($1, 'platform:trading', 'USD', -9)", [j]);
        }), /does not balance/);
        assert.equal((await h.pool.query("SELECT 1 FROM ledger_journals WHERE journal_key = 'manual-unbalanced'")).rowCount, 0);
    });

    test("posted ledger entries, journals and audit logs can't be edited or deleted", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 10);
        await h.pool.query("INSERT INTO audit_logs (action) VALUES ('TEST')");

        await assert.rejects(h.pool.query("UPDATE ledger_entries SET amount = amount * 2 WHERE user_id = $1", [user.id]), /append-only/);
        await assert.rejects(h.pool.query("DELETE FROM ledger_entries WHERE user_id = $1", [user.id]), /append-only/);
        await assert.rejects(h.pool.query("UPDATE ledger_journals SET kind = 'X' WHERE kind = 'TEST_FUNDING'"), /append-only/);
        await assert.rejects(h.pool.query("DELETE FROM audit_logs WHERE action = 'TEST'"), /append-only/);
    });

    test("the same journal key posts once; a journal can't overdraw a customer", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "USD", 50);
        const move = (key, amount) => inTx((client) => ledger.postJournal(client, {
            key, kind: "TEST",
            entries: [{ account: ledger.account.available(user.id), asset: "USD", amount: `-${amount}` }, { account: "platform:fees", asset: "USD", amount: String(amount) }]
        }));

        assert.deepEqual(await move("test:once", 10), { duplicate: false, journalId: (await h.pool.query("SELECT id FROM ledger_journals WHERE journal_key = 'test:once'")).rows[0]?.id ?? (await h.pool.query("SELECT MAX(id) AS id FROM ledger_journals")).rows[0].id });
        assert.deepEqual(await move("test:once", 10), { duplicate: true });
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 40, locked: 0 });

        await assert.rejects(move("test:overdraw", 41), /Insufficient balance/);
        assert.deepEqual(await h.balance(user.id, "USD"), { available: 40, locked: 0 });
        await assert.rejects(move("test:unbalanced", 0), /at least two entries|balance/i);
    });

    test("reconciliation detects a balance changed outside the ledger", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "ETH", 2);
        const tamper = (delta) => h.pool.query(
            "UPDATE wallet_balances SET available_balance = available_balance + $2 WHERE asset_symbol = 'ETH' AND wallet_id = (SELECT id FROM wallets WHERE user_id = $1)",
            [user.id, delta]
        );

        await tamper(1);
        const found = await ledger.reconcile(h.pool, { userId: user.id });
        await tamper(-1);

        assert.equal(found.balanceMismatches.length, 1);
        assert.deepEqual(
            { asset: found.balanceMismatches[0].asset, wallet: Number(found.balanceMismatches[0].wallet_available), ledger: Number(found.balanceMismatches[0].ledger_available) },
            { asset: "ETH", wallet: 3, ledger: 2 }
        );
        assert.deepEqual(await ledger.reconcile(h.pool, { userId: user.id }), { balanceMismatches: [], unbalancedJournals: [] });
    });
});
