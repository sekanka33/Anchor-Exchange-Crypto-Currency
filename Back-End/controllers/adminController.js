const pool = require("../config/database");
const { recordAudit } = require("../services/auditLog");
const { closeBeforeSubmission, runInTransaction } = require("./withdrawalController");
const { reconcile } = require("../services/ledger");
const { createNotification } = require("../utils/notify");

// System-wide counters for the admin overview. Kept as simple aggregate
// queries run in parallel rather than a materialized/cached view — the
// data volumes here are demo-scale, so there's no need for the extra
// complexity a real analytics pipeline would eventually want.
// Metric definitions (also shown in the admin UI):
//  - customers: accounts with role 'user'; suspended = is_suspended.
//  - active: moved money or traded in the last 30 days (no login tracking exists).
//  - deposit/withdrawal totals: COMPLETED only, summed per currency — never
//    mixed with pending amounts, never added across currencies.
//  - volume: completed orders' fiat value, per quote currency.
//  - fees: platform:fees ledger balance per asset (what the exchange earned).
//  - reconciliation exceptions: ledger/balance mismatches plus deposits and
//    withdrawals held for review or stuck (see /api/admin/reconciliation).
const totalsByAsset = (rows, column) =>
    Object.fromEntries(rows.filter((r) => r[column] !== null).map((r) => [r.asset, String(r[column])]));

