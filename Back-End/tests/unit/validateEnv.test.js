require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { validateEnv } = require("../../config/validateEnv");

// Fixed, test-only values with realistic entropy (never real secrets).
const hex = (label, algo = "sha256") => crypto.createHash(algo).update(`validate-env-test:${label}`).digest("hex");

const good = {
    DB_HOST: "h", DB_PORT: "5432", DB_USER: "u", DB_PASSWORD: "p", DB_NAME: "n",
    JWT_SECRET: hex("jwt", "sha512"), PAYMENT_WEBHOOK_SECRET: hex("payment"), CRYPTO_ADDRESS_SECRET: hex("address"),
    CUSTODY_WEBHOOK_SECRET: hex("custody"), BENEFICIARY_ENCRYPTION_KEY: hex("beneficiary"),
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
        const { errors, warnings } = validateEnv({
            ...good, PAYMENT_WEBHOOK_SECRET: undefined, CRYPTO_ADDRESS_SECRET: undefined,
            CUSTODY_WEBHOOK_SECRET: undefined, BENEFICIARY_ENCRYPTION_KEY: undefined
        });
        assert.equal(errors.length, 0);
        assert.equal(warnings.length, 4);
    });

    test("production requires the custody webhook secret and the beneficiary encryption key", () => {
        assert.ok(validateEnv({ ...prod, CUSTODY_WEBHOOK_SECRET: undefined }).errors.some((e) => /CUSTODY_WEBHOOK_SECRET/.test(e)));
        assert.ok(validateEnv({ ...prod, BENEFICIARY_ENCRYPTION_KEY: undefined }).errors.some((e) => /BENEFICIARY_ENCRYPTION_KEY/.test(e)));
        assert.ok(validateEnv({ ...good, BENEFICIARY_ENCRYPTION_KEY: "too-short" }).errors.some((e) => /32 bytes/.test(e)), "a malformed key is an error everywhere");
    });

    test("an unimplemented provider name is a startup error, never a silent fallback to demo", () => {
        for (const env of [{ ...good, PAYMENT_PROVIDER: "stripe" }, { ...good, CUSTODY_PROVIDER: "fireblocks" }, { ...prod, PAYMENT_PROVIDER: "stripe" }]) {
            assert.ok(validateEnv(env).errors.some((e) => /not implemented/.test(e)), JSON.stringify(env.PAYMENT_PROVIDER || env.CUSTODY_PROVIDER));
        }
        assert.equal(validateEnv({ ...good, PAYMENT_PROVIDER: "demo", CUSTODY_PROVIDER: "DEMO" }).errors.length, 0);
    });

    test("PORT must be a real port", () => {
        for (const PORT of ["0", "70000", "abc", "-1", "80.5"]) {
            assert.ok(validateEnv({ ...good, PORT }).errors.some((e) => /PORT/.test(e)), PORT);
        }
        assert.equal(validateEnv({ ...good, PORT: "8080" }).errors.length, 0);
    });
    test("webhook/address secrets must be long, varied and not a published default; never echoed back", () => {
        for (const [key, value] of [
            ["PAYMENT_WEBHOOK_SECRET", "short"],
            ["CUSTODY_WEBHOOK_SECRET", "a".repeat(64)],
            ["CRYPTO_ADDRESS_SECRET", "demo-crypto-address-secret-do-not-use-in-production"],
            ["PAYMENT_WEBHOOK_SECRET", "demo-webhook-secret-do-not-use-in-production"]
        ]) {
            const prodResult = validateEnv({ ...prod, [key]: value });
            assert.ok(prodResult.errors.some((e) => e.startsWith(key)), `${key}=${value.slice(0, 8)}… must fail in production`);
            assert.ok(!prodResult.errors.join(" ").includes(value), "the value itself never appears in a message");
            assert.ok(validateEnv({ ...good, [key]: value }).warnings.some((e) => e.startsWith(key)), "only a warning in development");
        }
    });

    test("payment and custody webhook secrets must be independent", () => {
        const same = { PAYMENT_WEBHOOK_SECRET: hex("shared"), CUSTODY_WEBHOOK_SECRET: hex("shared") };
        assert.ok(validateEnv({ ...prod, ...same }).errors.some((e) => /must be different/.test(e)));
        assert.ok(validateEnv({ ...good, ...same }).warnings.some((e) => /must be different/.test(e)));
    });

    test("BENEFICIARY_ENCRYPTION_KEY must decode to exactly 32 bytes (hex or canonical base64)", () => {
        const b64 = crypto.createHash("sha256").update("validate-env-test:b64").digest("base64");
        assert.equal(validateEnv({ ...prod, BENEFICIARY_ENCRYPTION_KEY: b64 }).errors.length, 0, "44-char base64 of 32 bytes is accepted");
        for (const bad of [hex("x").slice(0, 62), hex("x") + "00", "!!" + b64.slice(2), b64.slice(0, -1), hex("x", "sha512").slice(0, 88)]) {
            assert.ok(validateEnv({ ...good, BENEFICIARY_ENCRYPTION_KEY: bad }).errors.some((e) => /BENEFICIARY_ENCRYPTION_KEY must be exactly 32 bytes/.test(e)), bad.length);
        }
        assert.ok(validateEnv({ ...prod, BENEFICIARY_ENCRYPTION_KEY: "00".repeat(32) }).errors.some((e) => /variety/.test(e)), "all-zero key");
    });

    test("a previous beneficiary key must be valid and is reported until the rotation is finished", () => {
        assert.ok(validateEnv({ ...good, BENEFICIARY_ENCRYPTION_KEY_PREVIOUS: "nope" }).errors.some((e) => /_PREVIOUS/.test(e)));
        assert.ok(validateEnv({ ...good, BENEFICIARY_ENCRYPTION_KEY_PREVIOUS: hex("old") }).warnings.some((e) => /rotateBeneficiaryKey/.test(e)));
    });

    test("production rejects a low-entropy JWT secret and a well-known database password", () => {
        assert.ok(validateEnv({ ...prod, JWT_SECRET: "j".repeat(64) }).errors.some((e) => /JWT_SECRET/.test(e)));
        assert.ok(validateEnv({ ...prod, DB_PASSWORD: "postgres" }).errors.some((e) => /DB_PASSWORD/.test(e)));
    });

    test("production with ALLOW_DEMO_MODE=true always warns that money is simulated", () => {
        assert.ok(validateEnv(prod).warnings.some((e) => /SIMULATED/.test(e)));
    });
});
