const crypto = require("crypto");

// DEMO payment provider. No money moves: it stands in for a real fiat
// provider (bank-transfer collections + bank payouts) so the full lifecycle
// can be exercised end to end. Everything it produces is labelled demo, and
// its callbacks are real signed HTTP requests to our own webhook — the same
// verification and processing path a real provider's callbacks would take.
//
// Webhook protocol (also what a real adapter must translate its provider's
// callbacks into): JSON body
//   { id, type, data: { reference, amount, currency, providerReference, reason } }
// type: deposit.completed | deposit.failed | payout.completed | payout.failed
// signed with HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, rawBody) in X-Webhook-Signature.

const NAME = "demo";
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "demo-webhook-secret-do-not-use-in-production";
const delayMs = () => Number(process.env.DEMO_EVENT_DELAY_MS || 1500);

const sign = (rawBody) => crypto.createHmac("sha256", WEBHOOK_SECRET)
    .update(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody)).digest("hex");

// Exact, constant-time comparison of the lowercase hex digest (an
// upper-cased or otherwise re-encoded signature is rejected).
const verifySignature = (rawBody, signature) => {
    if (typeof signature !== "string") return false;
    const expected = Buffer.from(sign(rawBody));
    const given = Buffer.from(signature);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

// What the demo "bank" knows about each reference, so status queries
// (reconciliation, re-checks) answer consistently with the callbacks it sent.
const records = new Map();

// Test-only steering of the next payout's behaviour.
//   submit: "ok" | "reject" (provider refuses) | "timeout" (outcome unknown)
//   settle: "completed" | "failed" | "none" (no callback; stays processing)
//   afterTimeout: what a status query reports after a timeout
let nextPayout = null;
const controls = {
    setNextPayout: (behaviour) => { nextPayout = behaviour; },
    setDepositOutcome: (reference, outcome) => { records.set(reference, { kind: "deposit", status: outcome }); },
    reset: () => { nextPayout = null; records.clear(); }
};

const deliver = (webhookUrl, type, data) => {
    const body = JSON.stringify({ id: `evt_demo_${crypto.randomBytes(12).toString("hex")}`, type, data });
    return fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Signature": sign(body) },
        body
    }).catch((err) => console.error(`DEMO PAYMENT WEBHOOK DELIVERY FAILED (${type}):`, err.message));
};

// Collection: returns what the customer must do to pay. For a bank transfer
// a real provider returns its own beneficiary account; the demo returns no
// account at all, because there is no account that should receive money.
const createDeposit = async ({ reference, amount, currency, method, webhookUrl, forceFail = false }) => {
    const providerReference = `DEMO-${reference}`;
    records.set(reference, { kind: "deposit", status: "pending", amount, currency });

    const instructions = method === "bank"
        ? {
            kind: "bank_transfer",
            demo: true,
            reference,
            amount,
            currency,
            notice: "Demo mode: there is no real bank account to pay into, and none should be shown. The demo provider confirms this deposit automatically. When a real provider is connected, its beneficiary account and payment instructions appear here."
        }
        : {
            kind: "card",
            demo: true,
            reference,
            amount,
            currency,
            notice: "Demo mode: no card is charged. The demo provider confirms this deposit automatically."
        };

    setTimeout(() => {
        const outcome = forceFail ? "failed" : "completed";
        records.set(reference, { kind: "deposit", status: outcome, amount, currency });
        deliver(webhookUrl, `deposit.${outcome}`, {
            reference,
            providerReference,
            amount,
            currency,
            reason: forceFail ? "Demo: payment declined" : undefined
        });
    }, delayMs());

    return { providerReference, status: "pending", instructions };
};

const getDepositStatus = async (reference) => records.get(reference)?.status || "not_found";

// Payout: the request is accepted asynchronously; the final outcome arrives
// by webhook. `reference` is our own id and doubles as the idempotency key,
// so resubmitting the same reference never pays twice.
const createPayout = async ({ reference, amount, currency, webhookUrl }) => {
    const behaviour = nextPayout || { submit: "ok", settle: "completed" };
    nextPayout = null;

    const existing = records.get(reference);
    if (existing?.kind === "payout" && existing.status !== "not_found") {
        return { providerReference: existing.providerReference, status: existing.status };
    }

    const providerReference = `DEMO-PAYOUT-${reference}`;

    if (behaviour.submit === "reject") {
        records.set(reference, { kind: "payout", status: "failed", providerReference });
        throw Object.assign(new Error("Demo provider rejected the payout"), { providerRejected: true });
    }

    if (behaviour.submit === "timeout") {
        records.set(reference, { kind: "payout", status: behaviour.afterTimeout || "unknown", providerReference });
        throw Object.assign(new Error("Demo provider timed out"), { outcomeUnknown: true });
    }

    records.set(reference, { kind: "payout", status: "processing", providerReference, amount, currency });

    if (behaviour.settle !== "none") {
        setTimeout(() => {
            records.set(reference, { kind: "payout", status: behaviour.settle, providerReference, amount, currency });
            deliver(webhookUrl, `payout.${behaviour.settle}`, {
                reference,
                providerReference,
                amount,
                currency,
                reason: behaviour.settle === "failed" ? "Demo: beneficiary bank rejected the payment" : undefined
            });
        }, delayMs());
    }

    return { providerReference, status: "processing" };
};

const getPayoutStatus = async (reference) => records.get(reference)?.status || "not_found";

// Instant card/bank charge for "buy with card": the demo charges nothing and
// says so.
const chargeInstant = async ({ amount, currency, method }) => ({
    success: true,
    demo: true,
    providerReference: `DEMO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    amount,
    currency,
    method
});

module.exports = {
    name: NAME,
    demo: true,
    sign,
    verifySignature,
    createDeposit,
    getDepositStatus,
    createPayout,
    getPayoutStatus,
    chargeInstant,
    controls
};