const getStats = async (req, res) => {
    try {
        const [users, deposits, depositTotals, withdrawals, withdrawalTotals, orders, volumes, fees, transactions, ledger, stuck] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE role = 'user')::int AS customers,
                    COUNT(*) FILTER (WHERE is_suspended = true)::int AS suspended,
                    COUNT(*) FILTER (WHERE is_verified = true)::int AS verified,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_7d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days'
                                       AND created_at < NOW() - INTERVAL '30 days')::int AS new_prev_30d,
                    (SELECT COUNT(DISTINCT user_id)::int FROM (
                        SELECT user_id FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'
                        UNION SELECT user_id FROM deposits WHERE created_at >= NOW() - INTERVAL '30 days'
                        UNION SELECT user_id FROM withdrawals WHERE created_at >= NOW() - INTERVAL '30 days'
                    ) active) AS active_30d
                FROM users
            `),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED')::int AS fiat_completed,
                    COUNT(*) FILTER (WHERE type = 'CRYPTO' AND status = 'COMPLETED')::int AS crypto_completed,
                    COUNT(*)::int AS total
                FROM deposits
            `),
            pool.query(`
                SELECT asset, SUM(net_amount) FILTER (WHERE status = 'COMPLETED') AS completed
                FROM deposits GROUP BY asset
            `),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED')::int AS fiat_completed,
                    COUNT(*) FILTER (WHERE type = 'CRYPTO' AND status = 'COMPLETED')::int AS crypto_completed,
                    COUNT(*)::int AS total
                FROM withdrawals
            `),
            pool.query(`
                SELECT asset, SUM(amount) FILTER (WHERE status = 'COMPLETED') AS completed
                FROM withdrawals GROUP BY asset
            `),
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE side = 'BUY')::int AS buy,
                    COUNT(*) FILTER (WHERE side = 'SELL')::int AS sell,
                    COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS count_30d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days'
                        AND created_at < NOW() - INTERVAL '30 days')::int AS count_prev_30d
                FROM orders
            `),
            pool.query(`
                SELECT split_part(pair, '/', 2) AS currency,
                       COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0) AS volume,
                       COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '30 days'), 0) AS volume_30d,
                       COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '60 days'
                                                     AND created_at < NOW() - INTERVAL '30 days'), 0) AS volume_prev_30d
                FROM orders GROUP BY 1
            `),
            pool.query("SELECT asset, SUM(amount) AS earned FROM ledger_entries WHERE account = 'platform:fees' GROUP BY asset"),
            pool.query("SELECT COUNT(*)::int AS total FROM transactions"),
            reconcile(pool),
            pool.query(`
                SELECT
                    (SELECT COUNT(*)::int FROM deposits WHERE status = 'UNDER_REVIEW'
                        OR (status IN ('PENDING', 'DETECTED', 'CONFIRMING') AND created_at < NOW() - INTERVAL '24 hours')) AS deposits,
                    (SELECT COUNT(*)::int FROM withdrawals WHERE status = 'UNDER_REVIEW'
                        OR (status = 'PROCESSING' AND COALESCE(submitted_at, updated_at) < NOW() - INTERVAL '1 hour')) AS withdrawals
            `)
        ]);

        // Every known status is always present (0 when unused), so charts and
        // clients can rely on the keys.
        const statusCounts = async (table, known) => {
            const counts = Object.fromEntries(known.map((s) => [s, 0]));
            for (const r of (await pool.query(`SELECT status, COUNT(*)::int AS n FROM ${table} GROUP BY status`)).rows) counts[r.status] = r.n;
            return counts;
        };
        const [depositStatus, withdrawalStatus] = await Promise.all([
            statusCounts("deposits", ["PENDING", "DETECTED", "CONFIRMING", "COMPLETED", "FAILED", "UNDER_REVIEW"]),
            statusCounts("withdrawals", ["PENDING_CONFIRMATION", "PROCESSING", "COMPLETED", "FAILED", "UNDER_REVIEW", "CANCELLED", "EXPIRED", "REJECTED"])
        ]);

        const u = users.rows[0];
        const d = deposits.rows[0];
        const w = withdrawals.rows[0];
        const o = orders.rows[0];
        const usdVolume = volumes.rows.find((r) => r.currency === "USD") || { volume: 0, volume_30d: 0, volume_prev_30d: 0 };
        const depositsCompleted = totalsByAsset(depositTotals.rows, "completed");
        const withdrawalsCompleted = totalsByAsset(withdrawalTotals.rows, "completed");

        res.json({
            users: {
                total: u.total,
                customers: u.customers,
                suspended: u.suspended,
                verified: u.verified,
                newLast7Days: u.new_7d,
                newLast30Days: u.new_30d,
                newPrevious30Days: u.new_prev_30d,
                activeLast30Days: u.active_30d
            },
            deposits: {
                total: d.total,
                fiatCompletedCount: d.fiat_completed,
                // USD only; other currencies are in completedTotals.
                fiatCompletedTotalUsd: Number(depositsCompleted.USD || 0),
                completedTotals: depositsCompleted,
                cryptoCompletedCount: d.crypto_completed,
                pending: (depositStatus.PENDING || 0) + (depositStatus.DETECTED || 0) + (depositStatus.CONFIRMING || 0),
                failed: depositStatus.FAILED || 0,
                underReview: depositStatus.UNDER_REVIEW || 0,
                statusCounts: depositStatus
            },
            withdrawals: {
                total: w.total,
                fiatCompletedCount: w.fiat_completed,
                fiatCompletedTotalUsd: Number(withdrawalsCompleted.USD || 0),
                completedTotals: withdrawalsCompleted,
                cryptoCompletedCount: w.crypto_completed,
                pendingConfirmation: withdrawalStatus.PENDING_CONFIRMATION || 0,
                processing: withdrawalStatus.PROCESSING || 0,
                failed: withdrawalStatus.FAILED || 0,
                underReview: withdrawalStatus.UNDER_REVIEW || 0,
                statusCounts: withdrawalStatus
            },
            orders: {
                buy: o.buy,
                sell: o.sell,
                total: o.total,
                statusCounts: { OPEN: o.open, COMPLETED: o.completed, CANCELLED: o.cancelled },
                // USD-quoted orders only; ZAR-quoted volume is in volumeByCurrency.
                volumeUsd: Number(usdVolume.volume),
                volumeLast30DaysUsd: Number(usdVolume.volume_30d),
                volumePrevious30DaysUsd: Number(usdVolume.volume_prev_30d),
                volumeByCurrency: Object.fromEntries(volumes.rows.map((r) => [r.currency, {
                    total: String(r.volume), last30Days: String(r.volume_30d), previous30Days: String(r.volume_prev_30d)
                }])),
                countLast30Days: o.count_30d,
                countPrevious30Days: o.count_prev_30d
            },
            fees: { earnedByAsset: totalsByAsset(fees.rows, "earned") },
            transactions: {
                total: transactions.rows[0].total
            },
            reconciliation: {
                exceptions: ledger.balanceMismatches.length + ledger.unbalancedJournals.length
                    + stuck.rows[0].deposits + stuck.rows[0].withdrawals,
                ledgerMismatches: ledger.balanceMismatches.length + ledger.unbalancedJournals.length
            }
        });
    } catch (error) {
        console.error("ADMIN GET STATS ERROR:", error);
        res.status(500).json({ message: "Unable to load system statistics" });
    }
};

