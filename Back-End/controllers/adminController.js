const pool = require("../config/database");
const { createNotification } = require("../utils/notify");

// System-wide counters for the admin overview. Kept as simple aggregate
// queries run in parallel rather than a materialized/cached view — the
// data volumes here are demo-scale, so there's no need for the extra
// complexity a real analytics pipeline would eventually want.
const getStats = async (req, res) => {

    try {

        const [users, deposits, withdrawals, orders, transactions] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE is_verified = true)::int AS verified,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_7d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days'
                                       AND created_at < NOW() - INTERVAL '30 days')::int AS new_prev_30d,
                    -- No login tracking exists, so "active" means the user moved money
                    -- or traded (order, deposit or withdrawal) in the last 30 days.
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
                    COALESCE(SUM(net_amount) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED'), 0) AS fiat_total,
                    COUNT(*) FILTER (WHERE type = 'CRYPTO' AND status = 'COMPLETED')::int AS crypto_completed,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
                    COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
                FROM deposits
            `),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED')::int AS fiat_completed,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED'), 0) AS fiat_total,
                    COUNT(*) FILTER (WHERE type = 'CRYPTO' AND status = 'COMPLETED')::int AS crypto_completed,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'PENDING_CONFIRMATION')::int AS pending,
                    COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
                    COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired
                FROM withdrawals
            `),
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE side = 'BUY')::int AS buy,
                    COUNT(*) FILTER (WHERE side = 'SELL')::int AS sell,
                    COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
                    COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0) AS volume,
                    COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'
                        AND created_at >= NOW() - INTERVAL '30 days'), 0) AS volume_30d,
                    COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'
                        AND created_at >= NOW() - INTERVAL '60 days'
                        AND created_at < NOW() - INTERVAL '30 days'), 0) AS volume_prev_30d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS count_30d,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days'
                        AND created_at < NOW() - INTERVAL '30 days')::int AS count_prev_30d
                FROM orders
            `),
            pool.query("SELECT COUNT(*)::int AS total FROM transactions")
        ]);

        const u = users.rows[0];
        const d = deposits.rows[0];
        const w = withdrawals.rows[0];
        const o = orders.rows[0];

        res.json({
            users: {
                total: u.total,
                verified: u.verified,
                newLast7Days: u.new_7d,
                newLast30Days: u.new_30d,
                newPrevious30Days: u.new_prev_30d,
                activeLast30Days: u.active_30d
            },
            deposits: {
                fiatCompletedCount: d.fiat_completed,
                fiatCompletedTotalUsd: Number(d.fiat_total),
                cryptoCompletedCount: d.crypto_completed,
                pending: d.pending,
                statusCounts: { COMPLETED: d.completed, PENDING: d.pending, FAILED: d.failed }
            },
            withdrawals: {
                fiatCompletedCount: w.fiat_completed,
                fiatCompletedTotalUsd: Number(w.fiat_total),
                cryptoCompletedCount: w.crypto_completed,
                pendingConfirmation: w.pending,
                statusCounts: {
                    COMPLETED: w.completed,
                    PENDING_CONFIRMATION: w.pending,
                    CANCELLED: w.cancelled,
                    EXPIRED: w.expired
                }
            },
            orders: {
                buy: o.buy,
                sell: o.sell,
                total: o.total,
                statusCounts: { OPEN: o.open, COMPLETED: o.completed, CANCELLED: o.cancelled },
                volumeUsd: Number(o.volume),
                volumeLast30DaysUsd: Number(o.volume_30d),
                volumePrevious30DaysUsd: Number(o.volume_prev_30d),
                countLast30Days: o.count_30d,
                countPrevious30Days: o.count_prev_30d
            },
            transactions: {
                total: transactions.rows[0].total
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
                    WHERE status = 'COMPLETED' AND created_at >= (SELECT start FROM since)
                    GROUP BY 1
                ),
                d AS (
                    SELECT date_trunc($1, created_at) AS b, SUM(net_amount) AS usd
                    FROM deposits
                    WHERE type = 'FIAT' AND status = 'COMPLETED' AND created_at >= (SELECT start FROM since)
                    GROUP BY 1
                ),
                w AS (
                    SELECT date_trunc($1, created_at) AS b, SUM(amount) AS usd
                    FROM withdrawals
                    WHERE type = 'FIAT' AND status = 'COMPLETED' AND created_at >= (SELECT start FROM since)
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

        const result = await pool.query(
            "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role",
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

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

        const result = await pool.query(
            "UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_suspended",
            [suspended, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT d.id, d.user_id, u.email AS user_email, d.type, d.asset, d.amount, d.fee, d.net_amount,
                       d.payment_method, d.network, d.status, d.created_at
                FROM deposits d
                JOIN users u ON u.id = d.user_id
                ${whereClause}
                ORDER BY d.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM deposits d ${whereClause}`, params)
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT w.id, w.user_id, u.email AS user_email, w.type, w.asset, w.amount, w.fee, w.receive_amount,
                       w.destination_address, w.network, w.status, w.created_at
                FROM withdrawals w
                JOIN users u ON u.id = w.user_id
                ${whereClause}
                ORDER BY w.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM withdrawals w ${whereClause}`, params)
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
    const { reason } = req.body;

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const withdrawalResult = await client.query(
            "SELECT * FROM withdrawals WHERE id = $1 AND status = 'PENDING_CONFIRMATION' FOR UPDATE",
            [id]
        );

        if (withdrawalResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "No pending withdrawal found with that id" });
        }

        const withdrawal = withdrawalResult.rows[0];

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [withdrawal.user_id]
        );

        const walletId = walletResult.rows[0].id;

        await client.query(
            `
            UPDATE wallet_balances
            SET available_balance = available_balance + $1, locked_balance = locked_balance - $1, updated_at = NOW()
            WHERE wallet_id = $2 AND asset_symbol = $3
            `,
            [withdrawal.amount, walletId, withdrawal.asset]
        );

        await client.query(
            "UPDATE withdrawals SET status = 'CANCELLED', confirmation_token = NULL, updated_at = NOW() WHERE id = $1",
            [withdrawal.id]
        );

        await client.query("COMMIT");

        createNotification(withdrawal.user_id, {
            title: "Withdrawal rejected",
            message: `Your withdrawal of ${withdrawal.amount} ${withdrawal.asset} was rejected by our security team${reason ? `: ${reason}` : "."} The funds have been returned to your available balance.`,
            type: "SECURITY",
            link: "/withdraw"
        });

        res.json({ message: "Withdrawal rejected and funds released" });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("ADMIN REJECT WITHDRAWAL ERROR:", error);

        res.status(500).json({ message: "Unable to reject withdrawal" });

    } finally {

        client.release();

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
