const pool = require("../config/database");
const crypto = require("crypto");
const { getPrice } = require("../utils/assetPrices");
const { FEE_RATE, SUPPORTED_ASSETS } = require("../config/tradingConfig");
const { getFiatCurrency, DEFAULT_CURRENCY } = require("../config/fiatCurrencies");
const { getPaymentProvider, withTimeout } = require("../services/payments");
const { toUnits, toDecimalString, applyRate, multiply, divide } = require("../utils/money");
const { account, postJournal, lockBalance } = require("../services/ledger");
const { sendEmail } = require("../utils/emailService");
const { buyOrderEmail, sellOrderEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

// Market orders against the exchange (platform:trading is the counterparty),
// priced server-side from the live market in the order's fiat currency.
//   Buy:  pay `amount` of fiat (+ fee) from the wallet balance, or by an
//         instant card/bank charge through the payment provider.
//   Sell: sell `amount` of crypto for fiat (− fee) into the wallet.
// Each fill is one ledger journal, so balances, fees and the exchange's
// inventory always reconcile.
const BUY_METHODS = ["wallet", "card", "bank"];

const badRequest = (res, message) => res.status(400).json({ message });

const quotePrice = async (res, symbol, currency) => {
    const price = await getPrice(symbol, currency.code);
    if (!price || price <= 0) {
        res.status(502).json({ message: "Live price unavailable right now. Please try again shortly." });
        return null;
    }
    return toUnits(price.toFixed(8));
};

const createBuyOrder = async (req, res) => {

    const userId = req.user.id;
    const { asset, paymentMethod = "wallet" } = req.body;
    const symbol = typeof asset === "string" ? asset.toUpperCase() : "";
    const currency = getFiatCurrency(req.body.currency ?? DEFAULT_CURRENCY);
    // `amountUsd` is the field name older clients send.
    const rawAmount = req.body.amount ?? req.body.amountUsd;

    if (!SUPPORTED_ASSETS.includes(symbol)) return badRequest(res, "Unsupported asset");
    if (!currency) return badRequest(res, "Unsupported currency");
    if (!BUY_METHODS.includes(paymentMethod)) return badRequest(res, "Invalid payment method");

    let spend;
    try {
        spend = toUnits(rawAmount, { maxDecimals: currency.decimals });
    } catch (error) {
        return badRequest(res, error.message);
    }
    const fmt = (u) => `${currency.symbol}${toDecimalString(u, currency.decimals)}`;
    if (spend <= 0n) return badRequest(res, "Amount must be a positive number");
    if (spend < toUnits(currency.trade.min)) return badRequest(res, `Minimum purchase amount is ${fmt(toUnits(currency.trade.min))}`);
    if (spend > toUnits(currency.trade.max)) return badRequest(res, `Maximum purchase amount is ${fmt(toUnits(currency.trade.max))}`);

    // Price, fee and quantity are computed here; the frontend's numbers are
    // display-only and never trusted.
    const price = await quotePrice(res, symbol, currency);
    if (price === null) return;

    const fee = applyRate(spend, String(FEE_RATE), currency.decimals);
    const total = spend + fee;
    const quantity = divide(spend, price); // rounded down: never more crypto than was paid for
    if (quantity <= 0n) return badRequest(res, "Amount is too small to buy any of this asset");

    let funding = account.available(userId);
    let payment = { demo: false, providerReference: null };

    if (paymentMethod !== "wallet") {
        try {
            const provider = getPaymentProvider();
            const charge = await withTimeout(provider.chargeInstant({
                amount: toDecimalString(total, currency.decimals), currency: currency.code, method: paymentMethod
            }));
            if (!charge.success) return res.status(402).json({ message: "Payment failed. Please try a different payment method." });
            payment = { demo: provider.demo === true, providerReference: charge.providerReference };
            funding = account.external(provider.name);
        } catch (error) {
            return res.status(error.status || 502).json({ message: error.status ? error.message : "The payment provider is unavailable. Please try again later." });
        }
    }

    const reference = payment.providerReference || `BUY-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        if (paymentMethod === "wallet") {
            const balance = await lockBalance(client, userId, currency.code);
            if (balance.available < total) {
                throw Object.assign(new Error(`Insufficient ${currency.code} balance. You need ${fmt(total)} including the fee.`), { status: 400 });
            }
        }

        const order = (await client.query(
            `INSERT INTO orders (user_id, pair, side, type, price, amount, filled_amount, fee, total, status)
             VALUES ($1, $2, 'BUY', 'MARKET', $3, $4, $4, $5, $6, 'COMPLETED')
             RETURNING id, pair, side, type, price, amount, fee, total, status, created_at`,
            [userId, `${symbol}/${currency.code}`, toDecimalString(price), toDecimalString(quantity), toDecimalString(fee), toDecimalString(spend)]
        )).rows[0];

        await postJournal(client, {
            key: `order:${order.id}:fill`,
            kind: "TRADE_BUY",
            referenceType: "order",
            referenceId: order.id,
            description: `Buy ${toDecimalString(quantity)} ${symbol} at ${toDecimalString(price, currency.decimals)} ${currency.code}`,
            entries: [
                { account: funding, asset: currency.code, amount: -total },
                { account: account.trading, asset: currency.code, amount: spend },
                { account: account.fees, asset: currency.code, amount: fee },
                { account: account.trading, asset: symbol, amount: -quantity },
                { account: account.available(userId), asset: symbol, amount: quantity }
            ]
        });

        const transaction = (await client.query(
            `INSERT INTO transactions (user_id, type, asset, amount, fee, total, status, reference, metadata)
             VALUES ($1, 'BUY', $2, $3, $4, $5, 'COMPLETED', $6, $7)
             RETURNING id, type, asset, amount, fee, total, status, reference, created_at`,
            [userId, symbol, toDecimalString(quantity), toDecimalString(fee), toDecimalString(total), reference,
                JSON.stringify({ price: toDecimalString(price), currency: currency.code, paymentMethod, orderId: order.id, demo: payment.demo })]
        )).rows[0];

        const user = (await client.query("SELECT fullname, email FROM users WHERE id = $1", [userId])).rows[0];

        await client.query("COMMIT");

        if (user) {
            const email_ = buyOrderEmail({
                fullName: user.fullname, asset: symbol, cryptoAmount: toDecimalString(quantity),
                price: toDecimalString(price), fee: toDecimalString(fee), total: toDecimalString(total), reference, currency: currency.code
            });
            sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                .catch((err) => console.error("SEND BUY CONFIRMATION EMAIL FAILED:", err));
        }

        createNotification(userId, {
            title: "Buy order completed",
            message: `You bought ${toDecimalString(quantity)} ${symbol} for ${fmt(total)}.`,
            type: "SUCCESS",
            link: "/orderstrades"
        });

        res.status(201).json({ message: "Purchase completed", order, transaction, demo: payment.demo });

    } catch (error) {
        await client.query("ROLLBACK");
        if (!error.status) console.error("CREATE BUY ORDER ERROR:", error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to complete purchase" });
    } finally {
        client.release();
    }

};

const createSellOrder = async (req, res) => {

    const userId = req.user.id;
    const symbol = typeof req.body.asset === "string" ? req.body.asset.toUpperCase() : "";
    const currency = getFiatCurrency(req.body.currency ?? DEFAULT_CURRENCY);

    if (!SUPPORTED_ASSETS.includes(symbol)) return badRequest(res, "Unsupported asset");
    if (!currency) return badRequest(res, "Unsupported currency");

    let quantity;
    try {
        quantity = toUnits(req.body.amount);
    } catch (error) {
        return badRequest(res, error.message);
    }
    if (quantity <= 0n) return badRequest(res, "Amount must be a positive number");

    const price = await quotePrice(res, symbol, currency);
    if (price === null) return;

    const fmt = (u) => `${currency.symbol}${toDecimalString(u, currency.decimals)}`;
    const gross = multiply(quantity, price, currency.decimals);
    if (gross < toUnits(currency.trade.min)) return badRequest(res, `Minimum sale value is ${fmt(toUnits(currency.trade.min))}`);
    if (gross > toUnits(currency.trade.max)) return badRequest(res, `Maximum sale value is ${fmt(toUnits(currency.trade.max))}`);

    const fee = applyRate(gross, String(FEE_RATE), currency.decimals);
    const proceeds = gross - fee;
    const reference = `SELL-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const balance = await lockBalance(client, userId, symbol);
        if (balance.available < quantity) throw Object.assign(new Error("Insufficient balance"), { status: 400 });

        const order = (await client.query(
            `INSERT INTO orders (user_id, pair, side, type, price, amount, filled_amount, fee, total, status)
             VALUES ($1, $2, 'SELL', 'MARKET', $3, $4, $4, $5, $6, 'COMPLETED')
             RETURNING id, pair, side, type, price, amount, fee, total, status, created_at`,
            [userId, `${symbol}/${currency.code}`, toDecimalString(price), toDecimalString(quantity), toDecimalString(fee), toDecimalString(gross)]
        )).rows[0];

        await postJournal(client, {
            key: `order:${order.id}:fill`,
            kind: "TRADE_SELL",
            referenceType: "order",
            referenceId: order.id,
            description: `Sell ${toDecimalString(quantity)} ${symbol} at ${toDecimalString(price, currency.decimals)} ${currency.code}`,
            entries: [
                { account: account.available(userId), asset: symbol, amount: -quantity },
                { account: account.trading, asset: symbol, amount: quantity },
                { account: account.trading, asset: currency.code, amount: -gross },
                { account: account.available(userId), asset: currency.code, amount: proceeds },
                { account: account.fees, asset: currency.code, amount: fee }
            ]
        });

        const transaction = (await client.query(
            `INSERT INTO transactions (user_id, type, asset, amount, fee, total, status, reference, metadata)
             VALUES ($1, 'SELL', $2, $3, $4, $5, 'COMPLETED', $6, $7)
             RETURNING id, type, asset, amount, fee, total, status, reference, created_at`,
            [userId, symbol, toDecimalString(quantity), toDecimalString(fee), toDecimalString(proceeds), reference,
                JSON.stringify({ price: toDecimalString(price), currency: currency.code, orderId: order.id })]
        )).rows[0];

        const user = (await client.query("SELECT fullname, email FROM users WHERE id = $1", [userId])).rows[0];

        await client.query("COMMIT");

        if (user) {
            const email_ = sellOrderEmail({
                fullName: user.fullname, asset: symbol, cryptoAmount: toDecimalString(quantity), price: toDecimalString(price),
                fee: toDecimalString(fee), receiveAmount: toDecimalString(proceeds), reference, currency: currency.code
            });
            sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                .catch((err) => console.error("SEND SELL CONFIRMATION EMAIL FAILED:", err));
        }

        createNotification(userId, {
            title: "Sell order completed",
            message: `You sold ${toDecimalString(quantity)} ${symbol} for ${fmt(proceeds)}.`,
            type: "SUCCESS",
            link: "/orderstrades"
        });

        res.status(201).json({ message: "Sale completed", order, transaction });

    } catch (error) {
        await client.query("ROLLBACK");
        if (!error.status) console.error("CREATE SELL ORDER ERROR:", error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to complete sale" });
    } finally {
        client.release();
    }

};

const ORDER_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"];

const getOrders = async (req, res) => {

    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = ["user_id = $1"];
    const params = [userId];

    if (req.query.side && ["BUY", "SELL"].includes(String(req.query.side).toUpperCase())) {
        params.push(String(req.query.side).toUpperCase());
        conditions.push(`side = $${params.length}`);
    }

    if (req.query.status && ORDER_STATUSES.includes(String(req.query.status).toUpperCase())) {
        params.push(String(req.query.status).toUpperCase());
        conditions.push(`status = $${params.length}`);
    }

    if (req.query.asset) {
        params.push(`${String(req.query.asset).toUpperCase()}/%`);
        conditions.push(`pair LIKE $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    try {

        const [rowsResult, countResult] = await Promise.all([
            pool.query(
                `
                SELECT id, pair, side, type, price, amount, filled_amount, fee, total, status, created_at
                FROM orders
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [...params, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS count FROM orders WHERE ${whereClause}`,
                params
            )
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

        console.error("GET ORDERS ERROR:", error);

        res.status(500).json({ message: "Unable to load orders" });

    }

};

const getOrderById = async (req, res) => {

    const userId = req.user.id;
    const { id } = req.params;

    try {

        const result = await pool.query(
            `
            SELECT id, pair, side, type, price, amount, filled_amount, fee, total, status, created_at
            FROM orders
            WHERE id = $1 AND user_id = $2
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json({ order: result.rows[0] });

    } catch (error) {

        console.error("GET ORDER ERROR:", error);

        res.status(500).json({ message: "Unable to load order" });

    }

};

module.exports = { createBuyOrder, createSellOrder, getOrders, getOrderById };