// Time-bucketed platform activity for the admin charts. Short ranges are
// bucketed by day, longer ones by week/month so every chart has a readable
// number of bars. `unit` is only ever taken from this whitelist, never from
// the request, so it is safe to pass to date_trunc.
const HISTORY_RANGES = {
    "7d": { unit: "day", buckets: 7 },
    "30d": { unit: "day", buckets: 30 },
    "90d": { unit: "week", buckets: 13 },
    "180d": { unit: "week", buckets: 26 },
    "1y": { unit: "month", buckets: 12 }
};

// History charts are in USD: they include USD-quoted orders and USD fiat
// movements only. ZAR totals are reported per currency by /stats, never
// silently added as dollars.
const getStatsHistory = async (req, res) => {

    const range = HISTORY_RANGES[req.query.range] ? req.query.range : "30d";
    const { unit, buckets } = HISTORY_RANGES[range];

    try {

        const [series, topAssets] = await Promise.all([
            pool.query(
                `
                WITH buckets AS (
                    SELECT generate_series(
                        date_trunc($1, NOW()) - ($2::int - 1) * ('1 ' || $1)::interval,
                        date_trunc($1, NOW()),
                        ('1 ' || $1)::interval
                    ) AS start
                ),
                since AS (SELECT MIN(start) AS start FROM buckets),
                o AS (
                    SELECT date_trunc($1, created_at) AS b,
                           COALESCE(SUM(total) FILTER (WHERE side = 'BUY'), 0) AS buy_usd,
                           COALESCE(SUM(total) FILTER (WHERE side = 'SELL'), 0) AS sell_usd,
                           COUNT(*)::int AS orders
                    FROM orders
                WHERE status = 'COMPLETED' AND pair LIKE '%/USD' AND pair LIKE '%/USD' AND created_at >= (SELECT start FROM since)
                    GROUP BY 1
                ),
                d AS (
                    SELECT date_trunc($1, created_at) AS b, SUM(net_amount) AS usd
                    FROM deposits
                    WHERE type = 'FIAT' AND asset = 'USD' AND status = 'COMPLETED' AND created_at >= (SELECT start FROM since)
                    GROUP BY 1
                ),
                w AS (
                    SELECT date_trunc($1, created_at) AS b, SUM(amount) AS usd
                    FROM withdrawals
                    WHERE type = 'FIAT' AND asset = 'USD' AND status = 'COMPLETED' AND created_at >= (SELECT start FROM since)
                    GROUP BY 1
                ),
                u AS (
                    SELECT date_trunc($1, created_at) AS b, COUNT(*)::int AS n
                    FROM users
                    WHERE created_at >= (SELECT start FROM since)
                    GROUP BY 1
                )
                SELECT
                    to_char(buckets.start, 'YYYY-MM-DD') AS start,
                    COALESCE(o.buy_usd, 0) AS buy_usd,
                    COALESCE(o.sell_usd, 0) AS sell_usd,
                    COALESCE(o.orders, 0) AS orders,
                    COALESCE(d.usd, 0) AS deposits_usd,
                    COALESCE(w.usd, 0) AS withdrawals_usd,
                    COALESCE(u.n, 0) AS new_users
                FROM buckets
                LEFT JOIN o ON o.b = buckets.start
                LEFT JOIN d ON d.b = buckets.start
                LEFT JOIN w ON w.b = buckets.start
                LEFT JOIN u ON u.b = buckets.start
                ORDER BY buckets.start
                `,
                [unit, buckets]
            ),
            pool.query(
                `
                SELECT split_part(pair, '/', 1) AS asset,
                       COALESCE(SUM(total), 0) AS volume_usd,
                       COUNT(*)::int AS trades
                FROM orders
                WHERE status = 'COMPLETED'
                  AND created_at >= date_trunc($1, NOW()) - ($2::int - 1) * ('1 ' || $1)::interval
                GROUP BY 1
                ORDER BY volume_usd DESC
                LIMIT 5
                `,
                [unit, buckets]
            )
        ]);

        res.json({
            range,
            unit,
            series: series.rows.map((row) => ({
                start: row.start,
                buyVolumeUsd: Number(row.buy_usd),
                sellVolumeUsd: Number(row.sell_usd),
                volumeUsd: Number(row.buy_usd) + Number(row.sell_usd),
                orders: row.orders,
                depositsUsd: Number(row.deposits_usd),
                withdrawalsUsd: Number(row.withdrawals_usd),
                newUsers: row.new_users
            })),
            topAssets: topAssets.rows.map((row) => ({
                asset: row.asset,
                volumeUsd: Number(row.volume_usd),
                trades: row.trades
            }))
        });

    } catch (error) {

        console.error("ADMIN GET STATS HISTORY ERROR:", error);

        res.status(500).json({ message: "Unable to load activity history" });

    }

};

