const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

const ADMIN_GETS = ["/api/admin/stats", "/api/admin/stats/history", "/api/admin/users", "/api/admin/transactions", "/api/admin/deposits", "/api/admin/withdrawals", "/api/admin/orders"];

describe("admin authorization", () => {
    test("unauthenticated requests are 401 on every admin route", async () => {
        for (const path of ADMIN_GETS) {
            assert.equal((await h.api("GET", path)).status, 401, path);
        }
    });

    test("a regular user gets 403 on every admin route (reads and writes)", async () => {
        const user = await h.createUser();
        const other = await h.createUser();

        for (const path of ADMIN_GETS) {
            assert.equal((await h.api("GET", path, { token: user.token })).status, 403, path);
        }
        assert.equal((await h.api("GET", `/api/admin/users/${other.id}`, { token: user.token })).status, 403);
        assert.equal((await h.api("PATCH", `/api/admin/users/${user.id}/role`, { token: user.token, body: { role: "admin" } })).status, 403);
        assert.equal((await h.api("PATCH", `/api/admin/users/${other.id}/suspension`, { token: user.token, body: { suspended: true } })).status, 403);
        assert.equal((await h.api("POST", "/api/admin/withdrawals/1/reject", { token: user.token })).status, 403);

        const row = (await h.pool.query("SELECT role, is_suspended FROM users WHERE id = ANY($1)", [[user.id, other.id]])).rows;
        assert.ok(row.every((r) => r.role === "user" && r.is_suspended === false), "no privilege change may have occurred");
    });

    test("privilege escalation via profile/preferences mass-assignment is impossible", async () => {
        const user = await h.createUser();
        await h.api("PUT", "/api/users/profile", { token: user.token, body: { fullName: "A", surname: "B", country: "C", phoneNumber: "1", role: "admin", is_verified: true } });
        await h.api("PUT", "/api/users/preferences", { token: user.token, body: { theme: "dark", role: "admin" } });

        assert.equal((await h.pool.query("SELECT role FROM users WHERE id = $1", [user.id])).rows[0].role, "user");
        assert.equal((await h.api("GET", "/api/admin/stats", { token: user.token })).status, 403);
    });

    test("register cannot smuggle in a role", async () => {
        const payload = h.registerPayload({ role: "admin", is_verified: true });
        const res = await h.api("POST", "/api/auth/register", { body: payload });
        const row = (await h.pool.query("SELECT role, is_verified FROM users WHERE id = $1", [res.body.user.id])).rows[0];
        assert.equal(row.role, "user");
        assert.equal(row.is_verified, false);
    });

    test("role is read fresh from the DB: demoting an admin revokes their existing token immediately", async () => {
        const admin = await h.createUser({ role: "admin" });
        assert.equal((await h.api("GET", "/api/admin/stats", { token: admin.token })).status, 200);

        await h.pool.query("UPDATE users SET role = 'user' WHERE id = $1", [admin.id]);

        assert.equal((await h.api("GET", "/api/admin/stats", { token: admin.token })).status, 403);
    });

    test("a JWT claiming role=admin for a non-admin is ignored", async () => {
        const jwt = require("jsonwebtoken");
        const user = await h.createUser();
        const forged = jwt.sign({ id: user.id, email: user.email, role: "admin" }, process.env.JWT_SECRET);
        assert.equal((await h.api("GET", "/api/admin/stats", { token: forged })).status, 403);
    });
});

