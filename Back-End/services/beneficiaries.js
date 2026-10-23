const crypto = require("crypto");
const { getFiatCurrency } = require("../config/fiatCurrencies");
const { beneficiaryKeys } = require("../config/secrets");

// Bank beneficiaries. Account numbers are encrypted at rest with AES-256-GCM
// (BENEFICIARY_ENCRYPTION_KEY) and only decrypted at the moment a payout is
// sent to the provider. API responses, emails and logs only ever see the
// last four digits.

// Ciphertext format (unchanged): "v1:<iv b64>:<tag b64>:<ciphertext b64>",
// 12-byte random IV, 16-byte GCM tag. Keys come from config/secrets.js
// (fails closed in production). BENEFICIARY_ENCRYPTION_KEY_PREVIOUS, when
// set, is used only to READ rows written before a key rotation; new rows are
// always written with the current key. See scripts/rotateBeneficiaryKey.js.
const IV_BYTES = 12;
const TAG_BYTES = 16;

const decryptionFailed = () => Object.assign(new Error("Beneficiary details could not be decrypted"), { code: "BENEFICIARY_DECRYPT_FAILED" });

const encryptWith = (key, plaintext) => {
    if (typeof plaintext !== "string" || plaintext.length === 0) throw new Error("Nothing to encrypt");
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
};

const encrypt = (plaintext) => encryptWith(beneficiaryKeys().current, plaintext);

const decryptWith = (key, payload) => {
    const parts = String(payload).split(":");
    if (parts.length !== 4 || parts[0] !== "v1") throw decryptionFailed();
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    // Pinning the tag length matters: GCM would otherwise accept a truncated
    // (e.g. 4-byte) tag, which is far easier to forge.
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw decryptionFailed();
    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]).toString("utf8");
    } catch {
        // Wrong key or tampered data: the reason (and the data) stay out of errors and logs.
        throw decryptionFailed();
    }
};

const decrypt = (payload) => {
    const { current, previous } = beneficiaryKeys();
    try {
        return decryptWith(current, payload);
    } catch (error) {
        if (!previous) throw error;
        return decryptWith(previous, payload);
    }
};

// Keyed hash: lets us spot "this account is already saved" without
// decrypting every row, and without an unkeyed hash that could be brute-forced.
// The HMAC key is derived from the encryption key with HKDF, so the same key
// material is never used directly for two purposes.
const fingerprintKey = (key) => Buffer.from(crypto.hkdfSync("sha256", key, Buffer.alloc(0), "anchor-exchange/beneficiary-fingerprint/v1", 32));
const fingerprintWith = (key, accountNumber) =>
    crypto.createHmac("sha256", fingerprintKey(key)).update(`account:${accountNumber}`).digest("hex");
const fingerprint = (accountNumber) => fingerprintWith(beneficiaryKeys().current, accountNumber);

// Fingerprints an existing row may carry: the current scheme, the original
// scheme (HMAC keyed with the raw encryption key), and both under the previous
// key during a rotation. Matching rows are upgraded to the current fingerprint.
const legacyFingerprintWith = (key, accountNumber) =>
    crypto.createHmac("sha256", key).update(`account:${accountNumber}`).digest("hex");
const candidateFingerprints = (accountNumber) => {
    const { current, previous } = beneficiaryKeys();
    return [current, previous].filter(Boolean)
        .flatMap((key) => [fingerprintWith(key, accountNumber), legacyFingerprintWith(key, accountNumber)]);
};

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
    const findActive = () => db.query(
        "SELECT * FROM bank_beneficiaries WHERE user_id = $1 AND currency = $2 AND account_fingerprint = ANY($3) AND archived_at IS NULL",
        [userId, valid.currency, candidateFingerprints(valid.accountNumber)]
    );

    const existing = await findActive();
    if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (row.account_fingerprint === fp) return row;
        // Written under an older fingerprint scheme or key: upgrade it in place.
        const upgraded = await db.query(
            "UPDATE bank_beneficiaries SET account_fingerprint = $2 WHERE id = $1 RETURNING *",
            [row.id, fp]
        );
        return upgraded.rows[0] || row;
    }

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
    return (await findActive()).rows[0];
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
    decrypt,
    encryptWith,
    decryptWith,
    fingerprint,
    fingerprintWith,
    candidateFingerprints
};