const getUsers = async (req, res) => {

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.search) {
        params.push(`%${req.query.search}%`);
        conditions.push(`(email ILIKE $${params.length} OR fullname ILIKE $${params.length} OR username ILIKE $${params.length})`);
    }

    if (req.query.role && ["user", "admin"].includes(req.query.role)) {
        params.push(req.query.role);
        conditions.push(`role = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT id, email, username, fullname, surname, role, is_verified, is_suspended, kyc_status, created_at
                FROM users
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM users ${whereClause}`, params)
        ]);

        res.json({
            users: rowsResult.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].count,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });

    } catch (error) {

        console.error("ADMIN GET USERS ERROR:", error);

        res.status(500).json({ message: "Unable to load users" });

    }

};

const getUserById = async (req, res) => {

    const { id } = req.params;

    try {

        const [userResult, walletResult, orderCountResult, depositCountResult, withdrawalCountResult] = await Promise.all([
            pool.query(
                `
                SELECT id, email, username, fullname, surname, country, phonenumber, role, is_verified, is_suspended, kyc_status, created_at
                FROM users WHERE id = $1
                `,
                [id]
            ),
            pool.query(
                `
                SELECT wb.asset_symbol, wb.available_balance, wb.locked_balance
                FROM wallets w
                JOIN wallet_balances wb ON wb.wallet_id = w.id
                WHERE w.user_id = $1
                ORDER BY wb.asset_symbol
                `,
                [id]
            ),
            pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1", [id]),
            pool.query("SELECT COUNT(*)::int AS count FROM deposits WHERE user_id = $1", [id]),
            pool.query("SELECT COUNT(*)::int AS count FROM withdrawals WHERE user_id = $1", [id])
        ]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            user: userResult.rows[0],
            balances: walletResult.rows,
            counts: {
                orders: orderCountResult.rows[0].count,
                deposits: depositCountResult.rows[0].count,
                withdrawals: withdrawalCountResult.rows[0].count
            }
        });

    } catch (error) {

        console.error("ADMIN GET USER ERROR:", error);

        res.status(500).json({ message: "Unable to load user" });

    }

};

const updateUserRole = async (req, res) => {

    const { id } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Role must be 'user' or 'admin'" });
    }

    try {

        if (Number(id) === req.user.id && role !== "admin") {

            const adminCount = await pool.query(
                "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND id != $1",
                [id]
            );

            if (adminCount.rows[0].count === 0) {
                return res.status(400).json({ message: "Cannot remove the last remaining admin" });
            }

        }

        const before = (await pool.query("SELECT role FROM users WHERE id = $1", [id])).rows[0];

        const result = await pool.query(
            "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role",
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        await recordAudit(pool, {
            actor: req.user, action: "USER_ROLE_CHANGE", targetType: "user", targetId: id,
            reason: typeof req.body.reason === "string" ? req.body.reason.slice(0, 500) : null,
            before: { role: before?.role }, after: { role }
        });

        createNotification(id, {
            title: role === "admin" ? "Admin access granted" : "Admin access removed",
            message: role === "admin"
                ? "Your account has been granted admin access."
                : "Your account's admin access has been removed.",
            type: "SECURITY",
            link: "/profile-setting"
        });

        res.json({ message: "User role updated", user: result.rows[0] });

    } catch (error) {

        console.error("ADMIN UPDATE USER ROLE ERROR:", error);

        res.status(500).json({ message: "Unable to update user role" });

    }

};

