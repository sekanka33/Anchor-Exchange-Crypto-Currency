const crypto = require("crypto");
const { demoAllowed } = require("../config/demoMode");

// No real payment provider (e.g. Stripe) is configured yet. Until
// PAYMENT_PROVIDER is set, every "card"/"bank" charge/deposit is simulated
// and this module is the single place a real provider integration would be
// plugged in later without touching callers (order/deposit controllers).
const isConfigured = Boolean(process.env.PAYMENT_PROVIDER);

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "demo-webhook-secret-do-not-use-in-production";

const signPayload = (payload) => {
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
};

const verifySignature = (rawBody, signature) => {
    if (!signature) return false;

    const expected = signPayload(rawBody);

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);

    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Called by controllers *before* they write anything, so a production
// deployment without a real provider fails cleanly instead of leaving
// orphaned PENDING rows.
const assertPaymentsAvailable = () => {
    if (!isConfigured && !demoAllowed()) {
        throw Object.assign(new Error("Payments are currently unavailable."), { status: 503 });
    }
};

const chargePaymentMethod = async ({ amount, currency = "USD", method }) => {

    assertPaymentsAvailable();

    if (!isConfigured) {
        return {
            success: true,
            demo: true,
            provider: "demo",
            reference: `DEMO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
            amount,
            currency,
            method
        };
    }

    throw new Error("No real payment provider is integrated yet.");

};

// Simulates an async deposit: instant "instant buy" charges (chargePaymentMethod)
// resolve synchronously, but real fiat deposits go through a
// pending -> provider webhook -> completed lifecycle. In demo mode there is
// no real provider to call us back, so we simulate that callback ourselves
// by making a real signed HTTP request to our own webhook endpoint shortly
// after — exercising the exact same verification/completion code path a
// production webhook would.
const initiateDeposit = ({ amount, currency = "USD", method, reference, webhookUrl, forceFail = false }) => {

    assertPaymentsAvailable();

    if (isConfigured) {
        throw new Error("No real payment provider is integrated yet.");
    }

    setTimeout(() => {

        const payload = JSON.stringify({
            reference,
            status: forceFail ? "failed" : "completed",
            amount,
            currency,
            method
        });

        const signature = signPayload(payload);

        fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Webhook-Signature": signature
            },
            body: payload
        }).catch((err) => console.error("DEMO WEBHOOK DELIVERY FAILED:", err.message));

    }, 1500);

    return {
        success: true,
        demo: true,
        provider: "demo",
        reference,
        status: "pending"
    };

};

module.exports = {
    assertPaymentsAvailable,
    chargePaymentMethod,
    initiateDeposit,
    signPayload,
    verifySignature,
    isPaymentProviderConfigured: isConfigured
};
