const pool = require("../config/database");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { getPaymentProvider, withTimeout } = require("../services/payments");
const { getCustodyProvider } = require("../services/custody");
const { CONFIRMATIONS_REQUIRED, MIN_CRYPTO_DEPOSIT, getNetworksForAsset, getNetworkConfig } = require("../config/cryptoNetworks");
const { SUPPORTED_ASSETS } = require("../config/tradingConfig");
const { getFiatCurrency, DEPOSIT_METHODS, DEFAULT_CURRENCY } = require("../config/fiatCurrencies");
const { demoAllowed } = require("../config/demoMode");
const { toUnits, toDecimalString, applyRate } = require("../utils/money");
const { account, postJournal } = require("../services/ledger");
const { upsertHistory, selfUrl } = require("../services/history");
const { sendEmail } = require("../utils/emailService");
const { depositConfirmationEmail, cryptoDepositConfirmationEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

// Deposit statuses
//   fiat:   PENDING -> COMPLETED | FAILED | UNDER_REVIEW (provider reported a different amount/currency)
//   crypto: DETECTED -> CONFIRMING -> COMPLETED | FAILED (reverted before credit)
//           | UNDER_REVIEW (below minimum, mismatching data, or reverted after credit)
// A deposit credits the wallet exactly once: the ledger journal key
// `deposit:<id>:credit` can only ever be posted one time.

const DEPOSIT_COLUMNS = `
    id, type, asset, amount, fee, net_amount, payment_method, network,
    deposit_address, memo, tx_hash, status, confirmations, required_confirmations,
    created_at, updated_at, completed_at, provider, provider_reference, instructions, failure_reason
`;

const badRequest = (res, message) => res.status(400).json({ message });

const symbolOf = (value) => (typeof value === "string" ? value.trim().toUpperCase() : "");

// ---------------------------------------------------------------- fiat

const createFiatDeposit = async (req, res) => {

    let provider;
    try {
        provider = getPaymentProvider();
    } catch (error) {
        return res.status(error.status || 503).json({ message: error.message });
    }

    const userId = req.user.id;
    const { amount, paymentMethod, forceFail } = req.body;
    const currency = getFiatCurrency(req.body.currency ?? DEFAULT_CURRENCY);

    if (!currency) return badRequest(res, "Unsupported currency");
    if (!DEPOSIT_METHODS.includes(paymentMethod)) return badRequest(res, "Invalid payment method");

    let units;
    try {
        units = toUnits(amount, { maxDecimals: currency.decimals });
    } catch (error) {
        return badRequest(res, error.message);
    }

    const fmt = (u) => `${currency.symbol}${toDecimalString(u, currency.decimals)}`;
    if (units <= 0n) return badRequest(res, "Amount must be a positive number");
    if (units < toUnits(currency.deposit.min)) return badRequest(res, `Minimum deposit amount is ${fmt(toUnits(currency.deposit.min))}`);
    if (units > toUnits(currency.deposit.max)) return badRequest(res, `Maximum deposit amount is ${fmt(toUnits(currency.deposit.max))}`);

    const fee = applyRate(units, currency.deposit.feeRates[paymentMethod] ?? "0", currency.decimals);
    const net = units - fee;
    const reference = `DEP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    const amountText = toDecimalString(units, currency.decimals);

    const client = await pool.connect();
    let deposit;

    try {
        await client.query("BEGIN");

        const inserted = await client.query(
            `INSERT INTO deposits (user_id, type, asset, amount, fee, net_amount, payment_method, status, provider, provider_reference)
             VALUES ($1, 'FIAT', $2, $3, $4, $5, $6, 'PENDING', $7, $8)
             RETURNING ${DEPOSIT_COLUMNS}`,
            [userId, currency.code, toDecimalString(units), toDecimalString(fee), toDecimalString(net), paymentMethod, provider.name, reference]
        );
        deposit = inserted.rows[0];

        await upsertHistory(client, {
            userId, type: "DEPOSIT", asset: currency.code, amount: toDecimalString(units), fee: toDecimalString(fee),
            total: toDecimalString(net), status: "PENDING", reference,
            metadata: { depositId: deposit.id, method: paymentMethod, provider: provider.name, demo: provider.demo === true }
        });

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        console.error("CREATE FIAT DEPOSIT ERROR:", error);
        return res.status(500).json({ message: "Unable to initiate deposit" });
    }
    client.release();

    // Ask the provider for the collection (and, for bank transfers, the
    // payment instructions). Nothing is credited here — only a verified
    // provider callback can complete the deposit.
    try {
        const collection = await withTimeout(provider.createDeposit({
            reference,
            amount: amountText,
            currency: currency.code,
            method: paymentMethod,
            webhookUrl: selfUrl("/api/webhooks/payments"),
            forceFail: forceFail === true && provider.demo === true
        }));

        const updated = await pool.query(
            `UPDATE deposits SET instructions = $2, provider_status = $3, updated_at = NOW()
             WHERE id = $1 RETURNING ${DEPOSIT_COLUMNS}`,
            [deposit.id, JSON.stringify(collection.instructions || null), collection.status || "pending"]
        );
        deposit = updated.rows[0];
    } catch (error) {
        console.error("PAYMENT PROVIDER CREATE DEPOSIT ERROR:", error.message);
        await failDeposit(deposit.id, "The payment provider could not create this deposit.");
        return res.status(502).json({ message: "The payment provider is unavailable. Please try again later." });
    }

    res.status(201).json({
        message: paymentMethod === "bank"
            ? "Deposit created. Follow the payment instructions; your wallet is credited once the payment is verified."
            : "Deposit created. Your wallet is credited once the payment is verified.",
        deposit,
        demo: provider.demo === true
    });
};

const failDeposit = async (depositId, reason) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const row = (await client.query(
            "UPDATE deposits SET status = 'FAILED', failure_reason = $2, updated_at = NOW() WHERE id = $1 AND status = 'PENDING' RETURNING *",
            [depositId, reason]
        )).rows[0];
        if (row) {
            await client.query(
                "UPDATE transactions SET status = 'FAILED', updated_at = NOW() WHERE user_id = $1 AND type = 'DEPOSIT' AND reference = $2",
                [row.user_id, row.provider_reference]
            );
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("FAIL DEPOSIT ERROR:", error);
    } finally {
        client.release();
    }
};

const formatFiat = (asset, value) => {
    const currency = getFiatCurrency(asset);
    return currency ? `${currency.symbol}${toDecimalString(toUnits(value), currency.decimals)}` : `${value} ${asset}`;
};

// Applies a verified payment-provider deposit event inside the caller's
// transaction. Returns { status, body, after } where `after` runs post-commit
// side effects (emails/notifications).
const applyPaymentDepositEvent = async (client, provider, event) => {
    const { reference, amount, currency, providerReference, reason } = event.data || {};
    const outcome = event.type === "deposit.completed" ? "completed" : "failed";

    const found = await client.query("SELECT * FROM deposits WHERE provider_reference = $1 AND type = 'FIAT' FOR UPDATE", [reference]);
    if (found.rows.length === 0) return { status: 404, body: { message: "Deposit not found" }, outcome: "unknown_reference" };

    const deposit = found.rows[0];

    if (deposit.provider && deposit.provider !== provider.name) {
        return { status: 400, body: { message: "Event is from a different provider" }, outcome: "provider_mismatch" };
    }

    if (deposit.status !== "PENDING") {
        // Providers retry deliveries: a late or repeated event is a safe no-op.
        return { status: 200, body: { message: "Already processed" }, outcome: `ignored_${deposit.status.toLowerCase()}` };
    }

    if (outcome === "failed") {
        await client.query(
            "UPDATE deposits SET status = 'FAILED', provider_status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1",
            [deposit.id, typeof reason === "string" ? reason.slice(0, 200) : "Payment failed"]
        );
        await upsertHistory(client, {
            userId: deposit.user_id, type: "DEPOSIT", asset: deposit.asset, amount: deposit.amount, fee: deposit.fee,
            total: deposit.net_amount, status: "FAILED", reference
        });
        return {
            status: 200,
            body: { message: "Deposit marked as failed" },
            outcome: "failed",
            after: () => createNotification(deposit.user_id, {
                title: "Deposit failed",
                message: `Your deposit of ${formatFiat(deposit.asset, deposit.amount)} could not be completed.`,
                type: "SECURITY",
                link: "/deposit"
            })
        };
    }

    // Never credit what we didn't ask for: the provider must report exactly
    // the amount and currency of this deposit.
    let reportedUnits = null;
    try {
        reportedUnits = toUnits(amount);
    } catch {
        reportedUnits = null;
    }
    if (reportedUnits !== toUnits(deposit.amount) || String(currency || "").toUpperCase() !== deposit.asset) {
        await client.query(
            `UPDATE deposits SET status = 'UNDER_REVIEW', provider_status = 'completed',
                 failure_reason = $2, updated_at = NOW() WHERE id = $1`,
            [deposit.id, `Provider reported ${amount ?? "no amount"} ${currency ?? ""}`.trim() + ` for a ${deposit.amount} ${deposit.asset} deposit`]
        );
        await upsertHistory(client, {
            userId: deposit.user_id, type: "DEPOSIT", asset: deposit.asset, amount: deposit.amount, fee: deposit.fee,
            total: deposit.net_amount, status: "UNDER_REVIEW", reference
        });
        return { status: 200, body: { message: "Deposit held for review" }, outcome: "amount_mismatch" };
    }

    await postJournal(client, {
        key: `deposit:${deposit.id}:credit`,
        kind: "DEPOSIT",
        referenceType: "deposit",
        referenceId: deposit.id,
        description: `Fiat deposit ${reference} via ${provider.name}`,
        entries: [
            { account: account.external(provider.name), asset: deposit.asset, amount: `-${deposit.amount}` },
            { account: account.available(deposit.user_id), asset: deposit.asset, amount: deposit.net_amount },
            { account: account.fees, asset: deposit.asset, amount: deposit.fee }
        ]
    });

    await client.query(
        `UPDATE deposits SET status = 'COMPLETED', provider_status = 'completed', completed_at = NOW(),
             updated_at = NOW() WHERE id = $1`,
        [deposit.id]
    );
    await upsertHistory(client, {
        userId: deposit.user_id, type: "DEPOSIT", asset: deposit.asset, amount: deposit.amount, fee: deposit.fee,
        total: deposit.net_amount, status: "COMPLETED", reference,
        metadata: { providerReference: providerReference || null }
    });

    const user = (await client.query("SELECT fullname, email FROM users WHERE id = $1", [deposit.user_id])).rows[0];

    return {
        status: 200,
        body: { message: "Deposit completed" },
        outcome: "credited",
        after: () => {
            if (user) {
                const email_ = depositConfirmationEmail({
                    fullName: user.fullname,
                    amount: deposit.amount,
                    fee: deposit.fee,
                    netAmount: deposit.net_amount,
                    method: deposit.payment_method,
                    reference,
                    currency: deposit.asset
                });
                sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                    .catch((err) => console.error("SEND DEPOSIT CONFIRMATION EMAIL FAILED:", err));
            }
            createNotification(deposit.user_id, {
                title: "Deposit completed",
                message: `${formatFiat(deposit.asset, deposit.net_amount)} has been added to your wallet.`,
                type: "SUCCESS",
                link: "/transactions"
            });
        }
    };
};

// ---------------------------------------------------------------- shared reads

const getDeposits = async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    try {
        const result = await pool.query(
            `SELECT ${DEPOSIT_COLUMNS} FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [req.user.id, limit]
        );
        res.json({ deposits: result.rows });
    } catch (error) {
        console.error("GET DEPOSITS ERROR:", error);
        res.status(500).json({ message: "Unable to load deposits" });
    }
};