describe("admin capabilities", () => {
    test("stats, user list (with search), and user detail work for an admin", async () => {
        const admin = await h.createUser({ role: "admin" });
        const target = await h.createUser({ fullName: "Zaphod" });

        const stats = await h.api("GET", "/api/admin/stats", { token: admin.token });
        assert.equal(stats.status, 200);
        assert.ok(stats.body.users.total >= 2);

        const list = await h.api("GET", `/api/admin/users?search=${encodeURIComponent(target.email)}`, { token: admin.token });
        assert.equal(list.status, 200);
        assert.equal(list.body.users.length, 1);
        assert.equal(list.body.users[0].password, undefined, "password hashes must not be exposed to admins either");

        const detail = await h.api("GET", `/api/admin/users/${target.id}`, { token: admin.token });
        assert.equal(detail.status, 200);
        assert.equal(JSON.stringify(detail.body).includes("$2b$"), false);
    });

    test("promote then demote a user", async () => {
        const admin = await h.createUser({ role: "admin" });
        const target = await h.createUser();

        assert.equal((await h.api("PATCH", `/api/admin/users/${target.id}/role`, { token: admin.token, body: { role: "admin" } })).status, 200);
        assert.equal((await h.api("GET", "/api/admin/stats", { token: target.token })).status, 200);
        assert.equal((await h.api("PATCH", `/api/admin/users/${target.id}/role`, { token: admin.token, body: { role: "user" } })).status, 200);
        assert.equal((await h.api("GET", "/api/admin/stats", { token: target.token })).status, 403);
    });

    test("role and suspension payloads are validated", async () => {
        const admin = await h.createUser({ role: "admin" });
        const target = await h.createUser();
        assert.equal((await h.api("PATCH", `/api/admin/users/${target.id}/role`, { token: admin.token, body: { role: "superuser" } })).status, 400);
        assert.equal((await h.api("PATCH", `/api/admin/users/${target.id}/suspension`, { token: admin.token, body: { suspended: "yes" } })).status, 400);
        assert.equal((await h.api("PATCH", "/api/admin/users/999999/role", { token: admin.token, body: { role: "user" } })).status, 404);
    });

    test("an admin cannot suspend themselves", async () => {
        const admin = await h.createUser({ role: "admin" });
        assert.equal((await h.api("PATCH", `/api/admin/users/${admin.id}/suspension`, { token: admin.token, body: { suspended: true } })).status, 400);
        assert.equal((await h.pool.query("SELECT is_suspended FROM users WHERE id = $1", [admin.id])).rows[0].is_suspended, false);
    });

    test("the last remaining admin cannot demote themselves, but can once another admin exists", async () => {
        await h.pool.query("UPDATE users SET role = 'user' WHERE role = 'admin'");
        const only = await h.createUser({ role: "admin" });

        const blocked = await h.api("PATCH", `/api/admin/users/${only.id}/role`, { token: only.token, body: { role: "user" } });
        assert.equal(blocked.status, 400);
        assert.match(blocked.body.message, /last remaining admin/i);
        assert.equal((await h.pool.query("SELECT role FROM users WHERE id = $1", [only.id])).rows[0].role, "admin");

        const second = await h.createUser({ role: "admin" });
        assert.equal((await h.api("PATCH", `/api/admin/users/${only.id}/role`, { token: only.token, body: { role: "user" } })).status, 200);
        assert.equal((await h.api("PATCH", `/api/admin/users/${second.id}/role`, { token: second.token, body: { role: "user" } })).status, 400, "second is now the last admin");
    });

    test("suspension blocks login and reinstatement restores it", async () => {
        const admin = await h.createUser({ role: "admin" });
        const target = await h.createUser();
        const login = () => h.api("POST", "/api/auth/login", { body: { email: target.email, password: target.password } });

        await h.api("PATCH", `/api/admin/users/${target.id}/suspension`, { token: admin.token, body: { suspended: true } });
        assert.equal((await login()).status, 403);

        await h.api("PATCH", `/api/admin/users/${target.id}/suspension`, { token: admin.token, body: { suspended: false } });
        assert.equal((await login()).status, 200);
    });

    test("admin can reject a pending withdrawal (funds released) but not a completed one", async () => {
        const admin = await h.createUser({ role: "admin" });
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const body = { asset: "BTC", network: "BTC", amount: 0.01, address: h.validAddresses.BTC };

        const pending = await h.api("POST", "/api/withdrawals/crypto", { token: user.token, body });
        const pendingId = pending.body.withdrawal.id;
        assert.equal((await h.api("POST", `/api/admin/withdrawals/${pendingId}/reject`, { token: admin.token })).status, 400, "a reason is required");
        assert.equal((await h.api("POST", `/api/admin/withdrawals/${pendingId}/reject`, { token: admin.token, body: { reason: "Suspected account takeover" } })).status, 200);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.05, locked: 0 });
        assert.equal((await h.pool.query("SELECT status FROM withdrawals WHERE id = $1", [pendingId])).rows[0].status, "REJECTED");
        const audit = (await h.pool.query("SELECT actor_user_id, reason FROM audit_logs WHERE action = 'WITHDRAWAL_REJECT' AND target_id = $1", [String(pendingId)])).rows;
        assert.deepEqual(audit, [{ actor_user_id: admin.id, reason: "Suspected account takeover" }]);

        const done = await h.api("POST", "/api/withdrawals/crypto", { token: user.token, body });
        const { confirmation_token } = (await h.pool.query("SELECT confirmation_token FROM withdrawals WHERE id = $1", [done.body.withdrawal.id])).rows[0];
        await h.api("GET", `/api/withdrawals/confirm?token=${confirmation_token}`);
        assert.equal((await h.api("POST", `/api/admin/withdrawals/${done.body.withdrawal.id}/reject`, { token: admin.token, body: { reason: "Too late to stop" } })).status, 404);
        await h.waitFor(async () => (await h.balance(user.id, "BTC")).locked === 0, { message: "payout settled" });
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0.04, locked: 0 });
    });
});

