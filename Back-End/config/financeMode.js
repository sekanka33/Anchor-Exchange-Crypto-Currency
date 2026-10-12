// Which money integrations are active, for the API (/api/config/finance) and
// the startup check. Every financial path resolves its adapter through
// services/payments and services/custody, which fail closed; this module only
// reports the configuration.
const { demoAllowed } = require("./demoMode");

const providerName = (value) => (value || "").trim().toLowerCase() || "demo";

const financeStatus = () => {
    const paymentProvider = providerName(process.env.PAYMENT_PROVIDER);
    const custodyProvider = providerName(process.env.CUSTODY_PROVIDER);
    return {
        paymentProvider,
        custodyProvider,
        // true = deposits, withdrawals and balances are simulated, not real money
        demo: paymentProvider === "demo" || custodyProvider === "demo",
        demoAllowed: demoAllowed()
    };
};

module.exports = { financeStatus };
