const pool = require("../config/database");
const { reconcile } = require("../services/ledger");
const { recordAudit } = require("../services/auditLog");
const { recheckWithdrawal, present } = require("./withdrawalController");
const { DEPOSIT_COLUMNS } = require("./depositController");
const { publicFiatConfig } = require("../config/fiatCurrencies");
const { ASSET_NETWORKS, CONFIRMATIONS_REQUIRED, MIN_CRYPTO_DEPOSIT } = require("../config/cryptoNetworks");
const { CRYPTO_WITHDRAWAL_FEES } = require("../config/withdrawalConfig");
const { financeStatus } = require("../config/financeMode");

// Administrator finance views. Read access to everything needed to
// investigate a payment; the only write here is "re-check with provider",
// which can move money solely on the provider's definite answer. There is
// no endpoint to edit balances or ledger entries.

const pageParams = (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    return { page, limit, offset: (page - 1) * limit };
};

const journalsFor = (referenceType, referenceId) => pool.query(
    `SELECT j.id, j.journal_key, j.kind, j.description, j.created_at,
            COALESCE(json_agg(json_build_object('account', e.account, 'asset', e.asset, 'amount', e.amount) ORDER BY e.id)
                     FILTER (WHERE e.id IS NOT NULL), '[]') AS entries
     FROM ledger_journals j LEFT JOIN ledger_entries e ON e.journal_id = j.id
     WHERE j.reference_type = $1 AND j.reference_id = $2
     GROUP BY j.id ORDER BY j.id`,
    [referenceType, referenceId]
);

// Provider events that mention this record (by reference or tx hash).
const eventsFor = (values) => pool.query(
    `SELECT id, provider, event_id, event_type, outcome, received_at, processed_at
     FROM provider_events
     WHERE payload->'data'->>'reference' = ANY($1) OR payload->'data'->>'txHash' = ANY($1)
     ORDER BY received_at`,
    [values.filter(Boolean)]
);

const getDepositDetail = async (req, res) => {
    try {
        const deposit = (await pool.query(
            `SELECT ${DEPOSIT_COLUMNS}, user_id, (SELECT email FROM users WHERE id = deposits.user_id) AS user_email
             FROM deposits WHERE id = $1`,
            [req.params.id]
        )).rows[0];
        if (!deposit) return res.status(404).json({ message: "Deposit not found" });

        const [journals, events] = await Promise.all([
            journalsFor("deposit", deposit.id),
            eventsFor([deposit.provider_reference, deposit.tx_hash])
        ]);
        res.json({ deposit, ledger: journals.rows, providerEvents: events.rows });
    } catch (error) {
        console.error("ADMIN DEPOSIT DETAIL ERROR:", error);
        res.status(500).json({ message: "Unable to load deposit" });
    }
};

const getWithdrawalDetail = async (req, res) => {
    try {
        const row = (await pool.query(
            `SELECT w.*, u.email AS user_email FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.id = $1`,
            [req.params.id]
        )).rows[0];
        if (!row) return res.status(404).json({ message: "Withdrawal not found" });

        // Risk context: account age, prior completed withdrawals, and
        // whether this destination has been paid before.
        const [journals, events, risk] = await Promise.all([
            journalsFor("withdrawal", row.id),
            eventsFor([`WD-${row.id}`, row.tx_hash]),
            pool.query(
                `SELECT
                    (SELECT created_at FROM users WHERE id = $1) AS account_created_at,
                    (SELECT COUNT(*)::int FROM withdrawals WHERE user_id = $1 AND status = 'COMPLETED') AS completed_withdrawals,
                    (SELECT COUNT(*)::int FROM withdrawals WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours') AS withdrawals_last_24h,
                    (SELECT COUNT(*)::int FROM withdrawals
                       WHERE user_id = $1 AND id <> $2 AND status = 'COMPLETED'
                         AND ((destination_address IS NOT NULL AND destination_address = $3)
                              OR (beneficiary_id IS NOT NULL AND beneficiary_id = $4))) AS previous_payouts_to_destination`,
                [row.user_id, row.id, row.destination_address, row.beneficiary_id]
            )
        ]);

        const { confirmation_token: _token, idempotency_key: _key, ...safe } = row;
        res.json({ withdrawal: present(safe), risk: risk.rows[0], ledger: journals.rows, providerEvents: events.rows });
    } catch (error) {
        console.error("ADMIN WITHDRAWAL DETAIL ERROR:", error);
        res.status(500).json({ message: "Unable to load withdrawal" });
    }
};

const recheckWithdrawalWithProvider = async (req, res) => {
    const before = (await pool.query("SELECT status, provider_status FROM withdrawals WHERE id = $1", [req.params.id])).rows[0];
    const result = await recheckWithdrawal(Number(req.params.id));

    if (result.status === 200) {
        await recordAudit(pool, {
            actor: req.user,
            action: "WITHDRAWAL_RECHECK",
            targetType: "withdrawal",
            targetId: req.params.id,
            reason: result.message,
            before,
            after: result.withdrawal ? { status: result.withdrawal.status, provider_status: result.withdrawal.provider_status } : { provider_status: result.providerStatus }
        });
    }

    res.status(result.status).json({
        message: result.message,
        providerStatus: result.providerStatus,
        withdrawal: result.withdrawal ? present(result.withdrawal) : undefined
    });
};