describe("admin analytics", () => {
    test("stats reflect a new trade: volume, order status counts and active users", async () => {
        const admin = await h.createUser({ role: "admin" });
        const before = (await h.api("GET", "/api/admin/stats", { token: admin.token })).body;

        const trader = await h.createUser();
        await h.fund(trader.id, "USD", 1000);
        const buy = await h.api("POST", "/api/orders/buy", { token: trader.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        assert.equal(buy.status, 201);
        const total = Number(buy.body.order.total);

        const after = (await h.api("GET", "/api/admin/stats", { token: admin.token })).body;
        assert.equal(after.orders.total, before.orders.total + 1);
        assert.equal(after.orders.statusCounts.COMPLETED, before.orders.statusCounts.COMPLETED + 1);
        assert.ok(Math.abs(after.orders.volumeUsd - before.orders.volumeUsd - total) < 1e-6);
        assert.ok(Math.abs(after.orders.volumeLast30DaysUsd - before.orders.volumeLast30DaysUsd - total) < 1e-6);
        assert.equal(after.users.activeLast30Days, before.users.activeLast30Days + 1);
        assert.ok("FAILED" in after.deposits.statusCounts && "EXPIRED" in after.withdrawals.statusCounts);
    });

    test("history buckets each range and attributes today's trade to the last bucket", async () => {
        const admin = await h.createUser({ role: "admin" });
        const expected = { "7d": 7, "30d": 30, "90d": 13, "180d": 26, "1y": 12 };

        for (const [range, buckets] of Object.entries(expected)) {
            const res = await h.api("GET", `/api/admin/stats/history?range=${range}`, { token: admin.token });
            assert.equal(res.status, 200, range);
            assert.equal(res.body.range, range);
            assert.equal(res.body.series.length, buckets, range);
        }

        const before = (await h.api("GET", "/api/admin/stats/history?range=7d", { token: admin.token })).body;
        const trader = await h.createUser();
        await h.fund(trader.id, "USD", 1000);
        const buy = await h.api("POST", "/api/orders/buy", { token: trader.token, body: { asset: "ETH", amountUsd: 50, paymentMethod: "card" } });
        assert.equal(buy.status, 201);

        const after = (await h.api("GET", "/api/admin/stats/history?range=7d", { token: admin.token })).body;
        const last = (r) => r.series[r.series.length - 1];
        assert.ok(Math.abs(last(after).buyVolumeUsd - last(before).buyVolumeUsd - Number(buy.body.order.total)) < 1e-6);
        assert.equal(last(after).newUsers, last(before).newUsers + 1);
        assert.ok(after.topAssets.some((a) => a.asset === "ETH" && a.trades >= 1));
    });

    test("an unknown range falls back to 30 days instead of erroring", async () => {
        const admin = await h.createUser({ role: "admin" });
        const res = await h.api("GET", "/api/admin/stats/history?range=DROP%20TABLE", { token: admin.token });
        assert.equal(res.status, 200);
        assert.equal(res.body.range, "30d");
        assert.equal(res.body.series.length, 30);
    });
});

describe("cross-user data isolation", () => {
    test("every list endpoint only ever returns the caller's own rows", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        await h.fund(alice.id, "BTC", 1);
        await h.api("POST", "/api/orders/buy", { token: alice.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });
        await h.api("POST", "/api/withdrawals/crypto", { token: alice.token, body: { asset: "BTC", network: "BTC", amount: 0.01, address: h.validAddresses.BTC } });
        await h.api("POST", "/api/deposits/fiat", { token: alice.token, body: { amount: 100, paymentMethod: "card" } });

        for (const [path, key] of [
            ["/api/orders", "orders"], ["/api/transactions", "transactions"], ["/api/withdrawals", "withdrawals"],
            ["/api/deposits", "deposits"], ["/api/notifications", "notifications"], ["/api/wallet/transactions", "transactions"]
        ]) {
            const res = await h.api("GET", path, { token: bob.token });
            assert.equal(res.status, 200, path);
            const rows = res.body[key];
            // Bob only has his own welcome notification; nothing of Alice's may appear.
            assert.ok(rows.every((r) => r.user_id === undefined || r.user_id === bob.id), path);
            if (key !== "notifications") assert.equal(rows.length, 0, path);
        }

        const wallet = await h.api("GET", "/api/wallet", { token: bob.token });
        assert.equal(wallet.body.balances.find((b) => b.assetSymbol === "BTC"), undefined);
    });

    test("a token for user A can never be used to act as user B via path/body ids", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        await h.fund(bob.id, "BTC", 0.05);
        const req = await h.api("POST", "/api/withdrawals/crypto", { token: bob.token, body: { asset: "BTC", network: "BTC", amount: 0.01, address: h.validAddresses.BTC } });

        const attempt = await h.api("POST", "/api/orders/buy", { token: alice.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card", userId: bob.id, user_id: bob.id } });
        assert.equal(attempt.status, 201);
        assert.equal((await h.balance(bob.id, "BTC")).available, 0.04, "bob's balance must not receive alice's purchase");
        assert.ok((await h.balance(alice.id, "BTC")).available > 0);
        assert.equal((await h.api("POST", `/api/withdrawals/${req.body.withdrawal.id}/cancel`, { token: alice.token })).status, 404);
    });

    test("notifications: mark-read only affects the caller's own notification", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        await h.waitFor(async () => (await h.pool.query("SELECT 1 FROM notifications WHERE user_id = $1", [alice.id])).rowCount > 0, { message: "alice notification" });
        const { id } = (await h.pool.query("SELECT id FROM notifications WHERE user_id = $1", [alice.id])).rows[0];

        assert.equal((await h.api("PATCH", `/api/notifications/${id}/read`, { token: bob.token })).status, 404);
        assert.equal((await h.pool.query("SELECT is_read FROM notifications WHERE id = $1", [id])).rows[0].is_read, false);
        assert.equal((await h.api("PATCH", `/api/notifications/${id}/read`, { token: alice.token })).status, 200);
    });
});

// Customer-only APIs: an administrator manages the exchange, they don't trade on it.
const CUSTOMER_REQUESTS = [
    ["GET", "/api/wallet"], ["GET", "/api/wallet/transactions"],
    ["GET", "/api/orders"], ["POST", "/api/orders/buy"], ["POST", "/api/orders/sell"],
    ["GET", "/api/deposits"], ["POST", "/api/deposits/fiat"], ["GET", "/api/deposits/crypto/networks"],
    ["GET", "/api/withdrawals"], ["POST", "/api/withdrawals/crypto"], ["POST", "/api/withdrawals/fiat"],
    ["GET", "/api/transactions"], ["GET", "/api/users/stats"],
];

describe("role separation", () => {
    test("an admin gets 403 on every customer API, and no money moves", async () => {
        const admin = await h.createUser({ role: "admin" });
        for (const [method, url] of CUSTOMER_REQUESTS) {
            const body = method === "POST" ? { asset: "BTC", amountUsd: 100, paymentMethod: "bank", amount: 100 } : undefined;
            const res = await h.api(method, url, { token: admin.token, body });
            assert.equal(res.status, 403, `${method} ${url}`);
            assert.match(res.body.message, /administrator/i, `${method} ${url}`);
        }
        assert.equal((await h.pool.query("SELECT count(*)::int n FROM orders WHERE user_id = $1", [admin.id])).rows[0].n, 0);
    });

    test("a regular user still reaches the customer APIs", async () => {
        const user = await h.createUser();
        for (const url of ["/api/wallet", "/api/orders", "/api/deposits", "/api/withdrawals", "/api/transactions", "/api/users/stats"]) {
            assert.equal((await h.api("GET", url, { token: user.token })).status, 200, url);
        }
    });

    test("both roles can read their own profile, which reports the role from the DB", async () => {
        const admin = await h.createUser({ role: "admin" });
        const user = await h.createUser();
        assert.equal((await h.api("GET", "/api/users/profile", { token: admin.token })).body.user.role, "admin");
        assert.equal((await h.api("GET", "/api/users/profile", { token: user.token })).body.user.role, "user");
        assert.equal((await h.api("GET", "/api/notifications", { token: admin.token })).status, 200);
    });

    test("promoting a user cuts off their customer access on the very next request", async () => {
        const user = await h.createUser();
        assert.equal((await h.api("GET", "/api/wallet", { token: user.token })).status, 200);
        await h.pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
        assert.equal((await h.api("GET", "/api/wallet", { token: user.token })).status, 403);
        assert.equal((await h.api("GET", "/api/admin/stats", { token: user.token })).status, 200);
    });

    test("suspending an account invalidates its existing token immediately", async () => {
        const user = await h.createUser();
        await h.pool.query("UPDATE users SET is_suspended = true WHERE id = $1", [user.id]);
        for (const url of ["/api/wallet", "/api/users/profile", "/api/notifications"]) {
            const res = await h.api("GET", url, { token: user.token });
            assert.equal(res.status, 403, url);
            assert.match(res.body.message, /suspended/i, url);
        }
    });

    test("a token for a deleted account is no longer a session (401)", async () => {
        const jwt = require("jsonwebtoken");
        const ghost = jwt.sign({ id: 2147483000, email: "ghost@test.local" }, process.env.JWT_SECRET, { expiresIn: "1h" });
        assert.equal((await h.api("GET", "/api/users/profile", { token: ghost })).status, 401);
    });

    test("the emailed withdrawal-confirmation link stays public (no session needed)", async () => {
        const res = await h.api("GET", "/api/withdrawals/confirm");
        assert.notEqual(res.status, 401);
        assert.notEqual(res.status, 403);
    });

    test("the database only accepts known roles", async () => {
        const user = await h.createUser();
        await assert.rejects(h.pool.query("UPDATE users SET role = 'superuser' WHERE id = $1", [user.id]), /users_role_valid/);
        await assert.rejects(h.pool.query("UPDATE users SET role = NULL WHERE id = $1", [user.id]), /null value/);
    });
});

describe("scripts/set-role.js (first-admin setup)", () => {
    const run = (...args) => new Promise((resolve) => {
        execFile(process.execPath, [path.join(__dirname, "../../scripts/set-role.js"), ...args], { env: process.env }, (error, stdout, stderr) => {
            resolve({ code: error ? error.code : 0, out: stdout + stderr });
        });
    });

    test("promotes and demotes an existing account, and refuses bad input", async () => {
        const user = await h.createUser();
        const promoted = await run(user.email, "admin");
        assert.equal(promoted.code, 0, promoted.out);
        assert.equal((await h.api("GET", "/api/admin/stats", { token: user.token })).status, 200);

        assert.equal((await run(user.email, "user")).code, 0);
        assert.equal((await h.api("GET", "/api/admin/stats", { token: user.token })).status, 403);

        assert.notEqual((await run(user.email, "superuser")).code, 0);
        assert.notEqual((await run("nobody-here@test.local", "admin")).code, 0);
    });

    test("refuses to demote the last remaining admin", async () => {
        await h.pool.query("UPDATE users SET role = 'user' WHERE role = 'admin'");
        const only = await h.createUser({ role: "admin" });
        const res = await run(only.email, "user");
        assert.notEqual(res.code, 0);
        assert.match(res.out, /last remaining admin/i);
        assert.equal((await h.pool.query("SELECT role FROM users WHERE id = $1", [only.id])).rows[0].role, "admin");
    });
});
