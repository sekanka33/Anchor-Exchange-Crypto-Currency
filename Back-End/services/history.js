// The customer-facing activity feed (`transactions` table). It is a readable
// history, not the books — balances come from the ledger. A deposit or
// withdrawal gets its row as soon as it starts and the row's status follows
// the underlying record, so customers see pending activity too.
const upsertHistory = async (client, { userId, type, asset, amount, fee = "0", total, status, reference, txHash = null, metadata = {} }) => {
    const updated = await client.query(
        `UPDATE transactions
         SET status = $4, fee = $5, total = $6, tx_hash = COALESCE($7, tx_hash),
             metadata = metadata || $8::jsonb, updated_at = NOW()
         WHERE user_id = $1 AND type = $2 AND reference = $3
         RETURNING id`,
        [userId, type, reference, status, fee, total, txHash, JSON.stringify(metadata)]
    );
    if (updated.rows.length > 0) return updated.rows[0].id;

    const inserted = await client.query(
        `INSERT INTO transactions (user_id, type, asset, amount, fee, total, status, reference, tx_hash, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [userId, type, asset, amount, fee, total, status, reference, txHash, JSON.stringify(metadata)]
    );
    return inserted.rows[0].id;
};

// Base URL the demo adapters call back into (this same server).
const selfUrl = (path) => `${process.env.INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`}${path}`;

module.exports = { upsertHistory, selfUrl };
