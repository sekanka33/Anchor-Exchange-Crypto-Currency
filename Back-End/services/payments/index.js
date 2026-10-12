const { demoAllowed } = require("../../config/demoMode");

// Payment-provider boundary. Deposit/withdrawal logic only ever calls the
// adapter interface below, so a real provider can be added as one new file
// without touching business logic:
//
//   name, demo                      identification
//   verifySignature(rawBody, sig)   authenticate a webhook
//   createDeposit({ reference, amount, currency, method, webhookUrl })
//       -> { providerReference, status, instructions }
//   getDepositStatus(reference)     -> "pending" | "completed" | "failed" | "not_found"
//   createPayout({ reference, amount, currency, beneficiary, webhookUrl })
//       -> { providerReference, status }   (throws { providerRejected } or { outcomeUnknown })
//   getPayoutStatus(reference)      -> "processing" | "completed" | "failed" | "not_found" | "unknown"
//   chargeInstant({ amount, currency, method }) -> { success, providerReference }   ("buy with card")
//
// and its webhooks are translated into the event format documented in
// demoPaymentProvider.js. No real adapter is implemented: none can be built
// or tested without a merchant account and the provider's documentation and
// sandbox credentials (see README "Activating real payments").

const ADAPTERS = {
    demo: () => require("./demoPaymentProvider")
};

const configuredName = () => (process.env.PAYMENT_PROVIDER || "").trim().toLowerCase();

const unavailable = (message) => Object.assign(new Error(message), { status: 503 });

// Resolves the active adapter. Fails closed: an unknown provider name, or the
// demo adapter where demo mode isn't allowed, makes payments unavailable
// rather than silently simulating them.
const getPaymentProvider = () => {
    const name = configuredName() || "demo";

    if (!Object.hasOwn(ADAPTERS, name)) {
        throw unavailable(`Payment provider "${name}" is not implemented.`);
    }

    const adapter = ADAPTERS[name]();

    if (adapter.demo && !demoAllowed()) {
        throw unavailable("Payments are currently unavailable.");
    }

    return adapter;
};

// The adapter that signed a webhook: providers are identified by the route
// they call, so this mirrors getPaymentProvider without the demo gate (a
// webhook for a past demo deposit must still be recognised and rejected or
// processed consistently).
const getWebhookAdapter = () => {
    const name = configuredName() || "demo";
    return Object.hasOwn(ADAPTERS, name) ? ADAPTERS[name]() : null;
};

// Wraps a provider call so a hung provider can't hold a request open
// forever; a timeout means "outcome unknown", never "failed".
const withTimeout = (promise, ms = Number(process.env.PROVIDER_TIMEOUT_MS || 15000)) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(
            () => reject(Object.assign(new Error("Payment provider timed out"), { outcomeUnknown: true })),
            ms
        ))
    ]);

const KNOWN_PROVIDERS = Object.keys(ADAPTERS);

module.exports = { getPaymentProvider, getWebhookAdapter, withTimeout, KNOWN_PROVIDERS };