const setUserSuspension = async (req, res) => {

    const { id } = req.params;
    const { suspended } = req.body;

    if (typeof suspended !== "boolean") {
        return res.status(400).json({ message: "'suspended' must be true or false" });
    }

    if (Number(id) === req.user.id && suspended) {
        return res.status(400).json({ message: "You cannot suspend your own account" });
    }

    try {

        const before = (await pool.query("SELECT is_suspended FROM users WHERE id = $1", [id])).rows[0];

        const result = await pool.query(
            "UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_suspended",
            [suspended, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        await recordAudit(pool, {
            actor: req.user, action: suspended ? "USER_SUSPEND" : "USER_REINSTATE", targetType: "user", targetId: id,
            reason: typeof req.body.reason === "string" ? req.body.reason.slice(0, 500) : null,
            before: { is_suspended: before?.is_suspended }, after: { is_suspended: suspended }
        });

        createNotification(id, {
            title: suspended ? "Account suspended" : "Account reinstated",
            message: suspended
                ? "Your account has been suspended. Contact support for assistance."
                : "Your account has been reinstated. You can log in again.",
            type: "SECURITY"
        });

        res.json({ message: "User suspension updated", user: result.rows[0] });

    } catch (error) {

        console.error("ADMIN SET USER SUSPENSION ERROR:", error);

        res.status(500).json({ message: "Unable to update user" });

    }

};

const getAllTransactions = async (req, res) => {

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.type) {
        const types = String(req.query.type).toUpperCase().split(",").map((t) => t.trim());
        params.push(types);
        conditions.push(`t.type = ANY($${params.length})`);
    }

    if (req.query.status) {
        params.push(String(req.query.status).toUpperCase());
        conditions.push(`t.status = $${params.length}`);
    }

    if (req.query.userId) {
        params.push(req.query.userId);
        conditions.push(`t.user_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT t.id, t.user_id, u.email AS user_email, t.type, t.asset, t.amount, t.fee, t.total,
                       t.status, t.reference, t.tx_hash, t.created_at
                FROM transactions t
                JOIN users u ON u.id = t.user_id
                ${whereClause}
                ORDER BY t.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS count FROM transactions t ${whereClause}`,
                params
            )
        ]);

        res.json({
            transactions: rowsResult.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].count,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });

    } catch (error) {

        console.error("ADMIN GET TRANSACTIONS ERROR:", error);

        res.status(500).json({ message: "Unable to load transactions" });

    }

};

const getAllDeposits = async (req, res) => {

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.status) {
        params.push(String(req.query.status).toUpperCase());
        conditions.push(`d.status = $${params.length}`);
    }

    if (req.query.type) {
        params.push(String(req.query.type).toUpperCase());
        conditions.push(`d.type = $${params.length}`);
    }

    if (req.query.asset) {
        params.push(String(req.query.asset).toUpperCase());
        conditions.push(`d.asset = $${params.length}`);
    }

    if (req.query.search) {
        params.push(`%${String(req.query.search).slice(0, 200)}%`);
        conditions.push(`(d.provider_reference ILIKE $${params.length} OR d.tx_hash ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT d.id, d.user_id, u.email AS user_email, d.type, d.asset, d.amount, d.fee, d.net_amount,
                       d.payment_method, d.network, d.status, d.provider, d.provider_reference, d.tx_hash,
                       d.confirmations, d.required_confirmations, d.failure_reason, d.created_at, d.completed_at
                FROM deposits d
                JOIN users u ON u.id = d.user_id
                ${whereClause}
                ORDER BY d.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM deposits d JOIN users u ON u.id = d.user_id ${whereClause}`, params)
        ]);

        res.json({
            deposits: rowsResult.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].count,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });

    } catch (error) {

        console.error("ADMIN GET DEPOSITS ERROR:", error);

        res.status(500).json({ message: "Unable to load deposits" });

    }

};

