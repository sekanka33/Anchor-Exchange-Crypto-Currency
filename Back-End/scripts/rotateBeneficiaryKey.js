// Re-encrypts every saved bank account number under the current
// BENEFICIARY_ENCRYPTION_KEY and recomputes its fingerprint.
//
//   node scripts/rotateBeneficiaryKey.js            dry run: reports what would change
//   node scripts/rotateBeneficiaryKey.js --apply    re-encrypts, in one transaction
//
// Safe rotation:
//   1. Set BENEFICIARY_ENCRYPTION_KEY_PREVIOUS to the old key and
//      BENEFICIARY_ENCRYPTION_KEY to the new one (openssl rand -hex 32), restart.
//      The app now writes with the new key and can still read old rows.
//   2. Run this script without --apply, then with --apply. Every row is
//      decrypted (current key first, then previous), re-encrypted with the
//      current key, and verified by decrypting it again before COMMIT. Any
//      failure rolls the whole run back; nothing is half-migrated.
//   3. Only after it reports every row on the current key, remove
//      BENEFICIARY_ENCRYPTION_KEY_PREVIOUS and restart. Keep the old key in
//      your secret manager until then.
//
// Also upgrades fingerprints from the original scheme (HMAC keyed with the
// raw encryption key) to the HKDF-derived key. Never prints account numbers
// or keys: only row ids and counts.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const pool = require("../config/database");
const { beneficiaryKeys } = require("../config/secrets");
const { encryptWith, decryptWith, fingerprintWith } = require("../services/beneficiaries");

const main = async () => {
    const apply = process.argv.includes("--apply");
    const { current, previous } = beneficiaryKeys();
    const client = await pool.connect();
    const counts = { total: 0, onCurrentKey: 0, onPreviousKey: 0, fingerprintUpgraded: 0, unreadable: [] };

    try {
        await client.query("BEGIN");
        const rows = (await client.query(
            "SELECT id, account_number_encrypted, account_fingerprint FROM bank_beneficiaries ORDER BY id FOR UPDATE"
        )).rows;

        for (const row of rows) {
            counts.total += 1;
            let plaintext;
            let usedPrevious = false;
            try {
                plaintext = decryptWith(current, row.account_number_encrypted);
            } catch {
                if (!previous) { counts.unreadable.push(row.id); continue; }
                try {
                    plaintext = decryptWith(previous, row.account_number_encrypted);
                    usedPrevious = true;
                } catch {
                    counts.unreadable.push(row.id);
                    continue;
                }
            }

            const fp = fingerprintWith(current, plaintext);
            if (!usedPrevious && row.account_fingerprint === fp) {
                counts.onCurrentKey += 1;
                continue;
            }
            if (usedPrevious) counts.onPreviousKey += 1;
            else counts.fingerprintUpgraded += 1;

            const encrypted = usedPrevious ? encryptWith(current, plaintext) : row.account_number_encrypted;
            if (decryptWith(current, encrypted) !== plaintext) throw new Error(`Verification failed for beneficiary ${row.id}`);

            await client.query(
                "UPDATE bank_beneficiaries SET account_number_encrypted = $2, account_fingerprint = $3 WHERE id = $1",
                [row.id, encrypted, fp]
            );
        }

        if (counts.unreadable.length > 0) {
            // Don't commit a partial migration: the operator must fix the keys first.
            await client.query("ROLLBACK");
            console.error(`Rolled back: ${counts.unreadable.length} row(s) could not be decrypted with the current or previous key (ids: ${counts.unreadable.join(", ")}).`);
            process.exitCode = 1;
            return;
        }

        if (apply) {
            await client.query("COMMIT");
        } else {
            await client.query("ROLLBACK");
        }

        console.log(`${apply ? "Applied" : "Dry run"}: ${counts.total} beneficiaries; ${counts.onCurrentKey} already current; ` +
            `${counts.onPreviousKey} re-encrypted from the previous key; ${counts.fingerprintUpgraded} fingerprint(s) upgraded.`);
        if (!apply && counts.onPreviousKey + counts.fingerprintUpgraded > 0) console.log("Re-run with --apply to write these changes.");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`Rotation failed and was rolled back: ${error.message}`);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
};

main();
