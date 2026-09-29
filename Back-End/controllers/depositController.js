const pool = require("../config/database");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { initiateDeposit, verifySignature, assertPaymentsAvailable } = require("../services/paymentProviderService");
const { generateDepositAddress, generateFakeTxHash } = require("../services/cryptoDepositService");
const { DEPOSIT_FEE_RATES, MIN_DEPOSIT_USD, MAX_DEPOSIT_USD, PAYMENT_METHODS } = require("../config/paymentConfig");
const { CONFIRMATIONS_REQUIRED, MIN_CRYPTO_DEPOSIT, getNetworksForAsset, getNetworkConfig } = require("../config/cryptoNetworks");
const { SUPPORTED_ASSETS } = require("../config/tradingConfig");
const { demoAllowed } = require("../config/demoMode");
const { sendEmail } = require("../utils/emailService");
const { depositConfirmationEmail, cryptoDepositConfirmationEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

const paymentMethodSet = new Set(PAYMENT_METHODS);
const BACKEND_URL = `http://localhost:${process.env.PORT || 5000}`;

const DEPOSIT_COLUMNS = `
    id, type, asset, amount, fee, net_amount, payment_method, network,
    deposit_address, memo, tx_hash, status, confirmations, required_confirmations,
    created_at, updated_at, provider_reference
`;

const createFiatDeposit = async (req, res) => {

    try {
        assertPaymentsAvailable();
    } catch (error) {
        return res.status(error.status || 503).json({ message: error.message });
    }

    const userId = req.user.id;
    const { amount, paymentMethod, forceFail } = req.body;

    const depositAmount = Number(amount);

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
    }

    if (depositAmount < MIN_DEPOSIT_USD) {
        return res.status(400).json({ message: `Minimum deposit amount is $${MIN_DEPOSIT_USD}` });
    }

    if (depositAmount > MAX_DEPOSIT_USD) {
        return res.status(400).json({ message: `Maximum deposit amount is $${MAX_DEPOSIT_USD}` });
    }

    if (!paymentMethodSet.has(paymentMethod)) {
        return res.status(400).json({ message: "Invalid payment method" });
    }

    const feeRate = DEPOSIT_FEE_RATES[paymentMethod] ?? 0;
    const fee = Number((depositAmount * feeRate).toFixed(2));
    const netAmount = Number((depositAmount - fee).toFixed(2));
    const reference = `DEP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    try {

        const result = await pool.query(
            `
            INSERT INTO deposits(user_id, type, asset, amount, fee, net_amount, payment_method, status, provider_reference)
            VALUES($1, 'FIAT', 'USD', $2, $3, $4, $5, 'PENDING', $6)
            RETURNING id, type, asset, amount, fee, net_amount, payment_method, status, created_at, provider_reference
            `,
            [userId, depositAmount, fee, netAmount, paymentMethod, reference]
        );

        const deposit = result.rows[0];

        // Demo mode only: simulates the provider calling our webhook shortly
        // after. In production this call would not exist — the real provider
        // hits /api/webhooks/payments on its own schedule.
        initiateDeposit({
            amount: depositAmount,
            currency: "USD",
            method: paymentMethod,
            reference,
            webhookUrl: `${BACKEND_URL}/api/webhooks/payments`,
            forceFail: forceFail === true
        });

        res.status(201).json({
            message: "Deposit initiated. It will be confirmed shortly.",
            deposit
        });

    } catch (error) {

        console.error("CREATE FIAT DEPOSIT ERROR:", error);

        res.status(500).json({ message: "Unable to initiate deposit" });

    }

};

const getDeposits = async (req, res) => {

    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    try {

        const result = await pool.query(
            `
            SELECT ${DEPOSIT_COLUMNS}
            FROM deposits
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            `,
            [userId, limit]
        );

        res.json({ deposits: result.rows });

    } catch (error) {

        console.error("GET DEPOSITS ERROR:", error);

        res.status(500).json({ message: "Unable to load deposits" });

    }

};

const getDepositById = async (req, res) => {

    const userId = req.user.id;
    const { id } = req.params;

    try {

        const result = await pool.query(
            `
            SELECT ${DEPOSIT_COLUMNS}
            FROM deposits
            WHERE id = $1 AND user_id = $2
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Deposit not found" });
        }

        res.json({ deposit: result.rows[0] });

    } catch (error) {

        console.error("GET DEPOSIT ERROR:", error);

        res.status(500).json({ message: "Unable to load deposit" });

    }

};

