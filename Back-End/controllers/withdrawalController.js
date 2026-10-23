const pool = require("../config/database");
const crypto = require("crypto");
const { SUPPORTED_ASSETS } = require("../config/tradingConfig");
const { getUsdPrice } = require("../utils/assetPrices");
const { getNetworkConfig } = require("../config/cryptoNetworks");
const {
    CRYPTO_WITHDRAWAL_FEES,
    MIN_CRYPTO_WITHDRAWAL_USD,
    MAX_CRYPTO_WITHDRAWAL_USD,
    WITHDRAWAL_CONFIRMATION_TTL_MS,
    isValidAddress
} = require("../config/withdrawalConfig");
const { getFiatCurrency, isFiat, DEFAULT_CURRENCY } = require("../config/fiatCurrencies");
const { toUnits, toDecimalString, applyRate, multiply } = require("../utils/money");
const { account, postJournal, lockBalance } = require("../services/ledger");
const { upsertHistory, selfUrl } = require("../services/history");
const beneficiaries = require("../services/beneficiaries");
const { getPaymentProvider, withTimeout } = require("../services/payments");
const { getCustodyProvider } = require("../services/custody");
const { sendEmail } = require("../utils/emailService");
const { withdrawalConfirmationRequestEmail, withdrawalCompletedEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Withdrawal statuses
//   PENDING_CONFIRMATION  funds reserved (available -> locked); waiting for the emailed link
//   PROCESSING            confirmed and submitted to the payout provider / custodian
//   COMPLETED             the provider confirmed the payout (locked funds leave the platform)
//   FAILED                the provider confirmed it did NOT pay (locked funds released)
//   UNDER_REVIEW          the provider's outcome is unknown: funds stay locked until it is established
//   CANCELLED / EXPIRED / REJECTED   closed before submission (locked funds released)
// Journals `withdrawal:<id>:reserve|settle|release` make each step happen at
// most once, whatever order or how many times callbacks arrive.

const WITHDRAWAL_COLUMNS = `
    id, type, asset, amount, fee, receive_amount, destination_address, network, memo,
    bank_details, status, tx_hash, provider, provider_reference, provider_status,
    failure_reason, created_at, updated_at, submitted_at, completed_at, confirmation_expires_at
`;

const referenceFor = (id) => `WD-${id}`;
const idFromReference = (reference) => {
    const match = /^WD-(\d{1,10})$/.exec(String(reference || ""));
    return match ? Number(match[1]) : null;
};

const badRequest = (res, message) => res.status(400).json({ message });

// Never return a full bank account number, even for rows created before
// beneficiaries were encrypted.
const present = (row) => {
    if (!row) return row;
    const details = row.bank_details && typeof row.bank_details === "object" ? { ...row.bank_details } : row.bank_details;
    if (details && details.accountNumber) {
        details.accountNumberMasked = `•••• ${String(details.accountNumber).slice(-4)}`;
        delete details.accountNumber;
    }
    return { ...row, bank_details: details, reference: referenceFor(row.id) };
};

const parseIdempotencyKey = (req) => {
    const raw = req.get("Idempotency-Key");
    if (raw === undefined) return { key: null };
    const key = String(raw).trim();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) return { error: "Idempotency-Key must be 8-100 letters, digits, '-' or '_'" };
    return { key };
};

const findByIdempotencyKey = async (db, userId, key) => {
    if (!key) return null;
    const result = await db.query(`SELECT ${WITHDRAWAL_COLUMNS} FROM withdrawals WHERE user_id = $1 AND idempotency_key = $2`, [userId, key]);
    return result.rows[0] || null;
};

const formatAmount = (asset, value) => {
    const fiat = getFiatCurrency(asset);
    return fiat && isFiat(asset)
        ? `${fiat.symbol}${toDecimalString(toUnits(value), fiat.decimals)}`
        : `${toDecimalString(toUnits(value))} ${asset}`;
};

