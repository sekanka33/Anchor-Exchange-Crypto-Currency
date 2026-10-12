const pool = require("../config/database");
const payments = require("../services/payments");
const custody = require("../services/custody");
const { recordEvent, markProcessed } = require("../services/providerEvents");
const { applyPaymentDepositEvent, applyCustodyDepositEvent } = require("./depositController");
const { applyPayoutEvent } = require("./withdrawalController");

// Provider callbacks. Public routes (providers can't log in): authenticity
// comes from the signature over the exact raw body. Each event is recorded
// in provider_events and applied in ONE transaction, so it takes effect
// exactly once however often the provider redelivers it.

const rawBodyOf = (req) => (req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body));

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

    if (!provider.verifySignature(rawBodyOf(req), req.get("X-Webhook-Signature"))) {
        return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const event = req.body;
    if (!isValidEnvelope(event) || typeof event.data.reference !== "string" || !event.data.reference) {
        return res.status(400).json({ message: "Invalid webhook payload" });
    }

    if (event.type === "deposit.completed" || event.type === "deposit.failed") {
        return processEvent(res, { provider, event, apply: (client) => applyPaymentDepositEvent(client, provider, event) });
    }

    if (Object.hasOwn(PAYOUT_STATES, event.type)) {
        return processEvent(res, {
            provider,
            event,
            apply: (client) => applyPayoutEvent(client, provider.name, { ...event.data, state: PAYOUT_STATES[event.type] })
        });
    }

    return res.status(400).json({ message: "Unsupported event type" });
};

const CUSTODY_WITHDRAWAL_STATES = { broadcast: "broadcast", confirmed: "completed", failed: "failed" };

const handleCustodyWebhook = async (req, res) => {
    const provider = custody.getWebhookAdapter();
    if (!provider) return res.status(503).json({ message: "No custody provider configured" });

    if (!provider.verifySignature(rawBodyOf(req), req.get("X-Custody-Signature"))) {
        return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const event = req.body;
    if (!isValidEnvelope(event)) return res.status(400).json({ message: "Invalid webhook payload" });

    if (event.type === "deposit.updated") {
        return processEvent(res, { provider, event, apply: (client) => applyCustodyDepositEvent(client, provider, event) });
    }

    if (event.type === "withdrawal.updated") {
        const state = CUSTODY_WITHDRAWAL_STATES[event.data.state];
        if (!state || typeof event.data.reference !== "string") return res.status(400).json({ message: "Invalid webhook payload" });
        return processEvent(res, {
            provider,
            event,
            apply: (client) => applyPayoutEvent(client, provider.name, { ...event.data, state })
        });
    }

    return res.status(400).json({ message: "Unsupported event type" });
};

module.exports = { handlePaymentWebhook, handleCustodyWebhook };