// Handles the (simulated, in demo mode) payment provider webhook.
// Never trusts the frontend to confirm a payment — only a validly-signed
// webhook call can move a deposit from PENDING to COMPLETED/FAILED.
const handlePaymentWebhook = async (req, res) => {

    const signature = req.headers["x-webhook-signature"];
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);

    if (!verifySignature(rawBody, signature)) {
        return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const { reference, status } = req.body;

    if (!reference || !["completed", "failed"].includes(status)) {
        return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const depositResult = await client.query(
            "SELECT * FROM deposits WHERE provider_reference = $1 FOR UPDATE",
            [reference]
        );

        if (depositResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Deposit not found" });
        }

        const deposit = depositResult.rows[0];

        if (deposit.status !== "PENDING") {
            // Already processed — webhooks can be retried by providers,
            // so this must be a safe no-op, not an error.
            await client.query("ROLLBACK");
            return res.status(200).json({ message: "Already processed" });
        }

        if (status === "failed") {

            await client.query(
                "UPDATE deposits SET status = 'FAILED', updated_at = NOW() WHERE id = $1",
                [deposit.id]
            );

            await client.query("COMMIT");

            createNotification(deposit.user_id, {
                title: "Deposit failed",
                message: `Your deposit of $${Number(deposit.amount).toFixed(2)} could not be completed.`,
                type: "SECURITY",
                link: "/deposit"
            });

            return res.json({ message: "Deposit marked as failed" });

        }

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [deposit.user_id]
        );

        if (walletResult.rows.length === 0) {
            throw new Error("Wallet not found for deposit user");
        }

        const walletId = walletResult.rows[0].id;

        await client.query(
            `
            INSERT INTO wallet_balances(wallet_id, asset_symbol, available_balance)
            VALUES($1, 'USD', $2)
            ON CONFLICT (wallet_id, asset_symbol)
            DO UPDATE SET available_balance = wallet_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()
            `,
            [walletId, deposit.net_amount]
        );

        await client.query(
            "UPDATE deposits SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1",
            [deposit.id]
        );

        await client.query(
            `
            INSERT INTO transactions(user_id, type, asset, amount, fee, total, status, reference)
            VALUES($1, 'DEPOSIT', 'USD', $2, $3, $4, 'COMPLETED', $5)
            `,
            [deposit.user_id, deposit.amount, deposit.fee, deposit.net_amount, reference]
        );

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [deposit.user_id]
        );

        await client.query("COMMIT");

        const user = userResult.rows[0];

        if (user) {

            const email_ = depositConfirmationEmail({
                fullName: user.fullname,
                amount: deposit.amount,
                fee: deposit.fee,
                netAmount: deposit.net_amount,
                method: deposit.payment_method,
                reference
            });

            sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                .catch((err) => console.error("SEND DEPOSIT CONFIRMATION EMAIL FAILED:", err));

        }

        createNotification(deposit.user_id, {
            title: "Deposit completed",
            message: `$${Number(deposit.net_amount).toFixed(2)} has been added to your wallet.`,
            type: "SUCCESS",
            link: "/transactions"
        });

        res.json({ message: "Deposit completed" });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("PAYMENT WEBHOOK ERROR:", error);

        res.status(500).json({ message: "Unable to process webhook" });

    } finally {

        client.release();

    }

};

// Lists the networks available for an asset (e.g. USDT can arrive over
// ERC20, BEP20 or TRC20) so the frontend can render a network picker before
// requesting a deposit address.
const getCryptoNetworks = (req, res) => {

    const symbol = typeof req.query.asset === "string" ? req.query.asset.toUpperCase() : "";

    if (!SUPPORTED_ASSETS.includes(symbol)) {
        return res.status(400).json({ message: "Unsupported asset" });
    }

    res.json({ asset: symbol, networks: getNetworksForAsset(symbol) });

};

