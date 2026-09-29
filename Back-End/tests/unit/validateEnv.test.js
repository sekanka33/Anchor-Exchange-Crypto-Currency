require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { validateEnv } = require("../../config/validateEnv");

const good = {
    DB_HOST: "h", DB_PORT: "5432", DB_USER: "u", DB_PASSWORD: "p", DB_NAME: "n",
    JWT_SECRET: "x".repeat(64), PAYMENT_WEBHOOK_SECRET: "w".repeat(32), CRYPTO_ADDRESS_SECRET: "c".repeat(32),
};

const prod = {
    ...good, NODE_ENV: "production", ALLOW_DEMO_MODE: "true", FRONTEND_URL: "https://anchor.example.com",
    SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p",
};

describe("validateEnv", () => {
    test("a complete development config has no errors or warnings", () => {
        assert.deepEqual(validateEnv(good), { errors: [], warnings: [] });
    });

    test("a complete production config passes", () => {
        assert.deepEqual(validateEnv(prod).errors, []);
    });

    for (const key of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET"]) {
        test(`missing ${key} is an error in every environment`, () => {
            const { errors } = validateEnv({ ...good, [key]: undefined });
            assert.ok(errors.some((e) => e.startsWith(key)), errors.join("; "));
        });
    }

    test("well-known weak JWT secrets are rejected even in development", () => {
        for (const weak of ["secret", "changeme", "PASSWORD", "123456"]) {
            assert.ok(validateEnv({ ...good, JWT_SECRET: weak }).errors.length > 0, weak);
        }
    });

    test("a short JWT secret is a warning in development but an error in production", () => {
        assert.equal(validateEnv({ ...good, JWT_SECRET: "short-but-unique-secret" }).errors.length, 0);
        assert.ok(validateEnv({ ...good, JWT_SECRET: "short-but-unique-secret" }).warnings.length > 0);
        assert.ok(validateEnv({ ...prod, JWT_SECRET: "short-but-unique-secret" }).errors.length > 0);
    });

    test("production refuses to start without the explicit demo-mode acknowledgement", () => {
        const { errors } = validateEnv({ ...prod, ALLOW_DEMO_MODE: undefined });
        assert.ok(errors.some((e) => /ALLOW_DEMO_MODE/.test(e) && /simulated/.test(e)));
        assert.ok(validateEnv({ ...prod, ALLOW_DEMO_MODE: "yes" }).errors.length > 0, "only the literal string 'true' counts");
    });

    test("production requires SMTP, a public FRONTEND_URL, and the webhook/address secrets", () => {
        assert.ok(validateEnv({ ...prod, SMTP_HOST: undefined }).errors.some((e) => /SMTP/.test(e)));
        assert.ok(validateEnv({ ...prod, FRONTEND_URL: undefined }).errors.some((e) => /FRONTEND_URL/.test(e)));
        assert.ok(validateEnv({ ...prod, FRONTEND_URL: "http://localhost:5173" }).errors.some((e) => /FRONTEND_URL/.test(e)));
        assert.ok(validateEnv({ ...prod, PAYMENT_WEBHOOK_SECRET: undefined }).errors.some((e) => /PAYMENT_WEBHOOK_SECRET/.test(e)));
        assert.ok(validateEnv({ ...prod, CRYPTO_ADDRESS_SECRET: undefined }).errors.some((e) => /CRYPTO_ADDRESS_SECRET/.test(e)));
    });

    test("the same missing secrets are only warnings outside production", () => {
        const { errors, warnings } = validateEnv({ ...good, PAYMENT_WEBHOOK_SECRET: undefined, CRYPTO_ADDRESS_SECRET: undefined });
        assert.equal(errors.length, 0);
        assert.equal(warnings.length, 2);
    });

    test("PORT must be a real port", () => {
        for (const PORT of ["0", "70000", "abc", "-1", "80.5"]) {
            assert.ok(validateEnv({ ...good, PORT }).errors.some((e) => /PORT/.test(e)), PORT);
        }
        assert.equal(validateEnv({ ...good, PORT: "8080" }).errors.length, 0);
    });
});
