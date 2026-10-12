// Must be the first thing any test file loads. dotenv never overrides
// variables that are already set, so everything set here wins over .env.
process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.TEST_DB_NAME || "anchor_exchange_test";
process.env.PORT = "5099";
process.env.JWT_SECRET = "test-jwt-secret-not-the-real-one";
process.env.PAYMENT_PROVIDER = "";
process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret";
process.env.CRYPTO_ADDRESS_SECRET = "test-crypto-address-secret";
process.env.CUSTODY_PROVIDER = "";
process.env.CUSTODY_WEBHOOK_SECRET = "test-custody-webhook-secret";
process.env.BENEFICIARY_ENCRYPTION_KEY = "0".repeat(63) + "1";
// Demo provider/custodian callbacks arrive quickly in tests.
process.env.DEMO_EVENT_DELAY_MS = "150";
process.env.COINGECKO_API_KEY = "";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";

require("dotenv").config({ path: require("path").join(__dirname, "../../.env"), quiet: true });

// Tests create/delete users and move money. Refuse to run against anything
// that isn't unmistakably a throwaway database.
if (!/_test$/.test(process.env.DB_NAME)) {
    throw new Error(`Refusing to run tests against database "${process.env.DB_NAME}" (name must end in _test)`);
}