// Returns a persistent (get-or-create) demo deposit address for this user +
// asset + network. This is NOT a real chain address — nothing is watching it
// on any blockchain. A real implementation would call out to a custody
// provider (or derive from an HD wallet) here instead.
const getCryptoDepositAddress = async (req, res) => {

    const userId = req.user.id;
    const symbol = typeof req.query.asset === "string" ? req.query.asset.toUpperCase() : "";
    const networkCode = typeof req.query.network === "string" ? req.query.network.toUpperCase() : "";

    if (!SUPPORTED_ASSETS.includes(symbol)) {
        return res.status(400).json({ message: "Unsupported asset" });
    }

    const networkConfig = getNetworkConfig(symbol, networkCode);

    if (!networkConfig) {
        return res.status(400).json({ message: "Unsupported network for this asset" });
    }

    try {

        const existing = await pool.query(
            "SELECT address, memo FROM deposit_addresses WHERE user_id = $1 AND asset = $2 AND network = $3",
            [userId, symbol, networkCode]
        );

        let address;
        let memo;

        if (existing.rows.length > 0) {

            address = existing.rows[0].address;
            memo = existing.rows[0].memo;

        } else {

            const generated = generateDepositAddress(userId, symbol, networkCode);

            if (!generated) {
                return res.status(400).json({ message: "Unsupported network for this asset" });
            }

            address = generated.address;
            memo = generated.memo;

            await pool.query(
                `
                INSERT INTO deposit_addresses(user_id, asset, network, address, memo)
                VALUES($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, asset, network) DO NOTHING
                `,
                [userId, symbol, networkCode, address, memo]
            );

        }

        const qrPayload = memo ? `${address}?memo=${memo}` : address;
        const qrCode = await QRCode.toDataURL(qrPayload);

        res.json({
            asset: symbol,
            network: networkCode,
            networkLabel: networkConfig.label,
            address,
            memo,
            qrCode,
            minDeposit: MIN_CRYPTO_DEPOSIT[symbol] || 0,
            requiredConfirmations: CONFIRMATIONS_REQUIRED[symbol] || 1,
            demo: true,
            warning: "This is a simulated demo address. Do not send real cryptocurrency to it — funds sent here cannot be recovered."
        });

    } catch (error) {

        console.error("GET CRYPTO DEPOSIT ADDRESS ERROR:", error);

        res.status(500).json({ message: "Unable to generate deposit address" });

    }

};

