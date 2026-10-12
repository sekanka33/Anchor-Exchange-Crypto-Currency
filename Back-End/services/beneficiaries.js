const crypto = require("crypto");
const { getFiatCurrency } = require("../config/fiatCurrencies");

// Bank beneficiaries. Account numbers are encrypted at rest with AES-256-GCM
// (BENEFICIARY_ENCRYPTION_KEY) and only decrypted at the moment a payout is
// sent to the provider. API responses, emails and logs only ever see the
// last four digits.

const DEV_KEY_SEED = "demo-beneficiary-key-do-not-use-in-production";

const encryptionKey = () => {
    const configured = process.env.BENEFICIARY_ENCRYPTION_KEY;
    if (configured) {
        const key = Buffer.from(configured, /^[0-9a-f]{64}$/i.test(configured) ? "hex" : "base64");
        if (key.length !== 32) throw new Error("BENEFICIARY_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
        return key;
    }
    return crypto.createHash("sha256").update(DEV_KEY_SEED).digest();
};

const encrypt = (plaintext) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
};

const decrypt = (payload) => {
    const [version, iv, tag, body] = String(payload).split(":");
    if (version !== "v1") throw new Error("Unsupported beneficiary encryption version");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
};

// Keyed hash: lets us spot "this account is already saved" without
// decrypting every row, and without an unkeyed hash that could be brute-forced.
const fingerprint = (accountNumber) =>
    crypto.createHmac("sha256", encryptionKey()).update(`account:${accountNumber}`).digest("hex");

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const clean = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "");

// Validates and normalises customer-entered bank details for a currency.
const validateBankDetails = (currencyCode, details) => {
    const currency = getFiatCurrency(currencyCode);
    if (!currency) throw badRequest("Unsupported currency");

    const accountHolder = clean(details?.accountHolderName ?? details?.accountHolder, 100);
    const bankName = clean(details?.bankName, 100);
    const accountNumber = String(details?.accountNumber ?? "").replace(/[\s-]/g, "");
    const branchCode = String(details?.branchCode ?? "").replace(/\s/g, "");
    const accountType = clean(details?.accountType, 20).toLowerCase();
    const label = clean(details?.label, 60) || null;

    if (!accountHolder || !bankName || !accountNumber) {
        throw badRequest("Account holder name, account number and bank name are required");
    }
    if (!/^\d{6,17}$/.test(accountNumber)) throw badRequest("Account number must be 6 to 17 digits");
    if (currency.bank.requiresBranchCode && !branchCode) throw badRequest("Branch code is required");
    if (branchCode && !currency.bank.branchCodePattern.test(branchCode)) throw badRequest("Branch code is not valid");
    if (accountType && !currency.bank.accountTypes.includes(accountType)) {
        throw badRequest(`Account type must be one of: ${currency.bank.accountTypes.join(", ")}`);
    }

    return { currency: currency.code, accountHolder, bankName, accountNumber, branchCode: branchCode || null, accountType: accountType || null, label };
};

const mask = (row) => ({
    id: row.id,
    currency: row.currency,
    label: row.label,
    accountHolder: row.account_holder,
    bankName: row.bank_name,
    branchCode: row.branch_code,
    accountType: row.account_type,
    accountNumberMasked: `•••• ${row.account_number_last4}`,
    createdAt: row.created_at
});

// Saves (or reuses the existing active copy of) a beneficiary.
const saveBeneficiary = async (db, userId, details) => {
    const valid = validateBankDetails(details?.currency, details);
    const fp = fingerprint(valid.accountNumber);

    const existing = await db.query(
        "SELECT * FROM bank_beneficiaries WHERE user_id = $1 AND currency = $2 AND account_fingerprint = $3 AND archived_at IS NULL",
        [userId, valid.currency, fp]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const inserted = await db.query(
        `INSERT INTO bank_beneficiaries
            (user_id, currency, label, account_holder, bank_name, branch_code, account_type,
             account_number_encrypted, account_number_last4, account_fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, currency, account_fingerprint) WHERE archived_at IS NULL DO NOTHING
         RETURNING *`,
        [userId, valid.currency, valid.label, valid.accountHolder, valid.bankName, valid.branchCode, valid.accountType,
            encrypt(valid.accountNumber), valid.accountNumber.slice(-4), fp]
    );

    if (inserted.rows.length > 0) return inserted.rows[0];

    // Lost a race with an identical concurrent save: use the winner's row.
    return (await db.query(
        "SELECT * FROM bank_beneficiaries WHERE user_id = $1 AND currency = $2 AND account_fingerprint = $3 AND archived_at IS NULL",
        [userId, valid.currency, fp]
    )).rows[0];
};

const getBeneficiary = async (db, userId, id) => {
    const result = await db.query(
        "SELECT * FROM bank_beneficiaries WHERE id = $1 AND user_id = $2 AND archived_at IS NULL",
        [id, userId]
    );
    return result.rows[0] || null;
};

// Destination details safe to store on a withdrawal and show to the customer
// or an administrator: never the full account number.
const destinationSnapshot = (row) => ({
    beneficiaryId: row.id,
    accountHolderName: row.account_holder,
    bankName: row.bank_name,
    branchCode: row.branch_code,
    accountType: row.account_type,
    accountNumberMasked: `•••• ${row.account_number_last4}`
});

// Full details for the payout call only.
const payoutDetails = (row) => ({
    accountHolderName: row.account_holder,
    bankName: row.bank_name,
    branchCode: row.branch_code,
    accountType: row.account_type,
    accountNumber: decrypt(row.account_number_encrypted)
});

module.exports = {
    validateBankDetails,
    saveBeneficiary,
    getBeneficiary,
    mask,
    destinationSnapshot,
    payoutDetails,
    encrypt,
    decrypt
};
