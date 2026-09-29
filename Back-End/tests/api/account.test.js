const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

describe("profile", () => {
    test("GET /api/users/profile returns own profile without secrets", async () => {
        const user = await h.createUser({ fullName: "Ada" });
        const res = await h.api("GET", "/api/users/profile", { token: user.token });

        assert.equal(res.status, 200);
        assert.equal(res.body.user.fullname, "Ada");
        assert.equal(res.body.user.password, undefined);
        assert.equal(res.body.user.reset_token, undefined);
        assert.equal(res.body.user.verification_token, undefined);
    });

    test("PUT /api/users/profile updates allowed fields and validates", async () => {
        const user = await h.createUser();
        const ok = await h.api("PUT", "/api/users/profile", { token: user.token, body: { fullName: "New", surname: "Name", country: "Kenya", phoneNumber: "+254700" } });
        assert.equal(ok.status, 200);
        assert.equal((await h.api("GET", "/api/users/profile", { token: user.token })).body.user.country, "Kenya");

        const missing = await h.api("PUT", "/api/users/profile", { token: user.token, body: { fullName: "x" } });
        assert.equal(missing.status, 400);

        const tooLong = await h.api("PUT", "/api/users/profile", { token: user.token, body: { fullName: "x".repeat(101), surname: "a", country: "b", phoneNumber: "1" } });
        assert.equal(tooLong.status, 400);
    });

    test("profile fields are stored verbatim (output encoding is the renderer's job, but nothing is executed server-side)", async () => {
        const user = await h.createUser();
        const xss = `<script>alert(1)</script>`;
        const res = await h.api("PUT", "/api/users/profile", { token: user.token, body: { fullName: xss, surname: "a", country: "b", phoneNumber: "1" } });
        assert.equal(res.status, 200);
        assert.equal((await h.api("GET", "/api/users/profile", { token: user.token })).body.user.fullname, xss);
    });
});

describe("preferences", () => {
    test("accepts valid values and merges with existing preferences", async () => {
        const user = await h.createUser();
        const res = await h.api("PUT", "/api/users/preferences", { token: user.token, body: { theme: "light", currency: "EUR" } });
        assert.equal(res.status, 200);

        const prefs = (await h.api("GET", "/api/users/profile", { token: user.token })).body.user.preferences;
        assert.equal(prefs.theme, "light");
        assert.equal(prefs.currency, "EUR");
        assert.equal(prefs.emailNotifications, true, "untouched keys survive");
    });

    for (const [name, body] of [
        ["bad theme", { theme: "neon" }],
        ["bad currency", { currency: "DOGE" }],
        ["bad language", { language: "klingon" }],
        ["non-boolean emailNotifications", { emailNotifications: "sure" }]
    ]) {
        test(`rejects ${name}`, async () => {
            const user = await h.createUser();
            assert.equal((await h.api("PUT", "/api/users/preferences", { token: user.token, body })).status, 400);
        });
    }
});

describe("change password", () => {
    test("requires the correct current password, then swaps credentials", async () => {
        const user = await h.createUser();

        const wrong = await h.api("POST", "/api/users/change-password", { token: user.token, body: { currentPassword: "nope", newPassword: "NewPassw0rd!" } });
        assert.equal(wrong.status, 401);

        const ok = await h.api("POST", "/api/users/change-password", { token: user.token, body: { currentPassword: user.password, newPassword: "NewPassw0rd!" } });
        assert.equal(ok.status, 200);

        assert.equal((await h.api("POST", "/api/auth/login", { body: { email: user.email, password: user.password } })).status, 401);
        assert.equal((await h.api("POST", "/api/auth/login", { body: { email: user.email, password: "NewPassw0rd!" } })).status, 200);
    });

    test("rejects short or missing new password", async () => {
        const user = await h.createUser();
        assert.equal((await h.api("POST", "/api/users/change-password", { token: user.token, body: { currentPassword: user.password, newPassword: "short" } })).status, 400);
        assert.equal((await h.api("POST", "/api/users/change-password", { token: user.token, body: { currentPassword: user.password } })).status, 400);
    });

    test("requires authentication", async () => {
        assert.equal((await h.api("POST", "/api/users/change-password", { body: { currentPassword: "a", newPassword: "bbbbbbbb" } })).status, 401);
    });
});

