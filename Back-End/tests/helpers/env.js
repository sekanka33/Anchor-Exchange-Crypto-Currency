// Must be the first thing any test file loads. dotenv never overrides
// variables that are already set, so everything set here wins over .env.
process.env.NODE_ENV = "test";
// Test-only secrets: derived from fixed labels so they are strong enough to
// pass production validation, distinct per channel, and obviously not real.
const testSecret = (label) => require("crypto").createHash("sha256").update(`anchor-exchange-test:${label}`).digest("hex");
process.env.DB_NAME = process.env.TEST_DB_NAME || "anchor_exchange_test";
process.env.PORT = "5099";
process.env.JWT_SECRET = testSecret("jwt");
process.env.PAYMENT_PROVIDER = "";
process.env.PAYMENT_WEBHOOK_SECRET = testSecret("payment-webhook");
process.env.CRYPTO_ADDRESS_SECRET = testSecret("crypto-address");
process.env.CUSTODY_PROVIDER = "";
process.env.CUSTODY_WEBHOOK_SECRET = testSecret("custody-webhook");
process.env.BENEFICIARY_ENCRYPTION_KEY = testSecret("beneficiary-key");
delete process.env.BENEFICIARY_ENCRYPTION_KEY_PREVIOUS;
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
