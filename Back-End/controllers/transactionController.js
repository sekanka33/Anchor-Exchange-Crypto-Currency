const pool = require("../config/database");
const { FIAT_CURRENCIES } = require("../config/fiatCurrencies");

// The customer's activity feed: one row per buy/sell, and one per deposit or
// withdrawal from the moment it starts, whose status follows the underlying
// record (services/history.js). Balances themselves come from the ledger.
// Read-only, filterable, paginated, and always scoped to the signed-in user.
const VALID_TYPES = ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL"];
const VALID_STATUSES = [
    "PENDING", "DETECTED", "CONFIRMING", "PENDING_CONFIRMATION", "PROCESSING",
    "COMPLETED", "FAILED", "UNDER_REVIEW", "CANCELLED", "EXPIRED", "REJECTED"
];
const FIAT_ASSETS = Object.keys(FIAT_CURRENCIES);

const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(value) && !Number.isNaN(Date.parse(value));

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

    // Fiat currencies vs cryptocurrencies.
    if (query.category === "fiat") conditions.push(`asset = ANY(${addParam(FIAT_ASSETS)})`);
    if (query.category === "crypto") conditions.push(`NOT (asset = ANY(${addParam(FIAT_ASSETS)}))`);

    // Only activity that carried a fee.
    if (query.feesOnly === "true") conditions.push("fee > 0");

    if (query.search) {
        const term = addParam(`%${String(query.search).slice(0, 100)}%`);
        conditions.push(`(reference ILIKE ${term} OR tx_hash ILIKE ${term})`);
    }

    // A date-only end date includes that whole day.
    if (validDate(query.startDate)) {
        conditions.push(`created_at >= ${addParam(query.startDate)}`);
    }

    if (validDate(query.endDate)) {
        const end = /^\d{4}-\d{2}-\d{2}$/.test(query.endDate) ? `${query.endDate}T23:59:59.999Z` : query.endDate;
        conditions.push(`created_at <= ${addParam(end)}`);
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
