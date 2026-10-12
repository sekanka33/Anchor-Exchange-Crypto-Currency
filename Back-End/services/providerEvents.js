// Provider callbacks (payment and custody webhooks) are recorded once per
// (provider, event id) inside the same transaction that applies them. A
// redelivered event finds its row and is acknowledged without being applied
// again; if applying fails, the transaction rolls back the record too, so the
// provider's retry is processed normally.
const PAYLOAD_LIMIT = 8 * 1024;

const recordEvent = async (client, { provider, eventId, eventType, payload }) => {
    const json = JSON.stringify(payload ?? {});
    const stored = json.length > PAYLOAD_LIMIT ? JSON.stringify({ truncated: true }) : json;

    const result = await client.query(
        `INSERT INTO provider_events (provider, event_id, event_type, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING id`,
        [provider, eventId, eventType, stored]
    );

    return result.rows[0]?.id ?? null; // null = already received
};

const markProcessed = (client, id, outcome) =>
    client.query("UPDATE provider_events SET processed_at = NOW(), outcome = $2 WHERE id = $1", [id, outcome]);

module.exports = { recordEvent, markProcessed };