const sendConfirmationRequest = ({ user, userId, asset, amount, receiveAmount, destination, confirmationToken }) => {
    const confirmUrl = `${FRONTEND_URL}/withdrawals/confirm?token=${confirmationToken}`;
    const email_ = withdrawalConfirmationRequestEmail({ fullName: user?.fullname, asset, amount, receiveAmount, destination, confirmUrl });

    if (user?.email) {
        sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND WITHDRAWAL CONFIRMATION REQUEST EMAIL FAILED:", err));
    }

    createNotification(userId, {
        title: "Withdrawal requires confirmation",
        message: `Check your email to confirm your ${asset} withdrawal. This link expires in 15 minutes.`,
        type: "SECURITY",
        link: isFiat(asset) ? "/withdraw" : "/withdraw/crypto"
    });
};

// Shared request path: reserve funds and create the PENDING_CONFIRMATION row
// in one transaction. `build` returns the type-specific columns.
const createWithdrawal = async (req, res, { asset, units, feeUnits, receiveUnits, columns, destinationLabel, decimals }) => {
    const userId = req.user.id;
    const { key, error } = parseIdempotencyKey(req);
    if (error) return badRequest(res, error);

    const previous = await findByIdempotencyKey(pool, userId, key);
    if (previous) return res.status(200).json({ message: "Withdrawal already requested", withdrawal: present(previous), idempotent: true });

    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const confirmationExpiresAt = new Date(Date.now() + WITHDRAWAL_CONFIRMATION_TTL_MS);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const balance = await lockBalance(client, userId, asset);
        if (balance.available < units) throw Object.assign(new Error("Insufficient balance"), { status: 400 });

        const names = Object.keys(columns);
        const values = Object.values(columns);
        const inserted = await client.query(
            `INSERT INTO withdrawals (user_id, asset, amount, fee, receive_amount, status, confirmation_token,
                                      confirmation_expires_at, idempotency_key, ${names.join(", ")})
             VALUES ($1, $2, $3, $4, $5, 'PENDING_CONFIRMATION', $6, $7, $8, ${names.map((_, i) => `$${i + 9}`).join(", ")})
             RETURNING ${WITHDRAWAL_COLUMNS}`,
            [userId, asset, toDecimalString(units), toDecimalString(feeUnits), toDecimalString(receiveUnits),
                confirmationToken, confirmationExpiresAt, key, ...values]
        );
        const withdrawal = inserted.rows[0];

        await postJournal(client, {
            key: `withdrawal:${withdrawal.id}:reserve`,
            kind: "WITHDRAWAL_RESERVE",
            referenceType: "withdrawal",
            referenceId: withdrawal.id,
            description: `Funds reserved for withdrawal ${referenceFor(withdrawal.id)}`,
            entries: [
                { account: account.available(userId), asset, amount: -units },
                { account: account.locked(userId), asset, amount: units }
            ]
        });

        await upsertHistory(client, {
            userId, type: "WITHDRAWAL", asset, amount: toDecimalString(units), fee: toDecimalString(feeUnits),
            total: toDecimalString(receiveUnits), status: "PENDING_CONFIRMATION", reference: referenceFor(withdrawal.id),
            metadata: { withdrawalId: withdrawal.id, destination: destinationLabel }
        });

        const user = (await client.query("SELECT fullname, email FROM users WHERE id = $1", [userId])).rows[0];

        await client.query("COMMIT");

        sendConfirmationRequest({
            user, userId, asset,
            amount: toDecimalString(units, decimals),
            receiveAmount: toDecimalString(receiveUnits, decimals),
            destination: destinationLabel,
            confirmationToken
        });

        res.status(201).json({ message: "Withdrawal requested. Check your email to confirm it.", withdrawal: present(withdrawal) });
    } catch (err) {
        await client.query("ROLLBACK");

        if (err.code === "23505" && key) {
            // A concurrent request with the same Idempotency-Key won the race.
            const winner = await findByIdempotencyKey(pool, userId, key);
            if (winner) return res.status(200).json({ message: "Withdrawal already requested", withdrawal: present(winner), idempotent: true });
        }

        console.error("CREATE WITHDRAWAL ERROR:", err.message);
        res.status(err.status || 500).json({ message: err.status ? err.message : "Unable to request withdrawal" });
    } finally {
        client.release();
    }
};

