// Exercises the real entry point (server.js) as a child process: the parts
// that can't be tested by importing app.js.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
require("../helpers/env");

const SERVER = path.join(__dirname, "../../server.js");

const baseEnv = () => ({
    ...process.env,
    NODE_ENV: "development",
    PORT: "5097",
    FRONTEND_URL: "http://localhost:5173",
    JWT_SECRET: "j".repeat(64),
});

const run = (envOverrides, { until, timeout = 8000 } = {}) =>
    new Promise((resolve) => {
        const child = spawn("node", [SERVER], { env: { ...baseEnv(), ...envOverrides }, cwd: path.join(__dirname, "../..") });
        let output = "";
        const collect = (d) => { output += d; };
        child.stdout.on("data", collect);
        child.stderr.on("data", collect);
        const timer = setTimeout(() => { child.kill("SIGKILL"); resolve({ child, output, timedOut: true }); }, timeout);
        child.on("exit", (code, signal) => { clearTimeout(timer); resolve({ child, output, code, signal }); });

        if (until) {
            const poll = setInterval(() => {
                if (until(output)) { clearInterval(poll); clearTimeout(timer); resolve({ child, output, running: true }); }
            }, 50);
            child.on("exit", () => clearInterval(poll));
        }
    });

const stop = (child) => new Promise((resolve) => { child.on("exit", (code, signal) => resolve({ code, signal })); child.kill("SIGTERM"); });

describe("startup validation (server.js)", () => {
    test("refuses to boot with a weak JWT secret and says why", async () => {
        const { code, output } = await run({ JWT_SECRET: "secret" });
        assert.equal(code, 1);
        assert.match(output, /CONFIG ERROR: JWT_SECRET is a well-known weak value/);
        assert.match(output, /Refusing to start/);
    });

    test("refuses to boot when a required variable is missing", async () => {
        const { code, output } = await run({ DB_PASSWORD: "" });
        assert.equal(code, 1);
        assert.match(output, /DB_PASSWORD is required/);
    });

    test("production refuses to boot without ALLOW_DEMO_MODE, and lists every problem at once", async () => {
        const { code, output } = await run({ NODE_ENV: "production", ALLOW_DEMO_MODE: "", SMTP_HOST: "", FRONTEND_URL: "" });
        assert.equal(code, 1);
        assert.match(output, /ALLOW_DEMO_MODE/);
        assert.match(output, /SMTP_HOST/);
        assert.match(output, /FRONTEND_URL/);
    });

    test("a valid production config boots, with a loud demo-mode warning", async () => {
        const { child, output, running } = await run(
            { NODE_ENV: "production", ALLOW_DEMO_MODE: "true", SMTP_HOST: "smtp.test", SMTP_USER: "u", SMTP_PASS: "p", FRONTEND_URL: "https://anchor.example.com" },
            { until: (o) => /DEMO MODE/.test(o) }
        );
        try {
            assert.ok(running, `did not start: ${output}`);
            assert.match(output, /Server running on port 5097 \(production\)/);
            assert.match(output, /DEMO MODE: payments, deposits and crypto addresses are simulated/);
        } finally {
            await stop(child);
        }
    });
});

describe("running server", () => {
    test("logs one line per request without ever logging query strings (they carry secret tokens)", async () => {
        const { child, output: startup, running } = await run({}, { until: (o) => /Server running/.test(o) });
        assert.ok(running, startup);
        let output = startup;
        child.stdout.on("data", (d) => { output += d; });
        try {
            await fetch("http://localhost:5097/api/auth/verify-email?token=SUPERSECRETTOKEN123");
            await fetch("http://localhost:5097/api/withdrawals/confirm?token=ANOTHERSECRET456");
            await new Promise((r) => setTimeout(r, 300));

            assert.match(output, /GET \/api\/auth\/verify-email 400 [\d.]+ms/);
            assert.match(output, /GET \/api\/withdrawals\/confirm 400 [\d.]+ms/);
            assert.doesNotMatch(output, /SUPERSECRETTOKEN123|ANOTHERSECRET456/);
        } finally {
            await stop(child);
        }
    });

    test("does not log request bodies (passwords) even when a request fails", async () => {
        const { child, output: startup, running } = await run({}, { until: (o) => /Server running/.test(o) });
        assert.ok(running, startup);
        let output = startup;
        child.stdout.on("data", (d) => { output += d; });
        child.stderr.on("data", (d) => { output += d; });
        try {
            await fetch("http://localhost:5097/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "x@y.zz", password: "HUNTER2-PLAINTEXT" }) });
            await fetch("http://localhost:5097/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{HUNTER2-PLAINTEXT" });
            await new Promise((r) => setTimeout(r, 300));
            assert.doesNotMatch(output, /HUNTER2-PLAINTEXT/);
        } finally {
            await stop(child);
        }
    });

    test("SIGTERM shuts down gracefully with exit code 0, quickly", async () => {
        const { child, running, output } = await run({}, { until: (o) => /Server running/.test(o) });
        assert.ok(running, output);
        const started = Date.now();
        const { code } = await stop(child);
        assert.equal(code, 0);
        assert.ok(Date.now() - started < 5000);
    });

    test("CORS only allows the configured frontend origin", async () => {
        const { child, running, output } = await run({}, { until: (o) => /Server running/.test(o) });
        assert.ok(running, output);
        try {
            const allowed = await fetch("http://localhost:5097/api/health", { headers: { Origin: "http://localhost:5173" } });
            const evil = await fetch("http://localhost:5097/api/health", { headers: { Origin: "https://evil.example" } });

            assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
            // A fixed-origin CORS config always answers with the one allowed origin;
            // browsers then refuse to expose the response to any other page.
            assert.equal(evil.headers.get("access-control-allow-origin"), "http://localhost:5173");
            assert.notEqual(evil.headers.get("access-control-allow-origin"), "https://evil.example");
            assert.equal(evil.headers.get("access-control-allow-credentials"), "true");
        } finally {
            await stop(child);
        }
    });
});
