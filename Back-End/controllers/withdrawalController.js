const pool = require("../config/database");
const crypto = require("crypto");
const { SUPPORTED_ASSETS } = require("../config/tradingConfig");
const { getUsdPrice } = require("../utils/assetPrices");
const { getNetworkConfig } = require("../config/cryptoNetworks");
const { generateFakeTxHash } = require("../services/cryptoDepositService");
const {
    CRYPTO_WITHDRAWAL_FEES,
    MIN_CRYPTO_WITHDRAWAL_USD,
    MAX_CRYPTO_WITHDRAWAL_USD,
    FIAT_WITHDRAWAL_FEE_RATE,
    MIN_FIAT_WITHDRAWAL_USD,
    MAX_FIAT_WITHDRAWAL_USD,
    WITHDRAWAL_CONFIRMATION_TTL_MS,
    isValidAddress
} = require("../config/withdrawalConfig");
const { sendEmail } = require("../utils/emailService");
const { withdrawalConfirmationRequestEmail, withdrawalCompletedEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const WITHDRAWAL_COLUMNS = `
    id, type, asset, amount, fee, receive_amount, destination_address, network,
    bank_details, status, tx_hash, created_at, updated_at
`;

// Reserves funds against a request: moves `amount` out of available_balance
// into locked_balance so it can't be spent (bought, sold, or withdrawn again)
// while the confirmation email is outstanding. Requires an available balance
// check inside the same locked transaction to avoid a race with a concurrent
// buy/sell/withdrawal for the same user.
const reserveBalance = async (client, userId, asset, amount) => {

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
        [walletId, asset]
    );

    const availableBalance = Number(balanceResult.rows[0]?.available_balance || 0);

    if (availableBalance < amount) {
        throw Object.assign(new Error("Insufficient balance"), { status: 400 });
    }

    await client.query(
        `
        UPDATE wallet_balances
        SET available_balance = available_balance - $1, locked_balance = locked_balance + $1, updated_at = NOW()
        WHERE wallet_id = $2 AND asset_symbol = $3 AND available_balance >= $1
        `,
        [amount, walletId, asset]
    );

    return walletId;

};

const createWithdrawalRequestEmail = async ({ user, asset, amount, receiveAmount, destination, confirmationToken }) => {

    const confirmUrl = `${FRONTEND_URL}/withdrawals/confirm?token=${confirmationToken}`;

    const email_ = withdrawalConfirmationRequestEmail({
        fullName: user.fullname,
        asset,
        amount,
        receiveAmount,
        destination,
        confirmUrl
    });

    sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
        .catch((err) => console.error("SEND WITHDRAWAL CONFIRMATION REQUEST EMAIL FAILED:", err));

    createNotification(user.id, {
        title: "Withdrawal requires confirmation",
        message: `Check your email to confirm your ${asset} withdrawal. This link expires in 15 minutes.`,
        type: "SECURITY",
        link: asset === "USD" ? "/withdraw" : "/withdraw/crypto"
    });

};

const requestCryptoWithdrawal = async (req, res) => {

    const userId = req.user.id;
    const { asset, network, amount, address, memo } = req.body;

    const symbol = typeof asset === "string" ? asset.toUpperCase() : "";
    const networkCode = typeof network === "string" ? network.toUpperCase() : "";
    const withdrawAmount = Number(amount);

    if (!SUPPORTED_ASSETS.includes(symbol)) {
        return res.status(400).json({ message: "Unsupported asset" });
    }

    const networkConfig = getNetworkConfig(symbol, networkCode);

    if (!networkConfig) {
        return res.status(400).json({ message: "Unsupported network for this asset" });
    }

    if (!isValidAddress(networkCode, address)) {
        return res.status(400).json({ message: `That doesn't look like a valid ${networkConfig.label} address` });
    }

    if (networkConfig.requiresMemo && memo && !/^\d+$/.test(String(memo))) {
        return res.status(400).json({ message: "Destination tag/memo must be numeric" });
    }

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const fee = CRYPTO_WITHDRAWAL_FEES[symbol] || 0;

    if (withdrawAmount <= fee) {
        return res.status(400).json({ message: `Amount must be greater than the network fee (${fee} ${symbol})` });
    }

    const livePrice = await getUsdPrice(symbol);

    if (!livePrice || livePrice <= 0) {
        return res.status(502).json({ message: "Live price unavailable right now. Please try again shortly." });
    }

    const usdValue = withdrawAmount * livePrice;

    if (usdValue < MIN_CRYPTO_WITHDRAWAL_USD) {
        return res.status(400).json({ message: `Minimum withdrawal value is $${MIN_CRYPTO_WITHDRAWAL_USD}` });
    }

    if (usdValue > MAX_CRYPTO_WITHDRAWAL_USD) {
        return res.status(400).json({ message: `Maximum withdrawal value is $${MAX_CRYPTO_WITHDRAWAL_USD}` });
    }

    const receiveAmount = Number((withdrawAmount - fee).toFixed(8));
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const confirmationExpiresAt = new Date(Date.now() + WITHDRAWAL_CONFIRMATION_TTL_MS);

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        await reserveBalance(client, userId, symbol, withdrawAmount);

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [userId]
        );

        const result = await client.query(
            `
            INSERT INTO withdrawals(
                user_id, type, asset, amount, fee, receive_amount, destination_address, network,
                status, confirmation_token, confirmation_expires_at
            )
            VALUES($1, 'CRYPTO', $2, $3, $4, $5, $6, $7, 'PENDING_CONFIRMATION', $8, $9)
            RETURNING ${WITHDRAWAL_COLUMNS}
            `,
            [userId, symbol, withdrawAmount, fee, receiveAmount, address, networkCode, confirmationToken, confirmationExpiresAt]
        );

        await client.query("COMMIT");

        const user = userResult.rows[0];

        await createWithdrawalRequestEmail({
            user: { ...user, id: userId },
            asset: symbol,
            amount: withdrawAmount,
            receiveAmount,
            destination: address,
            confirmationToken
        });

        res.status(201).json({
            message: "Withdrawal requested. Check your email to confirm it.",
            withdrawal: result.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("CREATE CRYPTO WITHDRAWAL ERROR:", error);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to request withdrawal"
        });

    } finally {

        client.release();

    }

};