const requestCryptoWithdrawal = async (req, res) => {
    const { asset, network, amount, address, memo } = req.body;
    const symbol = typeof asset === "string" ? asset.toUpperCase() : "";
    const networkCode = typeof network === "string" ? network.toUpperCase() : "";

    if (!SUPPORTED_ASSETS.includes(symbol)) return badRequest(res, "Unsupported asset");

    const networkConfig = getNetworkConfig(symbol, networkCode);
    if (!networkConfig) return badRequest(res, "Unsupported network for this asset");
    if (!isValidAddress(networkCode, address)) return badRequest(res, `That doesn't look like a valid ${networkConfig.label} address`);
    if (memo !== undefined && memo !== null && memo !== "" && !/^\d{1,20}$/.test(String(memo))) {
        return badRequest(res, "Destination tag/memo must be numeric");
    }

    let units;
    try {
        units = toUnits(amount);
    } catch (error) {
        return badRequest(res, error.message);
    }
    if (units <= 0n) return badRequest(res, "Amount must be a positive number");

    const feeUnits = toUnits(String(CRYPTO_WITHDRAWAL_FEES[symbol] ?? 0));
    if (units <= feeUnits) {
        return badRequest(res, `Amount must be greater than the network fee (${toDecimalString(feeUnits)} ${symbol})`);
    }

    // Limits are expressed in USD value (live price, server-side).
    const livePrice = await getUsdPrice(symbol);
    if (!livePrice || livePrice <= 0) {
        return res.status(502).json({ message: "Live price unavailable right now. Please try again shortly." });
    }
    const usdValue = multiply(units, toUnits(livePrice.toFixed(8)), 2);
    if (usdValue < toUnits(String(MIN_CRYPTO_WITHDRAWAL_USD))) return badRequest(res, `Minimum withdrawal value is $${MIN_CRYPTO_WITHDRAWAL_USD}`);
    if (usdValue > toUnits(String(MAX_CRYPTO_WITHDRAWAL_USD))) return badRequest(res, `Maximum withdrawal value is $${MAX_CRYPTO_WITHDRAWAL_USD}`);

    return createWithdrawal(req, res, {
        asset: symbol,
        units,
        feeUnits,
        receiveUnits: units - feeUnits,
        decimals: 8,
        destinationLabel: address,
        columns: {
            type: "CRYPTO",
            destination_address: address,
            network: networkCode,
            memo: memo === undefined || memo === null || memo === "" ? null : String(memo)
        }
    });
};

const requestFiatWithdrawal = async (req, res) => {
    const userId = req.user.id;
    const currency = getFiatCurrency(req.body.currency ?? DEFAULT_CURRENCY);
    if (!currency) return badRequest(res, "Unsupported currency");

    let units;
    try {
        units = toUnits(req.body.amount, { maxDecimals: currency.decimals });
    } catch (error) {
        return badRequest(res, error.message);
    }
    const fmt = (u) => `${currency.symbol}${toDecimalString(u, currency.decimals)}`;
    if (units <= 0n) return badRequest(res, "Amount must be a positive number");
    if (units < toUnits(currency.withdrawal.min)) return badRequest(res, `Minimum withdrawal amount is ${fmt(toUnits(currency.withdrawal.min))}`);
    if (units > toUnits(currency.withdrawal.max)) return badRequest(res, `Maximum withdrawal amount is ${fmt(toUnits(currency.withdrawal.max))}`);

    // Destination: a saved beneficiary, or bank details that are saved (encrypted) now.
    let beneficiary;
    try {
        if (req.body.beneficiaryId !== undefined) {
            beneficiary = await beneficiaries.getBeneficiary(pool, userId, Number(req.body.beneficiaryId) || 0);
            if (!beneficiary) return badRequest(res, "Beneficiary not found");
        } else {
            beneficiary = await beneficiaries.saveBeneficiary(pool, userId, { ...req.body.bankDetails, currency: currency.code });
        }
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to save bank details" });
    }
    if (beneficiary.currency !== currency.code) return badRequest(res, `That beneficiary is for ${beneficiary.currency} payouts`);

    const feeUnits = applyRate(units, currency.withdrawal.feeRate, currency.decimals);
    const snapshot = beneficiaries.destinationSnapshot(beneficiary);

    return createWithdrawal(req, res, {
        asset: currency.code,
        units,
        feeUnits,
        receiveUnits: units - feeUnits,
        decimals: currency.decimals,
        destinationLabel: `${snapshot.bankName} ${snapshot.accountNumberMasked}`,
        columns: { type: "FIAT", bank_details: JSON.stringify(snapshot), beneficiary_id: beneficiary.id }
    });
};