describe("notifications", () => {
    test("lists, counts unread, paginates, marks one and all as read", async () => {
        const user = await h.createUser();
        for (let i = 0; i < 4; i++) {
            await h.pool.query("INSERT INTO notifications(user_id, title, message) VALUES($1, $2, 'm')", [user.id, `n${i}`]);
        }
        await h.waitFor(async () => (await h.api("GET", "/api/notifications", { token: user.token })).body.pagination.total >= 5, { message: "5 notifications" });

        const list = await h.api("GET", "/api/notifications?limit=2&page=1", { token: user.token });
        assert.equal(list.body.notifications.length, 2);
        assert.equal(list.body.unreadCount, 5);
        assert.ok(list.body.pagination.totalPages >= 3);

        await h.api("PATCH", `/api/notifications/${list.body.notifications[0].id}/read`, { token: user.token });
        assert.equal((await h.api("GET", "/api/notifications", { token: user.token })).body.unreadCount, 4);

        await h.api("PATCH", "/api/notifications/read-all", { token: user.token });
        assert.equal((await h.api("GET", "/api/notifications", { token: user.token })).body.unreadCount, 0);
    });

    test("marking a non-existent notification returns 404", async () => {
        const user = await h.createUser();
        assert.equal((await h.api("PATCH", "/api/notifications/99999999/read", { token: user.token })).status, 404);
    });
});

describe("financial actions create user-visible notifications", () => {
    test("a buy produces a notification linking to /orderstrades", async () => {
        const user = await h.createUser();
        await h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } });

        const n = await h.waitFor(async () => {
            const r = await h.pool.query("SELECT * FROM notifications WHERE user_id = $1 AND title = 'Buy order completed'", [user.id]);
            return r.rows[0];
        }, { message: "buy notification" });
        assert.equal(n.link, "/orderstrades");
    });
});

describe("market data proxy", () => {
    test("proxies coins list, global data, coin detail, price and ticker (public, no auth)", async () => {
        assert.equal((await h.api("GET", "/api/markets/coins")).status, 200);
        assert.equal((await h.api("GET", "/api/markets/global")).status, 200);
        assert.equal((await h.api("GET", "/api/markets/coins/bitcoin")).status, 200);
        const price = await h.api("GET", "/api/markets/price?ids=bitcoin&vs=usd");
        assert.equal(price.status, 200);
        const ticker = await h.api("GET", "/api/markets/ticker/BTCUSDT");
        assert.equal(ticker.status, 200);
    });

    test("responses are cached (repeat call does not hit the upstream)", async () => {
        await h.api("GET", "/api/markets/coins?perPage=7&page=3");
        const before = h.upstream.calls;
        await h.api("GET", "/api/markets/coins?perPage=7&page=3");
        assert.equal(h.upstream.calls, before);
    });

    test("an uncached upstream failure surfaces as 502, not a crash or a leaked stack trace", async () => {
        h.upstream.fail = true;
        try {
            const res = await h.api("GET", "/api/markets/coins?perPage=11&page=9");
            assert.equal(res.status, 502);
            assert.equal(JSON.stringify(res.body).includes("upstream"), false, "upstream error details must not leak");
        } finally {
            h.upstream.fail = false;
        }
    });

    test("the server never exposes the CoinGecko API key to clients", async () => {
        const res = await h.api("GET", "/api/markets/coins");
        assert.equal(JSON.stringify(res.body).toLowerCase().includes("x-cg"), false);
    });
});

describe("QR login", () => {
    test("init issues a token with an expiring Redis session", async () => {
        const res = await h.api("GET", "/api/qr/init");
        assert.equal(res.status, 200);
        assert.ok(res.body.qr_token);
        assert.equal(res.body.expires_in, 60);
    });

    test("REGRESSION: an arbitrary string as Bearer token must not authenticate (was treated as a userId)", async () => {
        const init = await h.api("GET", "/api/qr/init");
        for (const token of ["1", "admin", "not.a.jwt", "1; DROP TABLE users"]) {
            const res = await h.api("POST", "/api/qr/verify", { token, body: { qr_token: init.body.qr_token } });
            assert.equal(res.status, 401, `token=${token}`);
        }
    });

    test("a JWT signed with the wrong secret is rejected", async () => {
        const jwt = require("jsonwebtoken");
        const init = await h.api("GET", "/api/qr/init");
        const forged = jwt.sign({ id: 1 }, "wrong-secret");
        assert.equal((await h.api("POST", "/api/qr/verify", { token: forged, body: { qr_token: init.body.qr_token } })).status, 401);
    });

    test("missing qr_token -> 400, missing Authorization -> 401", async () => {
        const user = await h.createUser();
        assert.equal((await h.api("POST", "/api/qr/verify", { token: user.token, body: {} })).status, 400);
        assert.equal((await h.api("POST", "/api/qr/verify", { body: { qr_token: "x" } })).status, 401);
    });

    test("a suspended user's valid token cannot approve a QR login", async () => {
        const user = await h.createUser();
        await h.pool.query("UPDATE users SET is_suspended = true WHERE id = $1", [user.id]);
        const init = await h.api("GET", "/api/qr/init");
        assert.equal((await h.api("POST", "/api/qr/verify", { token: user.token, body: { qr_token: init.body.qr_token } })).status, 403);
    });

    test("an unknown/expired QR session cannot be approved", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/qr/verify", { token: user.token, body: { qr_token: "does-not-exist" } });
        assert.ok(res.status >= 400 && res.status < 500, `got ${res.status}`);
    });
});
