const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

describe("POST /api/auth/register", () => {
    test("creates a user, an empty USD wallet, and a welcome notification", async () => {
        const payload = h.registerPayload();
        const res = await h.api("POST", "/api/auth/register", { body: payload });

        assert.equal(res.status, 201);
        assert.equal(res.body.user.email, payload.email);
        assert.equal(res.body.user.password, undefined, "password hash must never be returned");

        const bal = await h.balance(res.body.user.id, "USD");
        assert.deepEqual(bal, { available: 0, locked: 0 });

        await h.waitFor(async () => {
            const n = await h.pool.query("SELECT 1 FROM notifications WHERE user_id = $1", [res.body.user.id]);
            return n.rowCount === 1;
        }, { message: "welcome notification" });
    });

    test("stores a bcrypt hash, not the plaintext password", async () => {
        const payload = h.registerPayload();
        const res = await h.api("POST", "/api/auth/register", { body: payload });
        const row = await h.pool.query("SELECT password, is_verified, verification_token FROM users WHERE id = $1", [res.body.user.id]);

        assert.match(row.rows[0].password, /^\$2[aby]\$/);
        assert.notEqual(row.rows[0].password, payload.password);
        assert.equal(row.rows[0].is_verified, false);
        assert.ok(row.rows[0].verification_token);
    });

    test("rejects a duplicate email with 409", async () => {
        const payload = h.registerPayload();
        await h.api("POST", "/api/auth/register", { body: payload });
        const again = await h.api("POST", "/api/auth/register", { body: payload });
        assert.equal(again.status, 409);
    });

    for (const [name, override] of [
        ["invalid email", { email: "not-an-email" }],
        ["missing email", { email: undefined }],
        ["short password", { password: "short" }],
        ["missing full name", { fullName: "" }],
        ["missing phone number", { phoneNumber: undefined }]
    ]) {
        test(`rejects ${name} with 400`, async () => {
            const res = await h.api("POST", "/api/auth/register", { body: h.registerPayload(override) });
            assert.equal(res.status, 400);
        });
    }
});

describe("POST /api/auth/login", () => {
    test("returns a JWT carrying the user id, expiring within the hour", async () => {
        const user = await h.createUser();
        const decoded = jwt.verify(user.token, process.env.JWT_SECRET);

        assert.equal(decoded.id, user.id);
        assert.ok(decoded.exp - decoded.iat <= 3600);
    });

    test("does not include the password hash in the response", async () => {
        const user = await h.createUser();
        const res = await h.api("POST", "/api/auth/login", { body: { email: user.email, password: user.password } });
        assert.equal(res.status, 200);
        assert.equal(JSON.stringify(res.body).includes("$2"), false);
        assert.equal(res.body.user.role, "user");
    });

    test("wrong password and unknown email give the same 401 (no user enumeration)", async () => {
        const user = await h.createUser();
        const wrongPw = await h.api("POST", "/api/auth/login", { body: { email: user.email, password: "nope-nope-nope" } });
        const unknown = await h.api("POST", "/api/auth/login", { body: { email: "ghost@test.local", password: "nope-nope-nope" } });

        assert.equal(wrongPw.status, 401);
        assert.equal(unknown.status, 401);
        assert.equal(wrongPw.body.message, unknown.body.message);
    });

    test("requires both email and password", async () => {
        const res = await h.api("POST", "/api/auth/login", { body: { email: "a@b.co" } });
        assert.equal(res.status, 400);
    });

    test("a suspended account cannot log in", async () => {
        const user = await h.createUser();
        await h.pool.query("UPDATE users SET is_suspended = true WHERE id = $1", [user.id]);
        const res = await h.api("POST", "/api/auth/login", { body: { email: user.email, password: user.password } });
        assert.equal(res.status, 403);
    });

    test("SQL-injection style input is treated as data", async () => {
        const res = await h.api("POST", "/api/auth/login", { body: { email: "' OR '1'='1' --", password: "x" } });
        assert.equal(res.status, 401);
    });
});

