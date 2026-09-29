const pool = require("../config/database");

// The unified ledger every money-moving action (Stage 6-10) writes a row
// into once it actually completes — buys/sells write directly, deposits and
// withdrawals write only when their own async/email-confirmed lifecycle
// reaches COMPLETED. This controller is a read-only, filterable, paginated
// view over that existing table; it introduces no new write paths.
const VALID_TYPES = ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL"];
const VALID_STATUSES = ["PENDING", "COMPLETED", "FAILED"];

const parseFilters = (query) => {

    const conditions = [];
    const params = [];

    const addParam = (value) => {
        params.push(value);
        return `$${params.length}`;
    };

    if (query.type) {

        const types = String(query.type)
            .toUpperCase()
            .split(",")
            .map((t) => t.trim())
            .filter((t) => VALID_TYPES.includes(t));

        if (types.length > 0) {
            conditions.push(`type = ANY(${addParam(types)})`);
        }

    }

    if (query.asset) {
        conditions.push(`asset = ${addParam(String(query.asset).toUpperCase())}`);
    }

    if (query.status) {

        const status = String(query.status).toUpperCase();

        if (VALID_STATUSES.includes(status)) {
            conditions.push(`status = ${addParam(status)}`);
        }

    }

    if (query.startDate) {
        conditions.push(`created_at >= ${addParam(query.startDate)}`);
    }

    if (query.endDate) {
        conditions.push(`created_at <= ${addParam(query.endDate)}`);
    }

    return { conditions, params, addParam };

};

const getTransactions = async (req, res) => {

    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    try {

        const { conditions, params, addParam } = parseFilters(req.query);

        const userParam = addParam(userId);
        const whereClause = [`user_id = ${userParam}`, ...conditions].join(" AND ");

        const limitParam = addParam(limit);
        const offsetParam = addParam(offset);

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT id, type, asset, amount, fee, total, status, reference, tx_hash, metadata, created_at, updated_at
                FROM transactions
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ${limitParam} OFFSET ${offsetParam}
                `,
                params
            ),
            pool.query(
                `SELECT COUNT(*)::int AS count FROM transactions WHERE ${whereClause}`,
                params.slice(0, -2)
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

        console.error("GET TRANSACTIONS ERROR:", error);

        res.status(500).json({ message: "Unable to load transactions" });

    }

};

const getTransactionById = async (req, res) => {

    const userId = req.user.id;
    const { id } = req.params;

    try {

        const result = await pool.query(
            `
            SELECT id, type, asset, amount, fee, total, status, reference, tx_hash, metadata, created_at, updated_at
            FROM transactions
            WHERE id = $1 AND user_id = $2
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        res.json({ transaction: result.rows[0] });

    } catch (error) {

        console.error("GET TRANSACTION ERROR:", error);

        res.status(500).json({ message: "Unable to load transaction" });

    }

};

module.exports = { getTransactions, getTransactionById };