const getDepositById = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${DEPOSIT_COLUMNS} FROM deposits WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Deposit not found" });
        res.json({ deposit: result.rows[0] });
    } catch (error) {
        console.error("GET DEPOSIT ERROR:", error);
        res.status(500).json({ message: "Unable to load deposit" });
    }
};

// ---------------------------------------------------------------- crypto

const getCryptoNetworks = (req, res) => {
    const symbol = symbolOf(req.query.asset);
    if (!SUPPORTED_ASSETS.includes(symbol)) return badRequest(res, "Unsupported asset");
    res.json({
        asset: symbol,
        networks: getNetworksForAsset(symbol),
        minDeposit: String(MIN_CRYPTO_DEPOSIT[symbol] ?? 0),
        requiredConfirmations: CONFIRMATIONS_REQUIRED[symbol] || 1
    });
};

// Get-or-create the customer's address for one asset on one network, as
// issued by the custody provider. One address per (user, asset, network);
// addresses are never shared across users, assets or networks.
const getCryptoDepositAddress = async (req, res) => {
    const userId = req.user.id;
    const symbol = symbolOf(req.query.asset);
    const networkCode = symbolOf(req.query.network);

    if (!SUPPORTED_ASSETS.includes(symbol)) return badRequest(res, "Unsupported asset");
    const networkConfig = getNetworkConfig(symbol, networkCode);
    if (!networkConfig) return badRequest(res, "Unsupported network for this asset");

    let custody;
    try {
        custody = getCustodyProvider();
    } catch (error) {
        return res.status(error.status || 503).json({ message: error.message });
    }

    try {
        let row = (await pool.query(
            "SELECT address, memo FROM deposit_addresses WHERE user_id = $1 AND asset = $2 AND network = $3",
            [userId, symbol, networkCode]
        )).rows[0];

        if (!row) {
            const issued = await custody.getDepositAddress({ userId, asset: symbol, network: networkCode });
            if (!issued?.address) return res.status(502).json({ message: "The custody provider could not issue an address" });

            await pool.query(
                `INSERT INTO deposit_addresses (user_id, asset, network, address, memo)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, asset, network) DO NOTHING`,
                [userId, symbol, networkCode, issued.address, issued.memo || null]
            );
            row = (await pool.query(
                "SELECT address, memo FROM deposit_addresses WHERE user_id = $1 AND asset = $2 AND network = $3",
                [userId, symbol, networkCode]
            )).rows[0];
        }

        const qrPayload = row.memo ? `${row.address}?memo=${row.memo}` : row.address;

        res.json({
            asset: symbol,
            network: networkCode,
            networkLabel: networkConfig.label,
            address: row.address,
            memo: row.memo,
            memoRequired: networkConfig.requiresMemo,
            qrCode: await QRCode.toDataURL(qrPayload),
            minDeposit: String(MIN_CRYPTO_DEPOSIT[symbol] ?? 0),
            requiredConfirmations: CONFIRMATIONS_REQUIRED[symbol] || 1,
            provider: custody.name,
            demo: custody.demo === true,
            warning: custody.demo
                ? "This is a simulated demo address. Do not send real cryptocurrency to it — funds sent here cannot be recovered."
                : `Send only ${symbol} on the ${networkConfig.label} network to this address. Other assets or networks will be lost.`
        });
    } catch (error) {
        console.error("GET CRYPTO DEPOSIT ADDRESS ERROR:", error);
        res.status(500).json({ message: "Unable to generate deposit address" });
    }
};

