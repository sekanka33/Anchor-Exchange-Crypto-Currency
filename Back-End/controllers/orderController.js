const pool = require("../config/database");
const crypto = require("crypto");
const { getUsdPrice } = require("../utils/assetPrices");
const { FEE_RATE, MIN_BUY_USD, MAX_BUY_USD, MIN_SELL_USD, MAX_SELL_USD, SUPPORTED_ASSETS } = require("../config/tradingConfig");
const { chargePaymentMethod } = require("../services/paymentProviderService");
const { sendEmail } = require("../utils/emailService");
const { buyOrderEmail, sellOrderEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");
const { PAYMENT_METHODS } = require("../config/paymentConfig");

const paymentMethodSet = new Set(PAYMENT_METHODS);

const createBuyOrder = async (req, res) => {

    const userId = req.user.id;
    const { asset, amountUsd, paymentMethod } = req.body;

    const symbol = typeof asset === "string" ? asset.toUpperCase() : "";
    const spendAmount = Number(amountUsd);

    if (!SUPPORTED_ASSETS.includes(symbol)) {
        return res.status(400).json({ message: "Unsupported asset" });
    }

    if (!Number.isFinite(spendAmount) || spendAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
    }

    if (spendAmount < MIN_BUY_USD) {
        return res.status(400).json({ message: `Minimum purchase amount is $${MIN_BUY_USD}` });
    }

    if (spendAmount > MAX_BUY_USD) {
        return res.status(400).json({ message: `Maximum purchase amount is $${MAX_BUY_USD}` });
    }

    if (!paymentMethodSet.has(paymentMethod)) {
        return res.status(400).json({ message: "Invalid payment method" });
    }

    // Price and fee are always computed server-side — the frontend's
    // displayed numbers are for UX only and are never trusted here.
    const livePrice = await getUsdPrice(symbol);

    if (!livePrice || livePrice <= 0) {
        return res.status(502).json({ message: "Live price unavailable right now. Please try again shortly." });
    }

    const fee = Number((spendAmount * FEE_RATE).toFixed(2));
    const totalCharged = Number((spendAmount + fee).toFixed(2));
    const cryptoAmount = spendAmount / livePrice;

    const payment = await chargePaymentMethod({
        amount: totalCharged,
        currency: "USD",
        method: paymentMethod
    });

    if (!payment.success) {
        return res.status(402).json({ message: "Payment failed. Please try a different payment method." });
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [userId]
        );

        if (walletResult.rows.length === 0) {
            throw Object.assign(new Error("Wallet not found"), { status: 404 });
        }

        const walletId = walletResult.rows[0].id;

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [userId]
        );

        const fullName = userResult.rows[0]?.fullname;
        const userEmail = userResult.rows[0]?.email || req.user.email;

        const orderResult = await client.query(
            `
            INSERT INTO orders(user_id, pair, side, type, price, amount, filled_amount, fee, total, status)
            VALUES($1, $2, 'BUY', 'MARKET', $3, $4, $4, $5, $6, 'COMPLETED')
            RETURNING id, pair, side, type, price, amount, fee, total, status, created_at
            `,
            [userId, `${symbol}/USD`, livePrice, cryptoAmount, fee, spendAmount]
        );

        const order = orderResult.rows[0];

        const txResult = await client.query(
            `
            INSERT INTO transactions(user_id, type, asset, amount, fee, total, status, reference, metadata)
            VALUES($1, 'BUY', $2, $3, $4, $5, 'COMPLETED', $6, $7)
            RETURNING id, type, asset, amount, fee, total, status, reference, created_at
            `,
            [
                userId,
                symbol,
                cryptoAmount,
                fee,
                totalCharged,
                payment.reference,
                JSON.stringify({ price: livePrice, paymentMethod, orderId: order.id, demo: payment.demo === true })
            ]
        );

        await client.query(
            `
            INSERT INTO wallet_balances(wallet_id, asset_symbol, available_balance)
            VALUES($1, $2, $3)
            ON CONFLICT (wallet_id, asset_symbol)
            DO UPDATE SET available_balance = wallet_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()
            `,
            [walletId, symbol, cryptoAmount]
        );

        await client.query("COMMIT");

        const email_ = buyOrderEmail({
            fullName,
            asset: symbol,
            cryptoAmount,
            price: livePrice,
            fee,
            total: totalCharged,
            reference: payment.reference
        });

        sendEmail({ to: userEmail, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND BUY CONFIRMATION EMAIL FAILED:", err));

        createNotification(userId, {
            title: "Buy order completed",
            message: `You bought ${cryptoAmount.toFixed(8)} ${symbol} for ${totalCharged.toFixed(2)} USD.`,
            type: "SUCCESS",
            link: "/orderstrades"
        });

        res.status(201).json({
            message: "Purchase completed",
            order,
            transaction: txResult.rows[0],
            demo: payment.demo === true
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("CREATE BUY ORDER ERROR:", error);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to complete purchase"
        });

    } finally {

        client.release();

    }

};

const createSellOrder = async (req, res) => {

    const userId = req.user.id;
    const { asset, amount } = req.body;

    const symbol = typeof asset === "string" ? asset.toUpperCase() : "";
    const sellAmount = Number(amount);

    if (!SUPPORTED_ASSETS.includes(symbol)) {
        return res.status(400).json({ message: "Unsupported asset" });
    }

    if (!Number.isFinite(sellAmount) || sellAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
    }

    // Price and fee are always computed server-side — the frontend's
    // displayed numbers are for UX only and are never trusted here.
    const livePrice = await getUsdPrice(symbol);

    if (!livePrice || livePrice <= 0) {
        return res.status(502).json({ message: "Live price unavailable right now. Please try again shortly." });
    }

    const grossUsd = sellAmount * livePrice;

    if (grossUsd < MIN_SELL_USD) {
        return res.status(400).json({ message: `Minimum sale value is $${MIN_SELL_USD}` });
    }

    if (grossUsd > MAX_SELL_USD) {
        return res.status(400).json({ message: `Maximum sale value is $${MAX_SELL_USD}` });
    }

    const fee = Number((grossUsd * FEE_RATE).toFixed(2));
    const receiveUsd = Number((grossUsd - fee).toFixed(2));

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [userId]
        );

        if (walletResult.rows.length === 0) {
            throw Object.assign(new Error("Wallet not found"), { status: 404 });
        }

        const walletId = walletResult.rows[0].id;

        const balanceResult = await client.query(
            "SELECT available_balance FROM wallet_balances WHERE wallet_id = $1 AND asset_symbol = $2",
            [walletId, symbol]
        );

        const availableBalance = Number(balanceResult.rows[0]?.available_balance || 0);

        if (availableBalance < sellAmount) {
            throw Object.assign(new Error("Insufficient balance"), { status: 400 });
        }

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [userId]
        );

        const fullName = userResult.rows[0]?.fullname;
        const userEmail = userResult.rows[0]?.email || req.user.email;

        const reference = `SELL-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

        const orderResult = await client.query(
            `
            INSERT INTO orders(user_id, pair, side, type, price, amount, filled_amount, fee, total, status)
            VALUES($1, $2, 'SELL', 'MARKET', $3, $4, $4, $5, $6, 'COMPLETED')
            RETURNING id, pair, side, type, price, amount, fee, total, status, created_at
            `,
            [userId, `${symbol}/USD`, livePrice, sellAmount, fee, grossUsd]
        );

        const order = orderResult.rows[0];

        const txResult = await client.query(
            `
            INSERT INTO transactions(user_id, type, asset, amount, fee, total, status, reference, metadata)
            VALUES($1, 'SELL', $2, $3, $4, $5, 'COMPLETED', $6, $7)
            RETURNING id, type, asset, amount, fee, total, status, reference, created_at
            `,
            [
                userId,
                symbol,
                sellAmount,
                fee,
                receiveUsd,
                reference,
                JSON.stringify({ price: livePrice, orderId: order.id })
            ]
        );

        await client.query(
            `
            UPDATE wallet_balances
            SET available_balance = available_balance - $1, updated_at = NOW()
            WHERE wallet_id = $2 AND asset_symbol = $3 AND available_balance >= $1
            `,
            [sellAmount, walletId, symbol]
        );

        await client.query(
            `
            INSERT INTO wallet_balances(wallet_id, asset_symbol, available_balance)
            VALUES($1, 'USD', $2)
            ON CONFLICT (wallet_id, asset_symbol)
            DO UPDATE SET available_balance = wallet_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()
            `,
            [walletId, receiveUsd]
        );

        await client.query("COMMIT");

        const email_ = sellOrderEmail({
            fullName,
            asset: symbol,
            cryptoAmount: sellAmount,
            price: livePrice,
            fee,
            receiveAmount: receiveUsd,
            reference
        });

        sendEmail({ to: userEmail, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND SELL CONFIRMATION EMAIL FAILED:", err));

        createNotification(userId, {
            title: "Sell order completed",
            message: `You sold ${sellAmount.toFixed(8)} ${symbol} for ${receiveUsd.toFixed(2)} USD.`,
            type: "SUCCESS",
            link: "/orderstrades"
        });

        res.status(201).json({
            message: "Sale completed",
            order,
            transaction: txResult.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("CREATE SELL ORDER ERROR:", error);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to complete sale"
        });

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
