const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { io: connect } = require("socket.io-client");
const h = require("../helpers/harness");

before(h.start);
after(h.stop);

const inProduction = async (fn, { allowDemo = false } = {}) => {
    const saved = { env: process.env.NODE_ENV, demo: process.env.ALLOW_DEMO_MODE };
    process.env.NODE_ENV = "production";
    if (allowDemo) process.env.ALLOW_DEMO_MODE = "true"; else delete process.env.ALLOW_DEMO_MODE;
    try {
        return await fn();
    } finally {
        process.env.NODE_ENV = saved.env;
        if (saved.demo === undefined) delete process.env.ALLOW_DEMO_MODE; else process.env.ALLOW_DEMO_MODE = saved.demo;
    }
};

describe("GET /api/health", () => {
    test("reports database and redis status, needs no auth", async () => {
        const res = await h.api("GET", "/api/health");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { status: "ok", checks: { database: "ok", redis: "ok" } });
    });

    test("does not leak configuration or error details", async () => {
        const res = await h.api("GET", "/api/health");
        assert.deepEqual(Object.keys(res.body).sort(), ["checks", "status"]);
    });
});

describe("simulated money is impossible in production unless explicitly acknowledged", () => {
    test("card purchases are refused with 503 and credit nothing", async () => {
        const user = await h.createUser();
        const res = await inProduction(() => h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } }));

        assert.equal(res.status, 503);
        assert.deepEqual(await h.balance(user.id, "BTC"), { available: 0, locked: 0 });
        assert.equal((await h.pool.query("SELECT 1 FROM orders WHERE user_id = $1", [user.id])).rowCount, 0);
    });

    test("fiat deposits are refused before any row is written", async () => {
        const user = await h.createUser();
        const res = await inProduction(() => h.api("POST", "/api/deposits/fiat", { token: user.token, body: { amount: 100, paymentMethod: "card" } }));

        assert.equal(res.status, 503);
        assert.equal((await h.pool.query("SELECT 1 FROM deposits WHERE user_id = $1", [user.id])).rowCount, 0);
    });

    test("the crypto-deposit simulator does not exist in production (404)", async () => {
        const user = await h.createUser();
        await h.api("GET", "/api/deposits/crypto/address?asset=BTC&network=BTC", { token: user.token });
        const res = await inProduction(() => h.api("POST", "/api/deposits/crypto/simulate", { token: user.token, body: { asset: "BTC", network: "BTC", amount: 1 } }));

        assert.equal(res.status, 404);
        assert.equal((await h.pool.query("SELECT 1 FROM deposits WHERE user_id = $1", [user.id])).rowCount, 0);
    });

    test("with ALLOW_DEMO_MODE=true the demo flows work again", async () => {
        const user = await h.createUser();
        const res = await inProduction(() => h.api("POST", "/api/orders/buy", { token: user.token, body: { asset: "BTC", amountUsd: 100, paymentMethod: "card" } }), { allowDemo: true });
        assert.equal(res.status, 201);
        assert.equal(res.body.demo, true);
    });

    test("selling and withdrawing real holdings are unaffected (no payment provider involved)", async () => {
        const user = await h.createUser();
        await h.fund(user.id, "BTC", 0.05);
        const res = await inProduction(() => h.api("POST", "/api/orders/sell", { token: user.token, body: { asset: "BTC", amount: 0.01 } }));
        assert.equal(res.status, 201);
    });
});