// Demo/testnet only: since there is no real blockchain being watched, this
// endpoint stands in for the on-chain detection a real integration would
// perform automatically. It creates a PENDING deposit and then simulates
// confirmations arriving over time, crediting the wallet only once the
// required confirmation count is reached — mirroring how the Stage 8 fiat
// webhook only credits on a verified, asynchronous confirmation rather than
// trusting the initiating request.
const simulateCryptoDeposit = async (req, res) => {

    // Stands in for on-chain detection that doesn't exist; would mint
    // balances from nothing, so it is hidden entirely unless demo mode is on.
    if (!demoAllowed()) {
        return res.status(404).json({ message: "Route not found" });
    }

    const userId = req.user.id;
    const { asset, network, amount } = req.body;

    const symbol = typeof asset === "string" ? asset.toUpperCase() : "";
    const networkCode = typeof network === "string" ? network.toUpperCase() : "";
    const depositAmount = Number(amount);

    if (!SUPPORTED_ASSETS.includes(symbol)) {
        return res.status(400).json({ message: "Unsupported asset" });
    }

    const networkConfig = getNetworkConfig(symbol, networkCode);

    if (!networkConfig) {
        return res.status(400).json({ message: "Unsupported network for this asset" });
    }

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const minDeposit = MIN_CRYPTO_DEPOSIT[symbol] || 0;

    if (depositAmount < minDeposit) {
        return res.status(400).json({ message: `Minimum deposit amount is ${minDeposit} ${symbol}` });
    }

    const addressResult = await pool.query(
        "SELECT address, memo FROM deposit_addresses WHERE user_id = $1 AND asset = $2 AND network = $3",
        [userId, symbol, networkCode]
    );

    if (addressResult.rows.length === 0) {
        return res.status(400).json({ message: "Generate a deposit address for this asset/network first" });
    }

    const { address, memo } = addressResult.rows[0];
    const requiredConfirmations = CONFIRMATIONS_REQUIRED[symbol] || 1;
    const txHash = generateFakeTxHash();
    const reference = `CRYPTODEP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

    try {

        const result = await pool.query(
            `
            INSERT INTO deposits(
                user_id, type, asset, amount, fee, net_amount, network, deposit_address, memo,
                tx_hash, status, confirmations, required_confirmations, provider_reference
            )
            VALUES($1, 'CRYPTO', $2, $3, 0, $3, $4, $5, $6, $7, 'PENDING', 0, $8, $9)
            RETURNING ${DEPOSIT_COLUMNS}
            `,
            [userId, symbol, depositAmount, networkCode, address, memo, txHash, requiredConfirmations, reference]
        );

        const deposit = result.rows[0];

        scheduleConfirmationTicks(deposit.id, requiredConfirmations);

        res.status(201).json({
            message: "Deposit detected. Waiting for network confirmations.",
            deposit,
            demo: true
        });

    } catch (error) {

        console.error("SIMULATE CRYPTO DEPOSIT ERROR:", error);

        res.status(500).json({ message: "Unable to simulate deposit" });

    }

};

const CONFIRMATION_TICK_MS = 1500;

const scheduleConfirmationTicks = (depositId, requiredConfirmations) => {

    let confirmations = 0;

    const interval = setInterval(async () => {

        confirmations += 1;

        try {

            if (confirmations < requiredConfirmations) {

                await pool.query(
                    "UPDATE deposits SET confirmations = $1, updated_at = NOW() WHERE id = $2 AND status = 'PENDING'",
                    [confirmations, depositId]
                );

                return;

            }

            clearInterval(interval);

            await completeCryptoDeposit(depositId, confirmations);

        } catch (error) {

            clearInterval(interval);

            console.error("CRYPTO DEPOSIT CONFIRMATION TICK ERROR:", error);

        }

    }, CONFIRMATION_TICK_MS);

};

const completeCryptoDeposit = async (depositId, confirmations) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const depositResult = await client.query(
            "SELECT * FROM deposits WHERE id = $1 FOR UPDATE",
            [depositId]
        );

        const deposit = depositResult.rows[0];

        if (!deposit || deposit.status !== "PENDING") {
            // Already completed or gone — nothing to do.
            await client.query("ROLLBACK");
            return;
        }

        const walletResult = await client.query(
            "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
            [deposit.user_id]
        );

        if (walletResult.rows.length === 0) {
            throw new Error("Wallet not found for deposit user");
        }

        const walletId = walletResult.rows[0].id;

        await client.query(
            `
            INSERT INTO wallet_balances(wallet_id, asset_symbol, available_balance)
            VALUES($1, $2, $3)
            ON CONFLICT (wallet_id, asset_symbol)
            DO UPDATE SET available_balance = wallet_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()
            `,
            [walletId, deposit.asset, deposit.net_amount]
        );

        await client.query(
            "UPDATE deposits SET status = 'COMPLETED', confirmations = $1, updated_at = NOW() WHERE id = $2",
            [confirmations, deposit.id]
        );

        await client.query(
            `
            INSERT INTO transactions(user_id, type, asset, amount, fee, total, status, reference)
            VALUES($1, 'DEPOSIT', $2, $3, 0, $3, 'COMPLETED', $4)
            `,
            [deposit.user_id, deposit.asset, deposit.net_amount, deposit.provider_reference]
        );

        const userResult = await client.query(
            "SELECT fullname, email FROM users WHERE id = $1",
            [deposit.user_id]
        );

        await client.query("COMMIT");

        const user = userResult.rows[0];

        if (user) {

            const email_ = cryptoDepositConfirmationEmail({
                fullName: user.fullname,
                asset: deposit.asset,
                amount: deposit.net_amount,
                network: deposit.network,
                txHash: deposit.tx_hash,
                reference: deposit.provider_reference
            });

            sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                .catch((err) => console.error("SEND CRYPTO DEPOSIT CONFIRMATION EMAIL FAILED:", err));

        }

        createNotification(deposit.user_id, {
            title: "Deposit completed",
            message: `${Number(deposit.net_amount).toFixed(8)} ${deposit.asset} has been added to your wallet.`,
            type: "SUCCESS",
            link: "/transactions"
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("COMPLETE CRYPTO DEPOSIT ERROR:", error);

    } finally {

        client.release();

    }

};

module.exports = {
    createFiatDeposit,
    getDeposits,
    getDepositById,
    handlePaymentWebhook,
    getCryptoNetworks,
    getCryptoDepositAddress,
    simulateCryptoDeposit
};
