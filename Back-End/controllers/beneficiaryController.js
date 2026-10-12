const pool = require("../config/database");
const beneficiaries = require("../services/beneficiaries");

// A customer's saved bank accounts for fiat payouts. Responses only ever
// carry the masked account number.

const listBeneficiaries = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM bank_beneficiaries WHERE user_id = $1 AND archived_at IS NULL ORDER BY created_at DESC",
            [req.user.id]
        );
        res.json({ beneficiaries: result.rows.map(beneficiaries.mask) });
    } catch (error) {
        console.error("LIST BENEFICIARIES ERROR:", error);
        res.status(500).json({ message: "Unable to load bank accounts" });
    }
};

const addBeneficiary = async (req, res) => {
    try {
        const saved = await beneficiaries.saveBeneficiary(pool, req.user.id, req.body);
        res.status(201).json({ beneficiary: beneficiaries.mask(saved) });
    } catch (error) {
        if (!error.status) console.error("ADD BENEFICIARY ERROR:", error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to save bank account" });
    }
};

// Archived, not deleted: past withdrawals still reference it.
const archiveBeneficiary = async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE bank_beneficiaries SET archived_at = NOW() WHERE id = $1 AND user_id = $2 AND archived_at IS NULL RETURNING id",
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: "Bank account not found" });
        res.json({ message: "Bank account removed" });
    } catch (error) {
        console.error("ARCHIVE BENEFICIARY ERROR:", error);
        res.status(500).json({ message: "Unable to remove bank account" });
    }
};

module.exports = { listBeneficiaries, addBeneficiary, archiveBeneficiary };
