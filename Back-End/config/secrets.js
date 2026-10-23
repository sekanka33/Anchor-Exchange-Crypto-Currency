const crypto = require("crypto");

// One place that reads the money-related secrets. Production fails closed:
// a missing secret makes the feature unavailable (503) instead of quietly
// signing or encrypting with a value that is published in this repository.
// Development and test keep working without configuration, using fallbacks
// that are clearly labelled and rejected by validateEnv in production.
//
// Values are read on every call (not cached at require time) so a process
// never runs with a secret captured before its environment was loaded.

const DEV_FALLBACKS = {
    PAYMENT_WEBHOOK_SECRET: "demo-webhook-secret-do-not-use-in-production",
    CUSTODY_WEBHOOK_SECRET: "demo-custody-webhook-secret-do-not-use-in-production",
    CRYPTO_ADDRESS_SECRET: "demo-crypto-address-secret-do-not-use-in-production",
    BENEFICIARY_ENCRYPTION_KEY: "demo-beneficiary-key-do-not-use-in-production"
};

// The public fallback values must never be accepted as
// configured secrets in production.
const PUBLIC_DEFAULTS = new Set(Object.values(DEV_FALLBACKS));

const isProduction = (env = process.env) => env.NODE_ENV === "production";

// Clients only see a generic 503; `secret` names the variable (never its
// value) for server-side diagnosis. validateEnv stops production from booting
// without these, so this is a second line of defence.
const unavailable = (name) =>
    Object.assign(new Error("This feature is temporarily unavailable."), { status: 503, secret: name });

const readSecret = (name, env = process.env) => {
    const value = env[name];
    if (value) {
        if (PUBLIC_DEFAULTS.has(value) && isProduction(env)) throw unavailable(name);
        return value;
    }
    if (isProduction(env)) throw unavailable(name);
    return DEV_FALLBACKS[name];
};

// 32-byte keys: exactly 64 hex characters, or canonical base64 of 32 bytes.
const HEX_32 = /^[0-9a-f]{64}$/i;
const BASE64_32 = /^[A-Za-z0-9+/]{43}=$/;

const parseKey32 = (value) => {
    if (typeof value !== "string") return null;
    if (HEX_32.test(value)) return Buffer.from(value, "hex");
    if (BASE64_32.test(value)) {
        const key = Buffer.from(value, "base64");
        return key.length === 32 ? key : null;
    }
    return null;
};

// Beneficiary keys: the current key, plus an optional previous key that is
// only ever used to read records written before a rotation.
const beneficiaryKeys = (env = process.env) => {
    const configured = env.BENEFICIARY_ENCRYPTION_KEY;
    let current;
    if (configured) {
        current = parseKey32(configured);
        if (!current) throw Object.assign(new Error("This feature is temporarily unavailable."), { status: 503, secret: "BENEFICIARY_ENCRYPTION_KEY" });
    } else if (isProduction(env)) {
        throw unavailable("BENEFICIARY_ENCRYPTION_KEY");
    } else {
        current = crypto.createHash("sha256").update(DEV_FALLBACKS.BENEFICIARY_ENCRYPTION_KEY).digest();
    }

    const previous = env.BENEFICIARY_ENCRYPTION_KEY_PREVIOUS ? parseKey32(env.BENEFICIARY_ENCRYPTION_KEY_PREVIOUS) : null;
    if (env.BENEFICIARY_ENCRYPTION_KEY_PREVIOUS && !previous) {
        throw Object.assign(new Error("This feature is temporarily unavailable."), { status: 503, secret: "BENEFICIARY_ENCRYPTION_KEY_PREVIOUS" });
    }

    return { current, previous };
};

module.exports = { readSecret, parseKey32, beneficiaryKeys, PUBLIC_DEFAULTS, DEV_FALLBACKS };
