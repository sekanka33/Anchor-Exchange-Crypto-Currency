const crypto = require("crypto");
const { generateDepositAddress } = require("../cryptoDepositService");

// DEMO custody provider. There is no wallet, node or blockchain behind it:
// deposit addresses are derived locally and are NOT spendable chain
// addresses, transactions are simulated, and every transaction hash starts
// with "demo-" so it can never be mistaken for a real one. Private keys and
// signing never exist in this application — a real custodian holds them.
//
// Webhook protocol (also what a real custody adapter must translate its
// provider's callbacks into): JSON body { id, type, data }, signed with
// HMAC-SHA256(CUSTODY_WEBHOOK_SECRET, rawBody) in X-Custody-Signature.
//   deposit.updated     data: { txHash, network, asset, address, memo, amount, confirmations, state }
//                       state: "pending" | "confirmed" | "reverted"
//   withdrawal.updated  data: { reference, providerReference, txHash, state, reason }
//                       state: "broadcast" | "confirmed" | "failed"

const NAME = "demo";
const WEBHOOK_SECRET = process.env.CUSTODY_WEBHOOK_SECRET || process.env.CRYPTO_ADDRESS_SECRET || "demo-custody-webhook-secret-do-not-use-in-production";
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

const demoTxHash = () => `demo-${crypto.randomBytes(30).toString("hex")}`;

const deliver = (webhookUrl, type, data) => {
    const body = JSON.stringify({ id: `evt_demo_${crypto.randomBytes(12).toString("hex")}`, type, data });
    return fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Custody-Signature": sign(body) },
        body
    }).catch((err) => console.error(`DEMO CUSTODY WEBHOOK DELIVERY FAILED (${type}):`, err.message));
};

const getDepositAddress = async ({ userId, asset, network }) => {
    const generated = generateDepositAddress(userId, asset, network);
    if (!generated) return null;
    return { address: generated.address, memo: generated.memo };
};

// Stands in for the chain: emits "seen", then one event per confirmation.
const simulateIncomingDeposit = ({ asset, network, address, memo, amount, requiredConfirmations, webhookUrl }) => {
    const txHash = demoTxHash();
    const base = { txHash, network, asset, address, memo, amount };

    for (let confirmations = 0; confirmations <= requiredConfirmations; confirmations += 1) {
        setTimeout(() => {
            deliver(webhookUrl, "deposit.updated", {
                ...base,
                confirmations,
                state: confirmations >= requiredConfirmations ? "confirmed" : "pending"
            });
        }, delayMs() * (confirmations + 1));
    }

    return { txHash };
};

const transfers = new Map();
let nextWithdrawal = null;
const controls = {
    setNextWithdrawal: (behaviour) => { nextWithdrawal = behaviour; },
    emitDeposit: (data, webhookUrl) => deliver(webhookUrl, "deposit.updated", data),
    reset: () => { nextWithdrawal = null; transfers.clear(); }
};

// Withdrawal: accepted, then broadcast (hash known), then confirmed.
const submitWithdrawal = async ({ reference, asset, network, address, memo, amount, webhookUrl }) => {
    const behaviour = nextWithdrawal || { submit: "ok", settle: "confirmed" };
    nextWithdrawal = null;

    const existing = transfers.get(reference);
    if (existing && existing.status !== "not_found") {
        return { providerReference: existing.providerReference, status: existing.status };
    }

    const providerReference = `DEMO-TX-${reference}`;

    if (behaviour.submit === "reject") {
        transfers.set(reference, { status: "failed", providerReference });
        throw Object.assign(new Error("Demo custodian rejected the withdrawal"), { providerRejected: true });
    }
    if (behaviour.submit === "timeout") {
        transfers.set(reference, { status: behaviour.afterTimeout || "unknown", providerReference });
        throw Object.assign(new Error("Demo custodian timed out"), { outcomeUnknown: true });
    }

    const txHash = demoTxHash();
    transfers.set(reference, { status: "processing", providerReference, txHash, asset, network, address, memo, amount });

    if (behaviour.settle !== "none") {
        setTimeout(() => {
            deliver(webhookUrl, "withdrawal.updated", { reference, providerReference, txHash, state: "broadcast" });
        }, delayMs());
        setTimeout(() => {
            transfers.set(reference, { ...transfers.get(reference), status: behaviour.settle === "failed" ? "failed" : "completed" });
            deliver(webhookUrl, "withdrawal.updated", {
                reference,
                providerReference,
                txHash: behaviour.settle === "failed" ? null : txHash,
                state: behaviour.settle,
                reason: behaviour.settle === "failed" ? "Demo: transaction rejected by the network" : undefined
            });
        }, delayMs() * 2);
    }

    return { providerReference, status: "processing" };
};

const getWithdrawalStatus = async (reference) => {
    const t = transfers.get(reference);
    return t ? { status: t.status, txHash: t.txHash || null } : { status: "not_found", txHash: null };
};

module.exports = {
    name: NAME,
    demo: true,
    sign,
    verifySignature,
    getDepositAddress,
    simulateIncomingDeposit,
    submitWithdrawal,
    getWithdrawalStatus,
    controls
};
