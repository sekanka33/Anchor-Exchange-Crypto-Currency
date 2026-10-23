const pool = require("../config/database");
const payments = require("../services/payments");
const { withTimeout } = payments;
const custody = require("../services/custody");
const { recordEvent, markProcessed } = require("../services/providerEvents");
const { applyPaymentDepositEvent, applyCustodyDepositEvent } = require("./depositController");
const { applyPayoutEvent } = require("./withdrawalController");

// Provider callbacks. Public routes (providers can't log in): authenticity
// comes from the signature over the exact raw body. Each event is recorded
// in provider_events and applied in ONE transaction, so it takes effect
// exactly once however often the provider redelivers it.

// The exact bytes received (captured by express.json's verify hook in app.js).
// There is deliberately no fallback to re-serialising req.body: a signature
// is only meaningful over what the sender actually sent.
const rawBodyOf = (req) => (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : null);

// Signature check that never throws: a missing secret in production (see
// config/secrets.js) is a 503, a bad or missing signature a 401. Nothing is
// read from the payload before this passes.
const authenticate = (req, res, provider, header) => {
    if (!req.is("application/json")) {
        res.status(415).json({ message: "Webhooks must be sent as application/json" });
        return false;
    }
    const raw = rawBodyOf(req);
    if (raw === null) {
        res.status(400).json({ message: "Invalid webhook payload" });
        return false;
    }
    let valid;
    try {
        valid = provider.verifySignature(raw, req.get(header));
    } catch (error) {
        console.error(`${provider.name.toUpperCase()} WEBHOOK UNAVAILABLE: ${error.secret || "signature verification"} misconfigured`);
        res.status(503).json({ message: "Webhook processing is unavailable" });
        return false;
    }
    if (!valid) {
        res.status(401).json({ message: "Invalid webhook signature" });
        return false;
    }
    return true;
};

// A signed event is still only the provider's claim. Before an event moves
// money, the provider's own API is asked for the same object; only an
// identical answer lets it through. A disagreement (409) or an unreachable
// provider (503) changes nothing and records nothing, so the provider's
// retry is processed normally once the two agree.
const confirmWithProvider = async (res, lookup, expected) => {
    let actual;
    try {
        actual = await withTimeout(lookup());
    } catch (error) {
        console.error("WEBHOOK STATUS CHECK FAILED:", error.message);
        res.status(503).json({ message: "Could not confirm the event with the provider; retry later" });
        return false;
    }
    if (actual !== expected) {
        res.status(409).json({ message: "Event does not match the provider's records" });
        return false;
    }
    return true;
};

const isValidEnvelope = (body) =>
    body && typeof body.id === "string" && body.id.length > 0 && body.id.length <= 200
    && typeof body.type === "string" && body.data && typeof body.data === "object";

const processEvent = async (res, { provider, event, apply }) => {
    const client = await pool.connect();
    let result;

    try {
        await client.query("BEGIN");

        const eventRow = await recordEvent(client, { provider: provider.name, eventId: event.id, eventType: event.type, payload: event });
        if (eventRow === null) {
            await client.query("ROLLBACK");
            return res.status(200).json({ message: "Event already received" });
        }

        result = await apply(client);

        if (result.status >= 400) {
            // Not applied: roll back so the event isn't marked as received.
            await client.query("ROLLBACK");
            return res.status(result.status).json(result.body);
        }

        await markProcessed(client, eventRow, result.outcome);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(`${provider.name.toUpperCase()} WEBHOOK ERROR (${event.type}):`, error.message);
        return res.status(500).json({ message: "Unable to process webhook" });
    } finally {
        client.release();
    }

    if (result.after) {
        try {
            result.after();
        } catch (error) {
            console.error("WEBHOOK SIDE EFFECT ERROR:", error.message);
        }
    }

    res.status(result.status).json(result.body);
};

const PAYOUT_STATES = { "payout.completed": "completed", "payout.failed": "failed" };

const handlePaymentWebhook = async (req, res) => {
    const provider = payments.getWebhookAdapter();
    if (!provider) return res.status(503).json({ message: "No payment provider configured" });

    if (!authenticate(req, res, provider, "X-Webhook-Signature")) return;

    const event = req.body;
    if (!isValidEnvelope(event) || typeof event.data.reference !== "string" || !event.data.reference) {
        return res.status(400).json({ message: "Invalid webhook payload" });
    }
    const { reference } = event.data;

    if (event.type === "deposit.completed" || event.type === "deposit.failed") {
        // A failed deposit credits nothing, so only success needs confirming.
        if (event.type === "deposit.completed"
            && !(await confirmWithProvider(res, () => provider.getDepositStatus(reference), "completed"))) return;
        return processEvent(res, { provider, event, apply: (client) => applyPaymentDepositEvent(client, provider, event) });
    }

    if (Object.hasOwn(PAYOUT_STATES, event.type)) {
        // Both outcomes move money: "completed" settles, "failed" hands the
        // reserved funds back to the customer.
        const state = PAYOUT_STATES[event.type];
        if (!(await confirmWithProvider(res, () => provider.getPayoutStatus(reference), state))) return;
        return processEvent(res, {
            provider,
            event,
            apply: (client) => applyPayoutEvent(client, provider.name, { ...event.data, state }, { type: "FIAT", requireAmount: true })
        });
    }

    return res.status(400).json({ message: "Unsupported event type" });
};

const CUSTODY_WITHDRAWAL_STATES = { broadcast: "broadcast", confirmed: "completed", failed: "failed" };

const handleCustodyWebhook = async (req, res) => {
    const provider = custody.getWebhookAdapter();
    if (!provider) return res.status(503).json({ message: "No custody provider configured" });

    if (!authenticate(req, res, provider, "X-Custody-Signature")) return;

    const event = req.body;
    if (!isValidEnvelope(event)) return res.status(400).json({ message: "Invalid webhook payload" });

    if (event.type === "deposit.updated") {
        return processEvent(res, { provider, event, apply: (client) => applyCustodyDepositEvent(client, provider, event) });
    }

    if (event.type === "withdrawal.updated") {
        const state = CUSTODY_WITHDRAWAL_STATES[event.data.state];
        if (!state || typeof event.data.reference !== "string" || !event.data.reference) {
            return res.status(400).json({ message: "Invalid webhook payload" });
        }
        // "broadcast" only records a hash; final outcomes move money and are
        // confirmed with the custodian first.
        if (state !== "broadcast" && !(await confirmWithProvider(
            res, async () => (await provider.getWithdrawalStatus(event.data.reference)).status, state
        ))) return;
        return processEvent(res, {
            provider,
            event,
            apply: (client) => applyPayoutEvent(client, provider.name, { ...event.data, state }, { type: "CRYPTO" })
        });
    }

    return res.status(400).json({ message: "Unsupported event type" });
};

module.exports = { handlePaymentWebhook, handleCustodyWebhook };
