const WEAK_SECRETS = new Set(["secret", "changeme", "change-me", "password", "123456", "jwt_secret", "your_jwt_secret"]);

const REQUIRED = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET"];

// Pure function of `env` so it can be unit-tested. Returns problems instead of
// exiting; server.js decides what to do with them.
const validateEnv = (env = process.env) => {
    const errors = [];
    const warnings = [];
    const production = env.NODE_ENV === "production";

    for (const key of REQUIRED) {
        if (!env[key]) errors.push(`${key} is required but not set`);
    }

    const jwt = env.JWT_SECRET;
    if (jwt) {
        if (WEAK_SECRETS.has(jwt.toLowerCase())) {
            errors.push("JWT_SECRET is a well-known weak value");
        } else if (jwt.length < 32) {
            (production ? errors : warnings).push("JWT_SECRET should be at least 32 characters");
        }
    }

    const port = Number(env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("PORT must be a valid port number");

    if (!env.PAYMENT_WEBHOOK_SECRET) {
        (production ? errors : warnings).push("PAYMENT_WEBHOOK_SECRET is not set (falls back to a public default that anyone could use to forge webhooks)");
    }
    if (!env.CRYPTO_ADDRESS_SECRET) {
        (production ? errors : warnings).push("CRYPTO_ADDRESS_SECRET is not set (falls back to a hardcoded default)");
    }

    if (production) {
        if (env.ALLOW_DEMO_MODE !== "true") {
            errors.push(
                "Refusing to start in production: payments, deposits and withdrawals are simulated (no real provider is integrated) " +
                "and would create money from nothing. Set ALLOW_DEMO_MODE=true to acknowledge this explicitly."
            );
        }
        if (!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) {
            errors.push("SMTP_HOST/SMTP_USER/SMTP_PASS are required in production (otherwise verification and reset links are only printed to the server log)");
        }
        if (!env.FRONTEND_URL || /localhost|127\.0\.0\.1/.test(env.FRONTEND_URL)) {
            errors.push("FRONTEND_URL must be set to the public site URL in production (used for CORS and links in emails)");
        }
    } else if (env.ALLOW_DEMO_MODE === "true") {
        warnings.push("ALLOW_DEMO_MODE only matters when NODE_ENV=production");
    }

    return { errors, warnings };
};

module.exports = { validateEnv };
