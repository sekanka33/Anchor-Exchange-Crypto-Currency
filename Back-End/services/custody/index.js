const { demoAllowed } = require("../../config/demoMode");

// Crypto custody boundary: deposit addresses, incoming-transfer events and
// withdrawals all go through this adapter interface, so a real custodian
// (or self-hosted wallet infrastructure with keys in an HSM/KMS) is one new
// adapter, not a rewrite. Private keys, seeds and signing credentials never
// enter this application or its database.
//
//   name, demo
//   verifySignature(rawBody, sig)
//   getDepositAddress({ userId, asset, network }) -> { address, memo } | null
//   submitWithdrawal({ reference, asset, network, address, memo, amount, webhookUrl })
//       -> { providerReference, status }   (throws { providerRejected } or { outcomeUnknown })
//   getWithdrawalStatus(reference) -> { status, txHash }
//       status: "processing" | "completed" | "failed" | "not_found" | "unknown"
//
// Events follow the protocol documented in demoCustody.js. No real adapter is
// implemented (needs a custody account, its documentation and sandbox keys).

const ADAPTERS = {
    demo: () => require("./demoCustody")
};

const configuredName = () => (process.env.CUSTODY_PROVIDER || "").trim().toLowerCase();

const getCustodyProvider = () => {
    const name = configuredName() || "demo";

    if (!Object.hasOwn(ADAPTERS, name)) {
        throw Object.assign(new Error(`Custody provider "${name}" is not implemented.`), { status: 503 });
    }

    const adapter = ADAPTERS[name]();

    if (adapter.demo && !demoAllowed()) {
        throw Object.assign(new Error("Crypto deposits and withdrawals are currently unavailable."), { status: 503 });
    }

    return adapter;
};

const getWebhookAdapter = () => {
    const name = configuredName() || "demo";
    return Object.hasOwn(ADAPTERS, name) ? ADAPTERS[name]() : null;
};

const KNOWN_CUSTODY_PROVIDERS = Object.keys(ADAPTERS);

module.exports = { getCustodyProvider, getWebhookAdapter, KNOWN_CUSTODY_PROVIDERS };