// ---------------------------------------------------------------- lifecycle

// Returns reserved funds to the customer and closes the withdrawal. The
// journal key makes the release happen at most once, ever.
const releaseReservation = async (client, w, status, reason) => {
    await postJournal(client, {
        key: `withdrawal:${w.id}:release`,
        kind: "WITHDRAWAL_RELEASE",
        referenceType: "withdrawal",
        referenceId: w.id,
        description: `Withdrawal ${referenceFor(w.id)} ${status.toLowerCase()}: reserved funds released`,
        entries: [
            { account: account.locked(w.user_id), asset: w.asset, amount: `-${w.amount}` },
            { account: account.available(w.user_id), asset: w.asset, amount: w.amount }
        ]
    });
    const updated = await client.query(
        `UPDATE withdrawals SET status = $2, failure_reason = COALESCE($3, failure_reason), confirmation_token = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING ${WITHDRAWAL_COLUMNS}, user_id`,
        [w.id, status, reason]
    );
    await client.query(
        "UPDATE transactions SET status = $3, updated_at = NOW() WHERE user_id = $1 AND type = 'WITHDRAWAL' AND reference = $2",
        [w.user_id, referenceFor(w.id), status]
    );
    return updated.rows[0];
};

const externalAccountFor = (w) => (w.type === "CRYPTO" ? account.external(`custody:${w.provider}`) : account.external(w.provider));

// The provider confirmed the payout: the locked funds leave the platform
// (net amount to the provider, fee to the exchange).
const settleWithdrawal = async (client, w, txHash = null) => {
    await postJournal(client, {
        key: `withdrawal:${w.id}:settle`,
        kind: "WITHDRAWAL_PAYOUT",
        referenceType: "withdrawal",
        referenceId: w.id,
        description: `Withdrawal ${referenceFor(w.id)} paid out via ${w.provider}`,
        entries: [
            { account: account.locked(w.user_id), asset: w.asset, amount: `-${w.amount}` },
            { account: externalAccountFor(w), asset: w.asset, amount: w.receive_amount },
            { account: account.fees, asset: w.asset, amount: w.fee }
        ]
    });
    const updated = await client.query(
        `UPDATE withdrawals SET status = 'COMPLETED', provider_status = 'completed', tx_hash = COALESCE($2, tx_hash),
             completed_at = NOW(), failure_reason = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING ${WITHDRAWAL_COLUMNS}, user_id`,
        [w.id, txHash]
    );
    await upsertHistory(client, {
        userId: w.user_id, type: "WITHDRAWAL", asset: w.asset, amount: w.amount, fee: w.fee, total: w.receive_amount,
        status: "COMPLETED", reference: referenceFor(w.id), txHash
    });
    return updated.rows[0];
};

const completedSideEffects = async (client, w) => {
    const user = (await client.query("SELECT fullname, email FROM users WHERE id = $1", [w.user_id])).rows[0];
    return () => {
        if (user) {
            const email_ = withdrawalCompletedEmail({
                fullName: user.fullname, asset: w.asset, amount: w.receive_amount, txHash: w.tx_hash, reference: referenceFor(w.id)
            });
            sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
                .catch((err) => console.error("SEND WITHDRAWAL COMPLETED EMAIL FAILED:", err));
        }
        createNotification(w.user_id, {
            title: "Withdrawal completed",
            message: `Your withdrawal of ${formatAmount(w.asset, w.receive_amount)} has been paid out.`,
            type: "SUCCESS",
            link: "/transactions"
        });
    };
};