// Anything that needs a human: ledger/balance discrepancies, records stuck or
// held for review, and provider events that couldn't be matched.
const getReconciliation = async (req, res) => {
    try {
        const [ledger, platform, deposits, withdrawals, events] = await Promise.all([
            reconcile(pool),
            pool.query(
                `SELECT account, asset, SUM(amount)::text AS balance
                 FROM ledger_entries WHERE user_id IS NULL GROUP BY account, asset ORDER BY account, asset`
            ),
            pool.query(
                `SELECT d.id, d.type, d.asset, d.amount, d.status, d.provider, d.provider_reference, d.tx_hash,
                        d.failure_reason, d.created_at, u.email AS user_email
                 FROM deposits d JOIN users u ON u.id = d.user_id
                 WHERE d.status = 'UNDER_REVIEW'
                    OR (d.status IN ('PENDING', 'DETECTED', 'CONFIRMING') AND d.created_at < NOW() - INTERVAL '24 hours')
                 ORDER BY d.created_at LIMIT 200`
            ),
            pool.query(
                `SELECT w.id, w.type, w.asset, w.amount, w.status, w.provider, w.provider_reference, w.provider_status,
                        w.tx_hash, w.failure_reason, w.created_at, w.submitted_at, u.email AS user_email
                 FROM withdrawals w JOIN users u ON u.id = w.user_id
                 WHERE w.status = 'UNDER_REVIEW'
                    OR (w.status = 'PROCESSING' AND COALESCE(w.submitted_at, w.updated_at) < NOW() - INTERVAL '1 hour')
                 ORDER BY w.created_at LIMIT 200`
            ),
            pool.query(
                `SELECT id, provider, event_id, event_type, outcome, received_at
                 FROM provider_events
                 WHERE outcome IN ('unknown_address', 'amount_mismatch', 'data_mismatch', 'reverted_after_credit', 'below_minimum')
                 ORDER BY received_at DESC LIMIT 200`
            )
        ]);

        const exceptions = ledger.balanceMismatches.length + ledger.unbalancedJournals.length
            + deposits.rows.length + withdrawals.rows.length + events.rows.length;

        res.json({
            checkedAt: new Date().toISOString(),
            ok: exceptions === 0,
            exceptions,
            ledger,
            platformAccounts: platform.rows,
            depositsNeedingAttention: deposits.rows,
            withdrawalsNeedingAttention: withdrawals.rows,
            unmatchedProviderEvents: events.rows
        });
    } catch (error) {
        console.error("ADMIN RECONCILIATION ERROR:", error);
        res.status(500).json({ message: "Unable to run reconciliation" });
    }
};

const getAuditLogs = async (req, res) => {
    const { page, limit, offset } = pageParams(req.query);
    const params = [];
    const conditions = [];

    if (req.query.action) {
        params.push(String(req.query.action).toUpperCase());
        conditions.push(`a.action = $${params.length}`);
    }
    if (req.query.targetType && req.query.targetId) {
        params.push(String(req.query.targetType), String(req.query.targetId));
        conditions.push(`a.target_type = $${params.length - 1} AND a.target_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [rows, count] = await Promise.all([
            pool.query(
                `SELECT a.id, a.actor_user_id, u.email AS actor_email, a.actor_role, a.action, a.target_type, a.target_id,
                        a.reason, a.before_state, a.after_state, a.created_at
                 FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
                 ${where} ORDER BY a.created_at DESC, a.id DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM audit_logs a ${where}`, params)
        ]);
        res.json({
            auditLogs: rows.rows,
            pagination: { page, limit, total: count.rows[0].count, totalPages: Math.ceil(count.rows[0].count / limit) }
        });
    } catch (error) {
        console.error("ADMIN AUDIT LOGS ERROR:", error);
        res.status(500).json({ message: "Unable to load audit logs" });
    }
};

const getSupportedAssets = (req, res) => {
    res.json({
        fiat: publicFiatConfig(),
        crypto: Object.entries(ASSET_NETWORKS).map(([asset, networks]) => ({
            asset,
            networks: networks.map(({ code, label, requiresMemo }) => ({ code, label, requiresMemo })),
            minDeposit: String(MIN_CRYPTO_DEPOSIT[asset] ?? 0),
            requiredConfirmations: CONFIRMATIONS_REQUIRED[asset] || 1,
            withdrawalFee: String(CRYPTO_WITHDRAWAL_FEES[asset] ?? 0)
        })),
        ...financeStatus()
    });
};

module.exports = {
    getDepositDetail,
    getWithdrawalDetail,
    recheckWithdrawalWithProvider,
    getReconciliation,
    getAuditLogs,
    getSupportedAssets
};
