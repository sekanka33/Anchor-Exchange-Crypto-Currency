const pool = require("../config/database");
const { createNotification } = require("../utils/notify");

// System-wide counters for the admin overview. Kept as simple aggregate
// queries run in parallel rather than a materialized/cached view — the
// data volumes here are demo-scale, so there's no need for the extra
// complexity a real analytics pipeline would eventually want.
const getStats = async (req, res) => {

    try {

        const [
            totalUsers,
            verifiedUsers,
            newUsers7d,
            fiatDeposits,
            cryptoDeposits,
            pendingDeposits,
            fiatWithdrawals,
            cryptoWithdrawals,
            pendingWithdrawals,
            buyOrders,
            sellOrders,
            totalTransactions
        ] = await Promise.all([
            pool.query("SELECT COUNT(*)::int AS count FROM users"),
            pool.query("SELECT COUNT(*)::int AS count FROM users WHERE is_verified = true"),
            pool.query("SELECT COUNT(*)::int AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
            pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(net_amount), 0) AS total FROM deposits WHERE type = 'FIAT' AND status = 'COMPLETED'"),
            pool.query("SELECT COUNT(*)::int AS count FROM deposits WHERE type = 'CRYPTO' AND status = 'COMPLETED'"),
            pool.query("SELECT COUNT(*)::int AS count FROM deposits WHERE status = 'PENDING'"),
            pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE type = 'FIAT' AND status = 'COMPLETED'"),
            pool.query("SELECT COUNT(*)::int AS count FROM withdrawals WHERE type = 'CRYPTO' AND status = 'COMPLETED'"),
            pool.query("SELECT COUNT(*)::int AS count FROM withdrawals WHERE status = 'PENDING_CONFIRMATION'"),
            pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE side = 'BUY'"),
            pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE side = 'SELL'"),
            pool.query("SELECT COUNT(*)::int AS count FROM transactions")
        ]);

        res.json({
            users: {
                total: totalUsers.rows[0].count,
                verified: verifiedUsers.rows[0].count,
                newLast7Days: newUsers7d.rows[0].count
            },
            deposits: {
                fiatCompletedCount: fiatDeposits.rows[0].count,
                fiatCompletedTotalUsd: Number(fiatDeposits.rows[0].total),
                cryptoCompletedCount: cryptoDeposits.rows[0].count,
                pending: pendingDeposits.rows[0].count
            },
            withdrawals: {
                fiatCompletedCount: fiatWithdrawals.rows[0].count,
                fiatCompletedTotalUsd: Number(fiatWithdrawals.rows[0].total),
                cryptoCompletedCount: cryptoWithdrawals.rows[0].count,
                pendingConfirmation: pendingWithdrawals.rows[0].count
            },
            orders: {
                buy: buyOrders.rows[0].count,
                sell: sellOrders.rows[0].count,
                total: buyOrders.rows[0].count + sellOrders.rows[0].count
            },
            transactions: {
                total: totalTransactions.rows[0].count
            }
        });

    } catch (error) {

        console.error("ADMIN GET STATS ERROR:", error);

        res.status(500).json({ message: "Unable to load system statistics" });

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