const failedSideEffect = (w) => () => createNotification(w.user_id, {
    title: "Withdrawal failed",
    message: `Your withdrawal of ${formatAmount(w.asset, w.amount)} could not be paid out. The funds are back in your available balance.`,
    type: "SECURITY",
    link: "/transactions"
});

const runInTransaction = async (work) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

// Sends a confirmed withdrawal to the provider. Runs outside any DB
// transaction (it's a network call), then records what is known:
//   accepted -> stays PROCESSING with the provider reference
//   rejected -> FAILED, funds released (the provider said it will not pay)
//   unknown  -> UNDER_REVIEW, funds stay locked (it might have paid)
const submitToProvider = async (w) => {
    const reference = referenceFor(w.id);
    let outcome;

    try {
        if (w.type === "CRYPTO") {
            const custody = getCustodyProvider();
            outcome = await withTimeout(custody.submitWithdrawal({
                reference, asset: w.asset, network: w.network, address: w.destination_address, memo: w.memo,
                amount: w.receive_amount, webhookUrl: selfUrl("/api/webhooks/custody")
            }));
        } else {
            const provider = getPaymentProvider();
            const beneficiary = w.beneficiary_id
                ? (await pool.query("SELECT * FROM bank_beneficiaries WHERE id = $1 AND user_id = $2", [w.beneficiary_id, w.user_id])).rows[0]
                : null;
            if (!beneficiary) throw Object.assign(new Error("No bank account on file for this payout"), { notSubmitted: true });
            let details;
            try {
                details = beneficiaries.payoutDetails(beneficiary);
            } catch {
                // Wrong/missing key or tampered row: never send a payout with
                // partial details, and never log what was (or wasn't) decrypted.
                throw Object.assign(new Error("Bank account details could not be read"), { notSubmitted: true });
            }
            outcome = await withTimeout(provider.createPayout({
                reference, amount: w.receive_amount, currency: w.asset,
                beneficiary: details,
                webhookUrl: selfUrl("/api/webhooks/payments")
            }));
        }
    } catch (error) {
        if (error.providerRejected) {
            return runInTransaction(async (client) => {
                const row = (await client.query("SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE", [w.id])).rows[0];
                if (row.status !== "PROCESSING") return row;
                const closed = await releaseReservation(client, row, "FAILED", error.message.slice(0, 200));
                return { ...closed, after: failedSideEffect(row) };
            });
        }

        if (error.notSubmitted) {
            // Nothing reached the provider, so nothing can have been paid; the
            // funds stay reserved until an administrator resolves it.
            console.error(`WITHDRAWAL ${reference} NOT SUBMITTED: ${error.message}`);
            return runInTransaction(async (client) => (await client.query(
                `UPDATE withdrawals SET status = 'UNDER_REVIEW', provider_status = 'not_submitted', failure_reason = $2, updated_at = NOW()
                 WHERE id = $1 AND status = 'PROCESSING' RETURNING ${WITHDRAWAL_COLUMNS}`,
                [w.id, `${error.message}; the payout was not sent.`]
            )).rows[0]);
        }

        console.error(`WITHDRAWAL ${reference} SUBMISSION OUTCOME UNKNOWN:`, error.message);
        return runInTransaction(async (client) => (await client.query(
            `UPDATE withdrawals SET status = 'UNDER_REVIEW', provider_status = 'unknown',
                 failure_reason = 'The provider did not confirm whether it accepted this payout. Funds stay reserved until its status is checked.',
                 updated_at = NOW()
             WHERE id = $1 AND status = 'PROCESSING' RETURNING ${WITHDRAWAL_COLUMNS}`,
            [w.id]
        )).rows[0]);
    }

    return (await pool.query(
        `UPDATE withdrawals SET provider_reference = $2, provider_status = $3, submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW()
         WHERE id = $1 RETURNING ${WITHDRAWAL_COLUMNS}`,
        [w.id, outcome.providerReference, outcome.status || "processing"]
    )).rows[0];
};