const requestFiatWithdrawal = async (req, res) => {

    const userId = req.user.id;
    const { amount, bankDetails } = req.body;

    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
    }

    if (withdrawAmount < MIN_FIAT_WITHDRAWAL_USD) {
        return res.status(400).json({ message: `Minimum withdrawal amount is $${MIN_FIAT_WITHDRAWAL_USD}` });
    }

    if (withdrawAmount > MAX_FIAT_WITHDRAWAL_USD) {
        return res.status(400).json({ message: `Maximum withdrawal amount is $${MAX_FIAT_WITHDRAWAL_USD}` });
    }

    const accountHolderName = bankDetails?.accountHolderName?.trim();
    const accountNumber = bankDetails?.accountNumber?.trim();
    const bankName = bankDetails?.bankName?.trim();

    if (!accountHolderName || !accountNumber || !bankName) {
        return res.status(400).json({ message: "Account holder name, account number and bank name are required" });
    }

    const fee = Number((withdrawAmount * FIAT_WITHDRAWAL_FEE_RATE).toFixed(2));
    const receiveAmount = Number((withdrawAmount - fee).toFixed(2));
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const confirmationExpiresAt = new Date(Date.now() + WITHDRAWAL_CONFIRMATION_TTL_MS);

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        await reserveBalance(client, userId, "USD", withdrawAmount);

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [userId]
        );

        const result = await client.query(
            `
            INSERT INTO withdrawals(
                user_id, type, asset, amount, fee, receive_amount, bank_details,
                status, confirmation_token, confirmation_expires_at
            )
            VALUES($1, 'FIAT', 'USD', $2, $3, $4, $5, 'PENDING_CONFIRMATION', $6, $7)
            RETURNING ${WITHDRAWAL_COLUMNS}
            `,
            [
                userId,
                withdrawAmount,
                fee,
                receiveAmount,
                JSON.stringify({ accountHolderName, accountNumber, bankName }),
                confirmationToken,
                confirmationExpiresAt
            ]
        );

        await client.query("COMMIT");

        const user = userResult.rows[0];

        await createWithdrawalRequestEmail({
            user: { ...user, id: userId },
            asset: "USD",
            amount: withdrawAmount,
            receiveAmount,
            destination: `${bankName} •••• ${accountNumber.slice(-4)}`,
            confirmationToken
        });

        res.status(201).json({
            message: "Withdrawal requested. Check your email to confirm it.",
            withdrawal: result.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("CREATE FIAT WITHDRAWAL ERROR:", error);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Unable to request withdrawal"
        });

    } finally {

        client.release();

    }

};

