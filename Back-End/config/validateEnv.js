const { parseKey32, PUBLIC_DEFAULTS } = require("./secrets");

const WEAK_SECRETS = new Set(["secret", "changeme", "change-me", "password", "123456", "jwt_secret", "your_jwt_secret", "postgres", "admin", "root"]);

// HMAC secrets: at least 32 characters, not a published default, and not
// obviously low-entropy (one repeated character, or very few distinct ones).
const MIN_SECRET_LENGTH = 32;
const HMAC_SECRETS = ["PAYMENT_WEBHOOK_SECRET", "CUSTODY_WEBHOOK_SECRET", "CRYPTO_ADDRESS_SECRET"];

const lowEntropy = (value) => new Set(value).size < 10;

// Every message names the variable and the rule, never the value.
const secretProblem = (value) => {
    if (PUBLIC_DEFAULTS.has(value) || WEAK_SECRETS.has(value.toLowerCase())) return "is a published or well-known value";
    if (value.length < MIN_SECRET_LENGTH) return `should be at least ${MIN_SECRET_LENGTH} characters`;
    if (lowEntropy(value)) return "has too little variety to be a random secret (generate one with: openssl rand -hex 32)";
    return null;
};

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
        } else if (lowEntropy(jwt)) {
            (production ? errors : warnings).push("JWT_SECRET has too little variety to be a random secret (generate one with: openssl rand -hex 64)");
        }
    }

    const port = Number(env.PORT || 5000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("PORT must be a valid port number");

    // Webhook/address secrets: required and strong in production; outside
    // production a missing one falls back to a labelled development value
    // (config/secrets.js), which is only a warning.
    for (const key of HMAC_SECRETS) {
        const value = env[key];
        if (!value) {
            (production ? errors : warnings).push(`${key} is not set (a public development value is used outside production; production refuses to start)`);
            continue;
        }
        const problem = secretProblem(value);
        if (problem) (production ? errors : warnings).push(`${key} ${problem}`);
    }

    // Each channel has its own key, so a leak of one can't forge the other.
    if (env.PAYMENT_WEBHOOK_SECRET && env.PAYMENT_WEBHOOK_SECRET === env.CUSTODY_WEBHOOK_SECRET) {
        (production ? errors : warnings).push("PAYMENT_WEBHOOK_SECRET and CUSTODY_WEBHOOK_SECRET must be different values");
    }

    // Provider names must be ones this build implements (see services/payments
    // and services/custody); an unknown name is a misconfiguration, never a
    // reason to fall back to simulation.
    const { KNOWN_PROVIDERS } = require("../services/payments");
    const { KNOWN_CUSTODY_PROVIDERS } = require("../services/custody");
    const paymentProvider = (env.PAYMENT_PROVIDER || "").trim().toLowerCase();
    const custodyProvider = (env.CUSTODY_PROVIDER || "").trim().toLowerCase();
    if (paymentProvider && !KNOWN_PROVIDERS.includes(paymentProvider)) {
        errors.push(`PAYMENT_PROVIDER "${env.PAYMENT_PROVIDER}" is not implemented (available: ${KNOWN_PROVIDERS.join(", ")})`);
    }
    if (custodyProvider && !KNOWN_CUSTODY_PROVIDERS.includes(custodyProvider)) {
        errors.push(`CUSTODY_PROVIDER "${env.CUSTODY_PROVIDER}" is not implemented (available: ${KNOWN_CUSTODY_PROVIDERS.join(", ")})`);
    }
    // 32 bytes as 64 hex characters or canonical base64 (44 characters).
    if (env.BENEFICIARY_ENCRYPTION_KEY) {
        const key = parseKey32(env.BENEFICIARY_ENCRYPTION_KEY);
        if (!key) {
            errors.push("BENEFICIARY_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters or 44-character base64)");
        } else if (new Set(key).size < 8) {
            (production ? errors : warnings).push("BENEFICIARY_ENCRYPTION_KEY has too little variety to be a random key (generate one with: openssl rand -hex 32)");
        }
    } else {
        (production ? errors : warnings).push("BENEFICIARY_ENCRYPTION_KEY is not set (bank account numbers are encrypted with a built-in development key)");
    }
    if (env.BENEFICIARY_ENCRYPTION_KEY_PREVIOUS) {
        const previous = parseKey32(env.BENEFICIARY_ENCRYPTION_KEY_PREVIOUS);
        if (!previous) {
            errors.push("BENEFICIARY_ENCRYPTION_KEY_PREVIOUS must be exactly 32 bytes (64 hex characters or 44-character base64)");
        } else if (env.BENEFICIARY_ENCRYPTION_KEY && previous.equals(parseKey32(env.BENEFICIARY_ENCRYPTION_KEY) || Buffer.alloc(0))) {
            warnings.push("BENEFICIARY_ENCRYPTION_KEY_PREVIOUS equals the current key; remove it");
        } else {
            warnings.push("BENEFICIARY_ENCRYPTION_KEY_PREVIOUS is set: run scripts/rotateBeneficiaryKey.js --apply, then remove it");
        }
    }

    const dbPort = Number(env.DB_PORT);
    if (env.DB_PORT && (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535)) errors.push("DB_PORT must be a valid port number");

    if (production) {
        if (env.DB_PASSWORD && WEAK_SECRETS.has(env.DB_PASSWORD.toLowerCase())) {
            errors.push("DB_PASSWORD is a well-known weak value");
        }
        if (env.ALLOW_DEMO_MODE === "true") {
            // Allowed only as an explicit acknowledgement; it never makes demo
            // adapters real (every demo response stays labelled demo).
            warnings.push("ALLOW_DEMO_MODE=true: deposits, payouts, custody and addresses are SIMULATED. Do not accept real customer funds.");
        }
        if (env.ALLOW_DEMO_MODE !== "true") {
            errors.push(
                "Refusing to start in production: payments, deposits and withdrawals are simulated (only the demo payment and custody " +
                "providers exist in this build) and would create money from nothing. Set ALLOW_DEMO_MODE=true only to run a public demo."
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