describe("email verification", () => {
    test("a valid token verifies the account and is single-use", async () => {
        const reg = await h.api("POST", "/api/auth/register", { body: h.registerPayload() });
        const { verification_token: token } = (await h.pool.query("SELECT verification_token FROM users WHERE id = $1", [reg.body.user.id])).rows[0];

        const ok = await h.api("GET", `/api/auth/verify-email?token=${token}`);
        assert.equal(ok.status, 200);
        assert.equal((await h.pool.query("SELECT is_verified FROM users WHERE id = $1", [reg.body.user.id])).rows[0].is_verified, true);

        const replay = await h.api("GET", `/api/auth/verify-email?token=${token}`);
        assert.equal(replay.status, 400);
    });

    test("an expired token is rejected", async () => {
        const reg = await h.api("POST", "/api/auth/register", { body: h.registerPayload() });
        await h.pool.query("UPDATE users SET verification_token_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [reg.body.user.id]);
        const { verification_token: token } = (await h.pool.query("SELECT verification_token FROM users WHERE id = $1", [reg.body.user.id])).rows[0];

        const res = await h.api("GET", `/api/auth/verify-email?token=${token}`);
        assert.equal(res.status, 400);
    });

    test("a missing or garbage token is rejected", async () => {
        assert.equal((await h.api("GET", "/api/auth/verify-email")).status, 400);
        assert.equal((await h.api("GET", "/api/auth/verify-email?token=garbage")).status, 400);
    });
});

describe("password reset", () => {
    test("forgot-password gives the same answer for known and unknown emails", async () => {
        const user = await h.createUser();
        const known = await h.api("POST", "/api/auth/forgot-password", { body: { email: user.email } });
        const unknown = await h.api("POST", "/api/auth/forgot-password", { body: { email: "ghost@test.local" } });

        assert.equal(known.status, unknown.status);
        assert.equal(known.body.message, unknown.body.message);
    });

    test("a reset token changes the password once; old password stops working", async () => {
        const user = await h.createUser();
        await h.api("POST", "/api/auth/forgot-password", { body: { email: user.email } });
        const { reset_token: token } = (await h.pool.query("SELECT reset_token FROM users WHERE id = $1", [user.id])).rows[0];
        assert.ok(token);

        const reset = await h.api("POST", "/api/auth/reset-password", { body: { token, password: "BrandNewPass1!" } });
        assert.equal(reset.status, 200);

        const oldLogin = await h.api("POST", "/api/auth/login", { body: { email: user.email, password: user.password } });
        const newLogin = await h.api("POST", "/api/auth/login", { body: { email: user.email, password: "BrandNewPass1!" } });
        assert.equal(oldLogin.status, 401);
        assert.equal(newLogin.status, 200);

        const replay = await h.api("POST", "/api/auth/reset-password", { body: { token, password: "AnotherPass1!" } });
        assert.equal(replay.status, 400);
    });

    test("an expired reset token is rejected", async () => {
        const user = await h.createUser();
        await h.api("POST", "/api/auth/forgot-password", { body: { email: user.email } });
        await h.pool.query("UPDATE users SET reset_token_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [user.id]);
        const { reset_token: token } = (await h.pool.query("SELECT reset_token FROM users WHERE id = $1", [user.id])).rows[0];

        const res = await h.api("POST", "/api/auth/reset-password", { body: { token, password: "BrandNewPass1!" } });
        assert.equal(res.status, 400);
    });

    test("a too-short new password is rejected", async () => {
        const res = await h.api("POST", "/api/auth/reset-password", { body: { token: "whatever", password: "short" } });
        assert.equal(res.status, 400);
    });
});

describe("JWT authentication middleware", () => {
    test("no token -> 401", async () => {
        assert.equal((await h.api("GET", "/api/wallet")).status, 401);
    });

    test("malformed / wrongly-signed / expired tokens -> 403", async () => {
        const user = await h.createUser();
        const forged = jwt.sign({ id: user.id }, "some-other-secret");
        const expired = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -10 });

        for (const token of ["garbage", forged, expired]) {
            assert.equal((await h.api("GET", "/api/wallet", { token })).status, 403);
        }
    });

    test("a non-Bearer Authorization header is rejected", async () => {
        const user = await h.createUser();
        const res = await h.api("GET", "/api/wallet", { headers: { Authorization: user.token } });
        assert.equal(res.status, 401);
    });

    test("alg:none tokens are rejected", async () => {
        const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify({ id: 1 })).toString("base64url");
        const res = await h.api("GET", "/api/wallet", { token: `${header}.${payload}.` });
        assert.equal(res.status, 403);
    });
});

describe("rate limiting", () => {
    test("auth endpoints throttle after repeated attempts (limiter is only bypassed under NODE_ENV=test)", async () => {
        process.env.NODE_ENV = "production";
        try {
            const statuses = [];
            for (let i = 0; i < 14; i++) {
                const res = await h.api("POST", "/api/auth/login", { body: { email: "ratelimit@test.local", password: "x" } });
                statuses.push(res.status);
            }
            assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(",")}`);
        } finally {
            process.env.NODE_ENV = "test";
        }
    });
});

describe("misc HTTP behavior", () => {
    test("unknown routes return JSON 404", async () => {
        const res = await h.api("GET", "/api/does-not-exist");
        assert.equal(res.status, 404);
    });

    test("malformed JSON body returns a client error, not a 500", async () => {
        const res = await h.api("POST", "/api/auth/login", { raw: "{not json", headers: { "Content-Type": "application/json" } });
        assert.ok(res.status >= 400 && res.status < 500, `got ${res.status}`);
    });

    test("POST/PUT with no body is a 400 validation error, never a 500", async () => {
        const user = await h.createUser();
        for (const [method, path, token] of [
            ["POST", "/api/auth/login"], ["POST", "/api/auth/register"], ["POST", "/api/auth/forgot-password"],
            ["POST", "/api/orders/buy", user.token], ["POST", "/api/orders/sell", user.token],
            ["POST", "/api/deposits/fiat", user.token], ["POST", "/api/withdrawals/crypto", user.token],
            ["POST", "/api/withdrawals/fiat", user.token], ["PUT", "/api/users/profile", user.token]
        ]) {
            const res = await h.api(method, path, { token });
            assert.equal(res.status, 400, `${method} ${path} -> ${res.status}`);
        }
    });

    test("security headers are set and X-Powered-By is hidden", async () => {
        const res = await h.api("GET", "/api/does-not-exist");
        assert.equal(res.headers.get("x-powered-by"), null);
        assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    });
});
