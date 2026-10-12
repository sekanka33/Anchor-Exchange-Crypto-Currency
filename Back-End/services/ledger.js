const { toUnits, toDecimalString } = require("../utils/money");

// The only code that changes balances. See db/migrations/004_ledger.sql for
// the account model. Callers pass a transaction client (BEGIN already run)
// so the journal, the wallet_balances update, and the business-record change
// (deposit/withdrawal/order status) commit or roll back together.

const account = {
    available: (userId) => `user:${userId}:available`,
    locked: (userId) => `user:${userId}:locked`,
    fees: "platform:fees",
    trading: "platform:trading",
    external: (name) => `external:${name}`
};

const USER_ACCOUNT = /^user:(\d+):(available|locked)$/;

const insufficientFunds = () => Object.assign(new Error("Insufficient balance"), { status: 400 });

// entries: [{ account, asset, amount }] with signed amounts (decimal string,
// number, or BigInt units): positive increases that account's balance.
// Returns { duplicate: true } without changing anything if `key` was already
// posted — that is what makes retried webhooks and double clicks harmless.
const postJournal = async (client, { key, kind, referenceType = null, referenceId = null, description = null, createdBy = null, entries }) => {
    if (!key || !kind || !Array.isArray(entries) || entries.length < 2) {
        throw new Error("postJournal needs a key, a kind and at least two entries");
    }

    const normalized = entries
        .map((e) => ({ account: e.account, asset: String(e.asset).toUpperCase(), units: toUnits(e.amount, { field: "Ledger amount" }) }))
        .filter((e) => e.units !== 0n);

    if (normalized.length < 2) throw new Error(`Journal ${key} needs at least two non-zero entries`);

    const totals = new Map();
    for (const e of normalized) totals.set(e.asset, (totals.get(e.asset) || 0n) + e.units);
    for (const [asset, total] of totals) {
        if (total !== 0n) throw new Error(`Journal ${key} does not balance for ${asset}`);
    }

    const journal = await client.query(
        `INSERT INTO ledger_journals (journal_key, kind, reference_type, reference_id, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (journal_key) DO NOTHING
         RETURNING id`,
        [key, kind, referenceType, referenceId, description, createdBy]
    );

    if (journal.rows.length === 0) return { duplicate: true };

    const journalId = journal.rows[0].id;
    const walletDeltas = new Map(); // "userId|asset" -> { userId, asset, available, locked }

    for (const e of normalized) {
        const match = USER_ACCOUNT.exec(e.account);
        const userId = match ? Number(match[1]) : null;

        await client.query(
            "INSERT INTO ledger_entries (journal_id, account, user_id, asset, amount) VALUES ($1, $2, $3, $4, $5)",
            [journalId, e.account, userId, e.asset, toDecimalString(e.units)]
        );

        if (match) {
            const slot = `${userId}|${e.asset}`;
            const delta = walletDeltas.get(slot) || { userId, asset: e.asset, available: 0n, locked: 0n };
            delta[match[2]] += e.units;
            walletDeltas.set(slot, delta);
        }
    }

    // Keep the wallet_balances read model in step. Its CHECK constraints
    // (migration 002) refuse a negative balance, which aborts the whole
    // transaction — so a journal can never overdraw a customer.
    for (const { userId, asset, available, locked } of walletDeltas.values()) {
        const wallet = await client.query("SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE", [userId]);
        if (wallet.rows.length === 0) throw Object.assign(new Error("Wallet not found"), { status: 404 });

        // UPDATE first, INSERT only for a first balance in this asset. (Not
        // INSERT ... ON CONFLICT: Postgres checks CHECK constraints on the
        // proposed insert row, so any debit would look like a negative
        // balance.) The wallet row lock above serialises journals for this
        // customer, so there is no insert race.
        const params = [wallet.rows[0].id, asset, toDecimalString(available), toDecimalString(locked)];
        try {
            const updated = await client.query(
                `UPDATE wallet_balances
                 SET available_balance = available_balance + $3, locked_balance = locked_balance + $4, updated_at = NOW()
                 WHERE wallet_id = $1 AND asset_symbol = $2`,
                params
            );
            if (updated.rowCount === 0) {
                await client.query(
                    "INSERT INTO wallet_balances (wallet_id, asset_symbol, available_balance, locked_balance) VALUES ($1, $2, $3, $4)",
                    params
                );
            }
        } catch (error) {
            if (error.code === "23514") throw insufficientFunds(); // check_violation: would go negative
            throw error;
        }
    }

    return { duplicate: false, journalId };
};

// Locks and returns a user's balance for an asset (call inside a transaction
// before deciding whether an operation is affordable).
const lockBalance = async (client, userId, asset) => {
    const wallet = await client.query("SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE", [userId]);
    if (wallet.rows.length === 0) throw Object.assign(new Error("Wallet not found"), { status: 404 });

    const row = await client.query(
        "SELECT available_balance, locked_balance FROM wallet_balances WHERE wallet_id = $1 AND asset_symbol = $2 FOR UPDATE",
        [wallet.rows[0].id, asset]
    );

    return {
        available: toUnits(row.rows[0]?.available_balance ?? "0"),
        locked: toUnits(row.rows[0]?.locked_balance ?? "0")
    };
};

// Compares every wallet balance with what the ledger says it should be, and
// checks every journal balances. Returns only the discrepancies (empty = clean).
const reconcile = async (db, { userId = null } = {}) => {
    const balances = await db.query(
        `WITH ledger AS (
             SELECT user_id, asset,
                    SUM(amount) FILTER (WHERE account LIKE '%:available') AS available,
                    SUM(amount) FILTER (WHERE account LIKE '%:locked') AS locked
             FROM ledger_entries
             WHERE user_id IS NOT NULL AND ($1::int IS NULL OR user_id = $1)
             GROUP BY user_id, asset
         ),
         wallet AS (
             SELECT w.user_id, wb.asset_symbol AS asset, wb.available_balance AS available, wb.locked_balance AS locked
             FROM wallet_balances wb JOIN wallets w ON w.id = wb.wallet_id
             WHERE $1::int IS NULL OR w.user_id = $1
         )
         SELECT COALESCE(w.user_id, l.user_id) AS user_id,
                COALESCE(w.asset, l.asset) AS asset,
                COALESCE(w.available, 0)::text AS wallet_available,
                COALESCE(l.available, 0)::text AS ledger_available,
                COALESCE(w.locked, 0)::text AS wallet_locked,
                COALESCE(l.locked, 0)::text AS ledger_locked
         FROM wallet w
         FULL OUTER JOIN ledger l ON l.user_id = w.user_id AND l.asset = w.asset
         WHERE COALESCE(w.available, 0) <> COALESCE(l.available, 0)
            OR COALESCE(w.locked, 0) <> COALESCE(l.locked, 0)
         ORDER BY 1, 2`,
        [userId]
    );

    const unbalanced = await db.query(
        `SELECT journal_id, asset, SUM(amount)::text AS total
         FROM ledger_entries GROUP BY journal_id, asset HAVING SUM(amount) <> 0`
    );

    return { balanceMismatches: balances.rows, unbalancedJournals: unbalanced.rows };
};

module.exports = { account, postJournal, lockBalance, reconcile };