// Public — reached by clicking the link in the confirmation email, so it
// cannot require a JWT the way an in-app action would (same pattern as
// GET /api/auth/verify-email). The token itself is the credential.
const confirmWithdrawal = async (req, res) => {

    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ message: "Confirmation token is required" });
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const withdrawalResult = await client.query(
            `
            SELECT * FROM withdrawals
            WHERE confirmation_token = $1
            AND status = 'PENDING_CONFIRMATION'
            AND confirmation_expires_at > NOW()
            FOR UPDATE
            `,
            [token]
        );

        if (withdrawalResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "This confirmation link is invalid, expired, or already used" });
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
            SET locked_balance = locked_balance - $1, updated_at = NOW()
            WHERE wallet_id = $2 AND asset_symbol = $3
            `,
            [withdrawal.amount, walletId, withdrawal.asset]
        );

        const txHash = withdrawal.type === "CRYPTO" ? generateFakeTxHash() : null;
        const reference = `WD-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

        await client.query(
            `
            UPDATE withdrawals
            SET status = 'COMPLETED', tx_hash = $1, confirmation_token = NULL, updated_at = NOW()
            WHERE id = $2
            `,
            [txHash, withdrawal.id]
        );

        await client.query(
            `
            INSERT INTO transactions(user_id, type, asset, amount, fee, total, status, reference)
            VALUES($1, 'WITHDRAWAL', $2, $3, $4, $5, 'COMPLETED', $6)
            `,
            [withdrawal.user_id, withdrawal.asset, withdrawal.amount, withdrawal.fee, withdrawal.receive_amount, reference]
        );

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [withdrawal.user_id]
        );

        await client.query("COMMIT");

        const user = userResult.rows[0];

        if (user) {

            const email_ = withdrawalCompletedEmail({
                fullName: user.fullname,
                asset: withdrawal.asset,
                amount: withdrawal.amount,
                txHash,
                reference
            });

            sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                .catch((err) => console.error("SEND WITHDRAWAL COMPLETED EMAIL FAILED:", err));

        }

        createNotification(withdrawal.user_id, {
            title: "Withdrawal completed",
            message: `Your withdrawal of ${withdrawal.type === "CRYPTO" ? Number(withdrawal.amount).toFixed(8) : Number(withdrawal.amount).toFixed(2)} ${withdrawal.asset} has been processed.`,
            type: "SUCCESS",
            link: "/transactions"
        });

        res.json({ message: "Withdrawal confirmed and processed", withdrawalId: withdrawal.id });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("CONFIRM WITHDRAWAL ERROR:", error);

        res.status(500).json({ message: "Unable to confirm withdrawal" });

    } finally {

        client.release();

    }

};

const cancelWithdrawal = async (req, res) => {

    const userId = req.user.id;
    const { id } = req.params;

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const withdrawalResult = await client.query(
            `
            SELECT * FROM withdrawals
            WHERE id = $1 AND user_id = $2 AND status = 'PENDING_CONFIRMATION'
            FOR UPDATE
            `,
            [id, userId]
        );

        if (withdrawalResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "No pending withdrawal found with that id" });
        }

        const withdrawal = withdrawalResult.rows[0];

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [userId]
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

        res.json({ message: "Withdrawal cancelled and funds released" });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("CANCEL WITHDRAWAL ERROR:", error);

        res.status(500).json({ message: "Unable to cancel withdrawal" });

    } finally {

        client.release();

    }

};

// There is no scheduled sweep for expired-but-unconfirmed withdrawals in
// this demo — expiry is handled lazily, the first time a row is read after
// its confirmation window has passed, by releasing the reserved funds here.
const expireIfNeeded = async (withdrawal) => {

    if (withdrawal.status !== "PENDING_CONFIRMATION" || !withdrawal.confirmation_expires_at) {
        return withdrawal;
    }

    if (new Date(withdrawal.confirmation_expires_at) > new Date()) {
        return withdrawal;
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const lockedResult = await client.query(
            "SELECT * FROM withdrawals WHERE id = $1 AND status = 'PENDING_CONFIRMATION' FOR UPDATE",
            [withdrawal.id]
        );

        if (lockedResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return withdrawal;
        }

        const row = lockedResult.rows[0];

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [row.user_id]
        );

        const walletId = walletResult.rows[0].id;

        await client.query(
            `
            UPDATE wallet_balances
            SET available_balance = available_balance + $1, locked_balance = locked_balance - $1, updated_at = NOW()
            WHERE wallet_id = $2 AND asset_symbol = $3
            `,
            [row.amount, walletId, row.asset]
        );

        const updateResult = await client.query(
            `
            UPDATE withdrawals SET status = 'EXPIRED', confirmation_token = NULL, updated_at = NOW()
            WHERE id = $1
            RETURNING ${WITHDRAWAL_COLUMNS}
            `,
            [row.id]
        );

        await client.query("COMMIT");

        return updateResult.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("EXPIRE WITHDRAWAL ERROR:", error);

        return withdrawal;

    } finally {

        client.release();

    }

};

const getWithdrawals = async (req, res) => {

    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    try {

        const result = await pool.query(
            `
            SELECT ${WITHDRAWAL_COLUMNS}, confirmation_expires_at
            FROM withdrawals
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            `,
            [userId, limit]
        );

        const withdrawals = await Promise.all(result.rows.map(expireIfNeeded));

        res.json({ withdrawals });

    } catch (error) {

        console.error("GET WITHDRAWALS ERROR:", error);

        res.status(500).json({ message: "Unable to load withdrawals" });

    }

};

const getWithdrawalById = async (req, res) => {

    const userId = req.user.id;
    const { id } = req.params;

    try {

        const result = await pool.query(
            `
            SELECT ${WITHDRAWAL_COLUMNS}, confirmation_expires_at
            FROM withdrawals
            WHERE id = $1 AND user_id = $2
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Withdrawal not found" });
        }

        const withdrawal = await expireIfNeeded(result.rows[0]);

        res.json({ withdrawal });

    } catch (error) {

        console.error("GET WITHDRAWAL ERROR:", error);

        res.status(500).json({ message: "Unable to load withdrawal" });

    }

};

module.exports = {
    requestCryptoWithdrawal,
    requestFiatWithdrawal,
    confirmWithdrawal,
    cancelWithdrawal,
    getWithdrawals,
    getWithdrawalById
};