// Applies a verified custody deposit event (inside the caller's transaction).
const applyCustodyDepositEvent = async (client, custody, event) => {
    const d = event.data || {};
    const symbol = symbolOf(d.asset);
    const networkCode = symbolOf(d.network);
    const txHash = typeof d.txHash === "string" ? d.txHash.trim() : "";
    const address = typeof d.address === "string" ? d.address.trim() : "";
    const state = d.state;
    const confirmations = Number.isInteger(d.confirmations) && d.confirmations >= 0 ? d.confirmations : null;

    let units = null;
    try {
        units = toUnits(d.amount);
    } catch {
        units = null;
    }

    if (!txHash || !address || !getNetworkConfig(symbol, networkCode) || units === null || units <= 0n
        || confirmations === null || !["pending", "confirmed", "reverted"].includes(state)) {
        return { status: 400, body: { message: "Invalid deposit event" }, outcome: "invalid" };
    }

    // The destination must be an address we issued, for this asset+network.
    const owner = await client.query(
        "SELECT user_id FROM deposit_addresses WHERE network = $1 AND address = $2 AND asset = $3 AND COALESCE(memo, '') = COALESCE($4, '')",
        [networkCode, address, symbol, d.memo ?? null]
    );
    if (owner.rows.length === 0) {
        return { status: 200, body: { message: "Address not recognised; recorded for review" }, outcome: "unknown_address" };
    }
    const userId = owner.rows[0].user_id;
    const required = CONFIRMATIONS_REQUIRED[symbol] || 1;
    const amountText = toDecimalString(units);

    let deposit = (await client.query(
        "SELECT * FROM deposits WHERE type = 'CRYPTO' AND network = $1 AND tx_hash = $2 AND deposit_address = $3 FOR UPDATE",
        [networkCode, txHash, address]
    )).rows[0];

    if (!deposit) {
        if (state === "reverted") return { status: 200, body: { message: "Nothing to revert" }, outcome: "ignored_unknown_revert" };

        const belowMinimum = units < toUnits(String(MIN_CRYPTO_DEPOSIT[symbol] ?? 0));
        const reference = `CRYPTODEP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
        deposit = (await client.query(
            `INSERT INTO deposits (user_id, type, asset, amount, fee, net_amount, network, deposit_address, memo,
                                   tx_hash, status, confirmations, required_confirmations, provider, provider_reference, failure_reason)
             VALUES ($1, 'CRYPTO', $2, $3, 0, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12)
             RETURNING *`,
            [userId, symbol, amountText, networkCode, address, d.memo ?? null, txHash,
                belowMinimum ? "UNDER_REVIEW" : "DETECTED", required, custody.name, reference,
                belowMinimum ? `Below the ${MIN_CRYPTO_DEPOSIT[symbol]} ${symbol} minimum deposit` : null]
        )).rows[0];

        await upsertHistory(client, {
            userId, type: "DEPOSIT", asset: symbol, amount: amountText, total: amountText,
            status: deposit.status, reference, txHash,
            metadata: { depositId: deposit.id, network: networkCode, provider: custody.name, demo: custody.demo === true }
        });
        if (belowMinimum) return { status: 200, body: { message: "Deposit below minimum; held for review" }, outcome: "below_minimum" };
    } else if (toUnits(deposit.amount) !== units || deposit.asset !== symbol) {
        // Same transfer, different facts: something is wrong upstream.
        if (deposit.status !== "COMPLETED" && deposit.status !== "UNDER_REVIEW") {
            await client.query(
                "UPDATE deposits SET status = 'UNDER_REVIEW', failure_reason = $2, updated_at = NOW() WHERE id = $1",
                [deposit.id, `Conflicting event: ${amountText} ${symbol} reported for a ${deposit.amount} ${deposit.asset} deposit`]
            );
        }
        return { status: 200, body: { message: "Conflicting deposit data; held for review" }, outcome: "data_mismatch" };
    }

    if (state === "reverted") {
        if (deposit.status === "COMPLETED") {
            // Already credited: never silently debit a customer. An
            // administrator investigates and posts a correcting journal.
            await client.query(
                "UPDATE deposits SET status = 'UNDER_REVIEW', failure_reason = 'Transaction reverted on chain after it was credited', updated_at = NOW() WHERE id = $1",
                [deposit.id]
            );
            return { status: 200, body: { message: "Reverted after credit; held for review" }, outcome: "reverted_after_credit" };
        }
        if (["DETECTED", "CONFIRMING"].includes(deposit.status)) {
            await client.query(
                "UPDATE deposits SET status = 'FAILED', failure_reason = 'Transaction reverted on chain', updated_at = NOW() WHERE id = $1",
                [deposit.id]
            );
            await client.query(
                "UPDATE transactions SET status = 'FAILED', updated_at = NOW() WHERE user_id = $1 AND type = 'DEPOSIT' AND reference = $2",
                [deposit.user_id, deposit.provider_reference]
            );
        }
        return { status: 200, body: { message: "Deposit reverted" }, outcome: "reverted" };
    }

    if (!["DETECTED", "CONFIRMING"].includes(deposit.status)) {
        return { status: 200, body: { message: "Already processed" }, outcome: `ignored_${deposit.status.toLowerCase()}` };
    }

    // Confirmations only move forward (events can arrive out of order).
    const seen = Math.max(deposit.confirmations || 0, confirmations);

    if (state !== "confirmed" || seen < deposit.required_confirmations) {
        const status = seen > 0 ? "CONFIRMING" : "DETECTED";
        await client.query("UPDATE deposits SET confirmations = $2, status = $3, updated_at = NOW() WHERE id = $1", [deposit.id, seen, status]);
        await client.query(
            "UPDATE transactions SET status = $3, updated_at = NOW() WHERE user_id = $1 AND type = 'DEPOSIT' AND reference = $2",
            [deposit.user_id, deposit.provider_reference, status]
        );
        return { status: 200, body: { message: "Confirmation recorded" }, outcome: "confirming" };
    }

    await postJournal(client, {
        key: `deposit:${deposit.id}:credit`,
        kind: "DEPOSIT",
        referenceType: "deposit",
        referenceId: deposit.id,
        description: `${symbol} deposit ${txHash} on ${networkCode}`,
        entries: [
            { account: account.external(`custody:${custody.name}`), asset: symbol, amount: `-${deposit.net_amount}` },
            { account: account.available(deposit.user_id), asset: symbol, amount: deposit.net_amount }
        ]
    });
    await client.query(
        "UPDATE deposits SET status = 'COMPLETED', confirmations = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1",
        [deposit.id, seen]
    );
    await client.query(
        "UPDATE transactions SET status = 'COMPLETED', updated_at = NOW() WHERE user_id = $1 AND type = 'DEPOSIT' AND reference = $2",
        [deposit.user_id, deposit.provider_reference]
    );

    const user = (await client.query("SELECT fullname, email FROM users WHERE id = $1", [deposit.user_id])).rows[0];

    return {
        status: 200,
        body: { message: "Deposit completed" },
        outcome: "credited",
        after: () => {
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
                message: `${toDecimalString(toUnits(deposit.net_amount))} ${deposit.asset} has been added to your wallet.`,
                type: "SUCCESS",
                link: "/transactions"
            });
        }
    };
};

// Demo only: stands in for someone sending crypto to the customer's demo
// address. It doesn't touch the database; it makes the demo custodian emit
// signed chain events to /api/webhooks/custody, processed exactly like a
// real custodian's would be.
const simulateCryptoDeposit = async (req, res) => {
    if (!demoAllowed()) return res.status(404).json({ message: "Route not found" });

    let custody;
    try {
        custody = getCustodyProvider();
    } catch (error) {
        return res.status(error.status || 503).json({ message: error.message });
    }
    if (!custody.demo) return res.status(404).json({ message: "Route not found" });

    const userId = req.user.id;
    const symbol = symbolOf(req.body.asset);
    const networkCode = symbolOf(req.body.network);

    if (!SUPPORTED_ASSETS.includes(symbol)) return badRequest(res, "Unsupported asset");
    if (!getNetworkConfig(symbol, networkCode)) return badRequest(res, "Unsupported network for this asset");

    let units;
    try {
        units = toUnits(req.body.amount);
    } catch (error) {
        return badRequest(res, error.message);
    }
    if (units <= 0n) return badRequest(res, "Amount must be a positive number");

    const minDeposit = String(MIN_CRYPTO_DEPOSIT[symbol] ?? 0);
    if (units < toUnits(minDeposit)) return badRequest(res, `Minimum deposit amount is ${minDeposit} ${symbol}`);

    const addressRow = (await pool.query(
        "SELECT address, memo FROM deposit_addresses WHERE user_id = $1 AND asset = $2 AND network = $3",
        [userId, symbol, networkCode]
    )).rows[0];
    if (!addressRow) return badRequest(res, "Generate a deposit address for this asset/network first");

    const requiredConfirmations = CONFIRMATIONS_REQUIRED[symbol] || 1;
    const { txHash } = custody.simulateIncomingDeposit({
        asset: symbol,
        network: networkCode,
        address: addressRow.address,
        memo: addressRow.memo,
        amount: toDecimalString(units),
        requiredConfirmations,
        webhookUrl: selfUrl("/api/webhooks/custody")
    });

    res.status(202).json({
        message: "Demo transfer sent. The demo custodian will report it and its confirmations shortly.",
        txHash,
        requiredConfirmations,
        demo: true
    });
};

module.exports = {
    createFiatDeposit,
    getDeposits,
    getDepositById,
    applyPaymentDepositEvent,
    applyCustodyDepositEvent,
    getCryptoNetworks,
    getCryptoDepositAddress,
    simulateCryptoDeposit,
    DEPOSIT_COLUMNS
};