// Public — reached from the emailed link, so it can't require a JWT; the
// single-use token is the credential.
const confirmWithdrawal = async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== "string") return badRequest(res, "Confirmation token is required");

    let providerName;
    try {
        // Resolve now so a misconfigured provider fails before anything changes.
        providerName = null;
        const pending = (await pool.query("SELECT type FROM withdrawals WHERE confirmation_token = $1", [token])).rows[0];
        if (pending) providerName = pending.type === "CRYPTO" ? getCustodyProvider().name : getPaymentProvider().name;
    } catch (error) {
        return res.status(error.status || 503).json({ message: error.message });
    }

    let withdrawal;
    try {
        withdrawal = await runInTransaction(async (client) => {
            const row = (await client.query(
                `SELECT * FROM withdrawals
                 WHERE confirmation_token = $1 AND status = 'PENDING_CONFIRMATION' AND confirmation_expires_at > NOW()
                 FOR UPDATE`,
                [token]
            )).rows[0];
            if (!row) return null;

            const updated = (await client.query(
                `UPDATE withdrawals SET status = 'PROCESSING', provider = $2, confirmation_token = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [row.id, providerName]
            )).rows[0];
            await client.query(
                "UPDATE transactions SET status = 'PROCESSING', updated_at = NOW() WHERE user_id = $1 AND type = 'WITHDRAWAL' AND reference = $2",
                [row.user_id, referenceFor(row.id)]
            );
            return updated;
        });
    } catch (error) {
        console.error("CONFIRM WITHDRAWAL ERROR:", error);
        return res.status(500).json({ message: "Unable to confirm withdrawal" });
    }

    if (!withdrawal) return badRequest(res, "This confirmation link is invalid, expired, or already used");

    const submitted = await submitToProvider(withdrawal);
    if (submitted?.after) submitted.after();

    createNotification(withdrawal.user_id, {
        title: "Withdrawal confirmed",
        message: `Your withdrawal of ${formatAmount(withdrawal.asset, withdrawal.amount)} has been sent for processing.`,
        type: "INFO",
        link: "/transactions"
    });

    res.json({
        message: submitted?.status === "FAILED"
            ? "Withdrawal confirmed, but the provider rejected it. The funds are back in your available balance."
            : "Withdrawal confirmed and sent for processing. You'll be notified when the payout completes.",
        withdrawalId: withdrawal.id,
        status: submitted?.status || withdrawal.status
    });
};

// Applies a verified payout/withdrawal event from the payment provider or
// custodian (inside the caller's transaction).
// `type` binds the event to its channel: the payment provider only settles
// FIAT payouts and the custodian only CRYPTO withdrawals, even when both
// adapters share a name (both demo adapters are called "demo").
// Final outcomes must match what we asked the provider to pay; the payment
// channel must state amount and currency (`requireAmount`), the custodian is
// checked whenever it reports them.
const applyPayoutEvent = async (client, providerName, { reference, providerReference, txHash, state, reason, amount, currency, asset }, { type, requireAmount = false } = {}) => {
    const id = idFromReference(reference);
    const w = id ? (await client.query("SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE", [id])).rows[0] : null;
    if (!w) return { status: 404, body: { message: "Withdrawal not found" }, outcome: "unknown_reference" };
    if (type && w.type !== type) return { status: 404, body: { message: "Withdrawal not found" }, outcome: "channel_mismatch" };
    if (w.provider && w.provider !== providerName) return { status: 400, body: { message: "Event is from a different provider" }, outcome: "provider_mismatch" };
    if (providerReference && w.provider_reference && providerReference !== w.provider_reference) {
        return { status: 400, body: { message: "Provider reference mismatch" }, outcome: "provider_reference_mismatch" };
    }

    if (!["PROCESSING", "UNDER_REVIEW"].includes(w.status)) {
        return { status: 200, body: { message: "Already processed" }, outcome: `ignored_${w.status.toLowerCase()}` };
    }

    if (providerReference && !w.provider_reference) {
        await client.query("UPDATE withdrawals SET provider_reference = $2 WHERE id = $1", [w.id, providerReference]);
    }

    if (state === "broadcast") {
        await client.query(
            "UPDATE withdrawals SET tx_hash = COALESCE($2, tx_hash), provider_status = 'broadcast', updated_at = NOW() WHERE id = $1",
            [w.id, txHash || null]
        );
        if (txHash) {
            await client.query("UPDATE transactions SET tx_hash = $3, updated_at = NOW() WHERE user_id = $1 AND type = 'WITHDRAWAL' AND reference = $2", [w.user_id, reference, txHash]);
        }
        return { status: 200, body: { message: "Broadcast recorded" }, outcome: "broadcast" };
    }

    if (state === "completed" || state === "failed") {
        const reportedAsset = currency ?? asset;
        let reportedUnits = null;
        try {
            reportedUnits = amount === undefined || amount === null ? null : toUnits(amount);
        } catch {
            reportedUnits = "invalid";
        }
        const missing = requireAmount && (reportedUnits === null || reportedAsset === undefined);
        const wrongAmount = reportedUnits !== null && reportedUnits !== toUnits(w.receive_amount);
        const wrongAsset = reportedAsset !== undefined && String(reportedAsset).toUpperCase() !== w.asset;
        if (missing || wrongAmount || wrongAsset) {
            // Funds stay reserved: neither paid out nor handed back until an
            // administrator establishes what really happened.
            await client.query(
                `UPDATE withdrawals SET status = 'UNDER_REVIEW', provider_status = $2, failure_reason = $3, updated_at = NOW() WHERE id = $1`,
                [w.id, state, `Provider reported ${state} for ${amount ?? "no amount"} ${reportedAsset ?? ""}`.trim() + ` on a ${w.receive_amount} ${w.asset} payout`]
            );
            return { status: 200, body: { message: "Payout details do not match; held for review" }, outcome: "amount_mismatch" };
        }
    }

    if (state === "completed") {
        const done = await settleWithdrawal(client, w, txHash || null);
        return { status: 200, body: { message: "Withdrawal completed" }, outcome: "settled", after: await completedSideEffects(client, done) };
    }

    if (state === "failed") {
        await releaseReservation(client, w, "FAILED", typeof reason === "string" ? reason.slice(0, 200) : "The provider reported the payout failed");
        return { status: 200, body: { message: "Withdrawal failed; funds released" }, outcome: "released", after: failedSideEffect(w) };
    }

    return { status: 400, body: { message: "Unknown payout state" }, outcome: "invalid" };
};

// Asks the provider what happened to a PROCESSING / UNDER_REVIEW payout and
// applies the answer. Only a definite answer moves money. Used by the
// administrator "Re-check with provider" action and reconciliation.
const recheckWithdrawal = async (withdrawalId) => {
    const w = (await pool.query("SELECT * FROM withdrawals WHERE id = $1", [withdrawalId])).rows[0];
    if (!w) return { status: 404, message: "Withdrawal not found" };
    if (!["PROCESSING", "UNDER_REVIEW"].includes(w.status)) return { status: 409, message: `Withdrawal is ${w.status}; nothing to re-check` };

    const reference = referenceFor(w.id);
    let providerStatus;
    let txHash = null;

    try {
        if (w.type === "CRYPTO") {
            const answer = await withTimeout(getCustodyProvider().getWithdrawalStatus(reference));
            providerStatus = answer.status;
            txHash = answer.txHash || null;
        } else {
            providerStatus = await withTimeout(getPaymentProvider().getPayoutStatus(reference));
        }
    } catch (error) {
        return { status: 502, message: `The provider could not be reached: ${error.message}` };
    }

    if (providerStatus === "not_found") {
        // The provider never received it, so it can't have paid: safe to
        // submit again (same reference = provider-side idempotency key).
        await pool.query("UPDATE withdrawals SET status = 'PROCESSING', provider_status = 'resubmitting', updated_at = NOW() WHERE id = $1", [w.id]);
        const resubmitted = await submitToProvider({ ...w, status: "PROCESSING" });
        if (resubmitted?.after) resubmitted.after();
        return { status: 200, message: "The provider had no record of this payout; it was resubmitted.", providerStatus, withdrawal: resubmitted };
    }

    if (!["completed", "failed"].includes(providerStatus)) {
        await pool.query("UPDATE withdrawals SET provider_status = $2, updated_at = NOW() WHERE id = $1", [w.id, providerStatus || "unknown"]);
        return { status: 200, message: `The provider reports "${providerStatus}"; no change made.`, providerStatus };
    }

    let after;
    const updated = await runInTransaction(async (client) => {
        const row = (await client.query("SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE", [w.id])).rows[0];
        if (!["PROCESSING", "UNDER_REVIEW"].includes(row.status)) return row;
        if (providerStatus === "completed") {
            const done = await settleWithdrawal(client, row, txHash);
            after = await completedSideEffects(client, done);
            return done;
        }
        after = failedSideEffect(row);
        return releaseReservation(client, row, "FAILED", "The provider confirmed the payout failed");
    });
    if (after) after();

    return { status: 200, message: `The provider reports "${providerStatus}"; the withdrawal was updated.`, providerStatus, withdrawal: updated };
};

// Closes a withdrawal that was never submitted (customer cancel, expiry,
// administrator rejection) and releases its funds.
const closeBeforeSubmission = async (client, withdrawalId, userId, status, reason = null) => {
    const row = (await client.query(
        `SELECT * FROM withdrawals WHERE id = $1 ${userId ? "AND user_id = $2" : ""} AND status = 'PENDING_CONFIRMATION' FOR UPDATE`,
        userId ? [withdrawalId, userId] : [withdrawalId]
    )).rows[0];
    if (!row) return null;
    return releaseReservation(client, row, status, reason);
};

const cancelWithdrawal = async (req, res) => {
    try {
        const closed = await runInTransaction((client) => closeBeforeSubmission(client, req.params.id, req.user.id, "CANCELLED"));
        if (!closed) return res.status(404).json({ message: "No pending withdrawal found to cancel" });
        res.json({ message: "Withdrawal cancelled. The funds are back in your available balance.", withdrawal: present(closed) });
    } catch (error) {
        console.error("CANCEL WITHDRAWAL ERROR:", error);
        res.status(500).json({ message: "Unable to cancel withdrawal" });
    }
};

// No scheduler: an unconfirmed withdrawal is expired (and its funds
// released) the first time it's read after its link has lapsed.
const expireIfNeeded = async (withdrawal) => {
    if (withdrawal.status !== "PENDING_CONFIRMATION" || !withdrawal.confirmation_expires_at) return withdrawal;
    if (new Date(withdrawal.confirmation_expires_at) > new Date()) return withdrawal;

    try {
        const closed = await runInTransaction(async (client) => {
            const row = (await client.query(
                "SELECT * FROM withdrawals WHERE id = $1 AND status = 'PENDING_CONFIRMATION' AND confirmation_expires_at <= NOW() FOR UPDATE",
                [withdrawal.id]
            )).rows[0];
            return row ? releaseReservation(client, row, "EXPIRED", "The confirmation link expired") : null;
        });
        return closed || withdrawal;
    } catch (error) {
        console.error("EXPIRE WITHDRAWAL ERROR:", error);
        return withdrawal;
    }
};

const getWithdrawals = async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    try {
        const result = await pool.query(
            `SELECT ${WITHDRAWAL_COLUMNS} FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [req.user.id, limit]
        );
        const withdrawals = await Promise.all(result.rows.map(expireIfNeeded));
        res.json({ withdrawals: withdrawals.map(present) });
    } catch (error) {
        console.error("GET WITHDRAWALS ERROR:", error);
        res.status(500).json({ message: "Unable to load withdrawals" });
    }
};

const getWithdrawalById = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${WITHDRAWAL_COLUMNS} FROM withdrawals WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Withdrawal not found" });
        res.json({ withdrawal: present(await expireIfNeeded(result.rows[0])) });
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
    getWithdrawalById,
    applyPayoutEvent,
    recheckWithdrawal,
    closeBeforeSubmission,
    runInTransaction,
    present,
    referenceFor,
    WITHDRAWAL_COLUMNS
};