const getAllWithdrawals = async (req, res) => {

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.status) {
        params.push(String(req.query.status).toUpperCase());
        conditions.push(`w.status = $${params.length}`);
    }

    if (req.query.type) {
        params.push(String(req.query.type).toUpperCase());
        conditions.push(`w.type = $${params.length}`);
    }

    if (req.query.asset) {
        params.push(String(req.query.asset).toUpperCase());
        conditions.push(`w.asset = $${params.length}`);
    }

    if (req.query.search) {
        params.push(`%${String(req.query.search).slice(0, 200)}%`);
        conditions.push(`('WD-' || w.id ILIKE $${params.length} OR w.provider_reference ILIKE $${params.length} OR w.tx_hash ILIKE $${params.length} OR w.destination_address ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT w.id, 'WD-' || w.id AS reference, w.user_id, u.email AS user_email, w.type, w.asset, w.amount, w.fee,
                       w.receive_amount, w.destination_address, w.network, w.status, w.provider, w.provider_reference,
                       w.provider_status, w.tx_hash, w.failure_reason, w.created_at, w.completed_at,
                       w.bank_details->>'bankName' AS bank_name,
                       COALESCE(w.bank_details->>'accountNumberMasked', '•••• ' || RIGHT(w.bank_details->>'accountNumber', 4)) AS bank_account_masked
                FROM withdrawals w
                JOIN users u ON u.id = w.user_id
                ${whereClause}
                ORDER BY w.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM withdrawals w JOIN users u ON u.id = w.user_id ${whereClause}`, params)
        ]);

        res.json({
            withdrawals: rowsResult.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].count,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });

    } catch (error) {

        console.error("ADMIN GET WITHDRAWALS ERROR:", error);

        res.status(500).json({ message: "Unable to load withdrawals" });

    }

};

// The one real admin write action on withdrawals: reject a still-pending
// (unconfirmed) request, e.g. for suspected fraud. This releases the
// reserved funds exactly like the user's own Stage 10 self-cancel — an
// admin can only stop a withdrawal before its email confirmation, never
// reverse one that already completed and left the ledger.
const rejectWithdrawal = async (req, res) => {
    const { id } = req.params;
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    if (reason.length < 5 || reason.length > 500) {
        return res.status(400).json({ message: "A reason (5-500 characters) is required to reject a withdrawal" });
    }

    try {
        const rejected = await runInTransaction(async (client) => {
            const closed = await closeBeforeSubmission(client, id, null, "REJECTED", `Rejected by an administrator: ${reason}`);
            if (!closed) return null;
            await recordAudit(client, {
                actor: req.user, action: "WITHDRAWAL_REJECT", targetType: "withdrawal", targetId: id, reason,
                before: { status: "PENDING_CONFIRMATION" },
                after: { status: "REJECTED", released: `${closed.amount} ${closed.asset}` }
            });
            return closed;
        });

        if (!rejected) {
            return res.status(404).json({ message: "No pending withdrawal found with that id" });
        }

        createNotification(rejected.user_id, {
            title: "Withdrawal rejected",
            message: `Your withdrawal of ${rejected.amount} ${rejected.asset} was rejected by our security team: ${reason}. The funds have been returned to your available balance.`,
            type: "SECURITY",
            link: "/transactions"
        });

        res.json({ message: "Withdrawal rejected and funds released" });
    } catch (error) {
        console.error("ADMIN REJECT WITHDRAWAL ERROR:", error);
        res.status(500).json({ message: "Unable to reject withdrawal" });
    }
};

const getAllOrders = async (req, res) => {

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.side && ["BUY", "SELL"].includes(String(req.query.side).toUpperCase())) {
        params.push(String(req.query.side).toUpperCase());
        conditions.push(`o.side = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT o.id, o.user_id, u.email AS user_email, o.pair, o.side, o.type, o.price, o.amount,
                       o.fee, o.total, o.status, o.created_at
                FROM orders o
                JOIN users u ON u.id = o.user_id
                ${whereClause}
                ORDER BY o.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM orders o ${whereClause}`, params)
        ]);

        res.json({
            orders: rowsResult.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].count,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });

    } catch (error) {

        console.error("ADMIN GET ORDERS ERROR:", error);

        res.status(500).json({ message: "Unable to load orders" });

    }

};

module.exports = {
    getStats,
    getStatsHistory,
    getUsers,
    getUserById,
    updateUserRole,
    setUserSuspension,
    getAllTransactions,
    getAllDeposits,
    getAllWithdrawals,
    rejectWithdrawal,
    getAllOrders
};