describe("error handling", () => {
    test("malformed JSON gets a stable message, not parser internals", async () => {
        const res = await h.api("POST", "/api/auth/login", { raw: "{not json", headers: { "Content-Type": "application/json" } });
        assert.equal(res.status, 400);
        assert.equal(res.body.message, "Invalid JSON body");
    });

    test("an oversized body is a 413, not a crash", async () => {
        const res = await h.api("POST", "/api/auth/login", { body: { email: "a@b.co", password: "x".repeat(300_000) } });
        assert.equal(res.status, 413);
    });

    test("no 5xx response ever carries a stack trace or SQL", async () => {
        const user = await h.createUser();
        const responses = await Promise.all([
            h.api("GET", "/api/orders/not-a-number", { token: user.token }),
            h.api("GET", "/api/transactions/abc", { token: user.token }),
            h.api("GET", "/api/withdrawals/xyz", { token: user.token }),
            h.api("GET", "/api/deposits/%00", { token: user.token }),
        ]);
        for (const r of responses) {
            const text = JSON.stringify(r.body);
            assert.doesNotMatch(text, /select |insert |syntax|pg_|stack|at .*\.js/i, `leak in ${r.status}: ${text}`);
        }
    });

    test("an id larger than a Postgres integer is a clean 4xx/404, not a 500", async () => {
        const user = await h.createUser();
        const res = await h.api("GET", "/api/orders/99999999999999999999", { token: user.token });
        assert.ok(res.status < 500, `got ${res.status}`);
    });
});

describe("Socket.IO notification rooms require a valid JWT", () => {
    let server;
    let port;

    before(async () => {
        server = http.createServer(h.app);
        require("../../socket").initSocket(server);
        await new Promise((r) => server.listen(0, r));
        port = server.address().port;
    });

    after(async () => {
        open.forEach((socket) => socket.close());
        await new Promise((r) => { server.closeAllConnections(); server.close(r); });
    });

    const open = [];
    const client = () => {
        const socket = connect(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true });
        open.push(socket);
        return socket;
    };
    const once = (socket, event, ms = 1500) => new Promise((resolve) => {
        const t = setTimeout(() => resolve(undefined), ms);
        socket.once(event, (v) => { clearTimeout(t); resolve(v ?? true); });
    });
    const connected = (socket) => new Promise((r) => socket.on("connect", r));

    test("joining with a garbage token is rejected and receives nothing", async () => {
        const victim = await h.createUser();
        const attacker = client();
        await connected(attacker);

        const error = once(attacker, "join_user:error");
        attacker.emit("join_user", "not-a-jwt");
        assert.ok(await error, "expected an error event");

        const leaked = once(attacker, "notification:new");
        await h.pool.query("SELECT 1");
        require("../../utils/notify").createNotification(victim.id, { title: "secret", message: "you bought BTC" });
        assert.equal(await leaked, undefined, "an unauthenticated socket must not receive notifications");
        attacker.close();
    });

    test("REGRESSION: sending someone else's numeric user id (the old protocol) no longer subscribes", async () => {
        const victim = await h.createUser();
        const attacker = client();
        await connected(attacker);

        attacker.emit("join_user", victim.id);
        const leaked = once(attacker, "notification:new");
        require("../../utils/notify").createNotification(victim.id, { title: "secret", message: "withdrawal pending" });

        assert.equal(await leaked, undefined);
        attacker.close();
    });

    test("a valid token joins its own room and receives its own notifications only", async () => {
        const alice = await h.createUser();
        const bob = await h.createUser();
        const aliceSocket = client();
        const bobSocket = client();
        await Promise.all([connected(aliceSocket), connected(bobSocket)]);

        aliceSocket.emit("join_user", alice.token);
        bobSocket.emit("join_user", bob.token);
        await new Promise((r) => setTimeout(r, 200));

        const aliceGets = once(aliceSocket, "notification:new");
        const bobGets = once(bobSocket, "notification:new");
        require("../../utils/notify").createNotification(alice.id, { title: "for alice", message: "hi" });

        const received = await aliceGets;
        assert.equal(received.title, "for alice");
        assert.equal(await bobGets, undefined, "bob must not receive alice's notification");
        aliceSocket.close();
        bobSocket.close();
    });

    test("a token signed with the wrong secret or algorithm is rejected", async () => {
        const jwt = require("jsonwebtoken");
        const user = await h.createUser();
        const socket = client();
        await connected(socket);

        for (const forged of [jwt.sign({ id: user.id }, "wrong-secret"), jwt.sign({ id: user.id }, process.env.JWT_SECRET, { algorithm: "HS512" })]) {
            const error = once(socket, "join_user:error");
            socket.emit("join_user", forged);
            assert.ok(await error);
        }
        socket.close();
    });
});
