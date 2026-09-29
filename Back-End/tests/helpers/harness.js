require("./env");

const crypto = require("crypto");

const { upstream } = require("./upstreamStub");

// --- App + DB -------------------------------------------------------------
const pool = require("../../config/database");
const redis = require("../../config/redis");
const app = require("../../app");

let server;
const BASE = `http://localhost:${process.env.PORT}`;

const start = () =>
    new Promise((resolve) => {
        server = app.listen(process.env.PORT, resolve);
    });

const stop = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    redis.disconnect();
};

const api = async (method, path, { token, body, headers = {}, raw } = {}) => {
    const response = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(body !== undefined && raw === undefined ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers
        },
        body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined
    });

    let json = null;
    try {
        json = await response.json();
    } catch {
        /* non-JSON body */
    }

    return { status: response.status, body: json, headers: response.headers };
};

// --- Fixtures ---------------------------------------------------------------
let counter = 0;
const uniqueEmail = (prefix = "user") => `${prefix}-${Date.now()}-${++counter}-${crypto.randomBytes(3).toString("hex")}@test.local`;

const PASSWORD = "TestPassw0rd!";

const registerPayload = (overrides = {}) => ({
    email: uniqueEmail(),
    password: PASSWORD,
    fullName: "Test",
    surname: "User",
    country: "South Africa",
    phoneNumber: "+27123456789",
    ...overrides
});

// Goes through the real register + login endpoints; only email verification
// (which needs an inbox) is shortcut directly in the DB.
const createUser = async ({ role = "user", verified = true, ...overrides } = {}) => {
    const payload = registerPayload(overrides);
    const registered = await api("POST", "/api/auth/register", { body: payload });
    if (registered.status !== 201) {
        throw new Error(`createUser: register failed (${registered.status}) ${JSON.stringify(registered.body)}`);
    }
    const id = registered.body.user.id;

    if (verified) await pool.query("UPDATE users SET is_verified = true WHERE id = $1", [id]);
    if (role !== "user") await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);

    const login = await api("POST", "/api/auth/login", { body: { email: payload.email, password: payload.password } });
    if (login.status !== 200) {
        throw new Error(`createUser: login failed (${login.status}) ${JSON.stringify(login.body)}`);
    }

    return { id, email: payload.email, password: payload.password, token: login.body.token };
};

const fund = async (userId, asset, amount) => {
    const wallet = await pool.query("SELECT id FROM wallets WHERE user_id = $1", [userId]);
    await pool.query(
        `INSERT INTO wallet_balances(wallet_id, asset_symbol, available_balance)
         VALUES($1, $2, $3)
         ON CONFLICT (wallet_id, asset_symbol)
         DO UPDATE SET available_balance = wallet_balances.available_balance + EXCLUDED.available_balance`,
        [wallet.rows[0].id, asset, amount]
    );
};

const balance = async (userId, asset) => {
    const result = await pool.query(
        `SELECT wb.available_balance, wb.locked_balance
         FROM wallet_balances wb JOIN wallets w ON w.id = wb.wallet_id
         WHERE w.user_id = $1 AND wb.asset_symbol = $2`,
        [userId, asset]
    );
    const row = result.rows[0];
    return { available: Number(row?.available_balance || 0), locked: Number(row?.locked_balance || 0) };
};

const waitFor = async (check, { timeout = 8000, interval = 150, message = "condition" } = {}) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const value = await check();
        if (value) return value;
        await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`Timed out waiting for ${message}`);
};

const signWebhook = (payload) => {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET).update(body).digest("hex");
    return { body, signature };
};

const validAddresses = {
    BTC: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    ERC20: "0x52908400098527886E0F7030069857D2E4169EE7",
    TRC20: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8"
};

module.exports = { app, start, stop, api, pool, upstream, createUser, fund, balance, waitFor, signWebhook, uniqueEmail, registerPayload, PASSWORD, validAddresses };
