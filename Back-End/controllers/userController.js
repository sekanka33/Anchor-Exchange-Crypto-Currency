const pool = require("../config/database");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../utils/emailService");
const { passwordChangedEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

const DEFAULT_PREFERENCES = { theme: "dark", currency: "USD", language: "en", emailNotifications: true };
const VALID_THEMES = ["dark", "light"];
const VALID_CURRENCIES = ["USD", "EUR", "ZAR", "GBP"];
const VALID_LANGUAGES = ["en", "fr", "pt"];

const getProfile = async(req,res)=>{

    try{

        const userId = req.user.id;


        const result = await pool.query(
            "SELECT id,email,fullname,surname,country,phonenumber,is_verified,role,kyc_status,preferences,created_at FROM users WHERE id=$1",
            [userId]
        );


        res.json({
            user: result.rows[0]
        });


    }catch(error){

        console.error("GET PROFILE ERROR:", error);

        res.status(500).json({
            message:"Server error"
        });

    }

};


const updateProfile = async (req, res) => {

    const userId = req.user.id;
    const { fullName, surname, country, phoneNumber } = req.body;

    if(!fullName || !surname || !country || !phoneNumber){
        return res.status(400).json({ message: "Full name, surname, country and phone number are required" });
    }

    // Matches the DB column widths (varchar(100)/(100)/(100)/(50)) so a bad
    // request fails with a clear 400 instead of a raw Postgres error.
    if (fullName.length > 100 || surname.length > 100 || country.length > 100 || phoneNumber.length > 50) {
        return res.status(400).json({ message: "One or more fields exceed the maximum allowed length" });
    }

    try {

        const result = await pool.query(
            `
            UPDATE users
            SET fullname = $1, surname = $2, country = $3, phonenumber = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING id, email, fullname, surname, country, phonenumber, is_verified, role, kyc_status, preferences
            `,
            [fullName, surname, country, phoneNumber, userId]
        );

        res.json({
            message: "Profile updated successfully",
            user: result.rows[0]
        });

    } catch(error){

        console.error("UPDATE PROFILE ERROR:", error);

        res.status(500).json({ message: "Unable to update profile" });

    }

};


const updatePreferences = async (req, res) => {

    const userId = req.user.id;
    const { theme, currency, language, emailNotifications } = req.body;

    if (theme !== undefined && !VALID_THEMES.includes(theme)) {
        return res.status(400).json({ message: `Theme must be one of: ${VALID_THEMES.join(", ")}` });
    }

    if (currency !== undefined && !VALID_CURRENCIES.includes(currency)) {
        return res.status(400).json({ message: `Currency must be one of: ${VALID_CURRENCIES.join(", ")}` });
    }

    if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
        return res.status(400).json({ message: `Language must be one of: ${VALID_LANGUAGES.join(", ")}` });
    }

    if (emailNotifications !== undefined && typeof emailNotifications !== "boolean") {
        return res.status(400).json({ message: "emailNotifications must be true or false" });
    }

    try {

        const current = await pool.query(
            "SELECT preferences FROM users WHERE id = $1",
            [userId]
        );

        if(current.rows.length === 0){
            return res.status(404).json({ message: "User not found" });
        }

        const merged = {
            ...DEFAULT_PREFERENCES,
            ...current.rows[0].preferences,
            ...(theme !== undefined && { theme }),
            ...(currency !== undefined && { currency }),
            ...(language !== undefined && { language }),
            ...(emailNotifications !== undefined && { emailNotifications })
        };

        const result = await pool.query(
            `
            UPDATE users
            SET preferences = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING preferences
            `,
            [JSON.stringify(merged), userId]
        );

        res.json({
            message: "Preferences updated successfully",
            preferences: result.rows[0].preferences
        });

    } catch(error){

        console.error("UPDATE PREFERENCES ERROR:", error);

        res.status(500).json({ message: "Unable to update preferences" });

    }

};


const changePassword = async (req, res) => {

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if(!currentPassword || !newPassword){
        return res.status(400).json({ message: "Current and new password are required" });
    }

    if(newPassword.length < 8){
        return res.status(400).json({ message: "New password must be at least 8 characters" });
    }

    try {

        const result = await pool.query(
            "SELECT id, email, fullname, password FROM users WHERE id = $1",
            [userId]
        );

        if(result.rows.length === 0){
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if(!passwordMatch){
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [hashedPassword, userId]
        );

        const email_ = passwordChangedEmail({ fullName: user.fullname });

        sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND PASSWORD CHANGED EMAIL FAILED:", err));

        createNotification(userId, {
            title: "Password changed",
            message: "Your password was changed successfully. If this wasn't you, contact support immediately.",
            type: "SECURITY",
            link: "/profile-setting"
        });

        res.json({ message: "Password changed successfully" });

    } catch(error){

        console.error("CHANGE PASSWORD ERROR:", error);

        res.status(500).json({ message: "Unable to change password" });

    }

};


// Per-user dashboard metrics. Totals are aggregated in SQL so they're exact
// regardless of how many rows exist; USD sums cover fiat deposits/withdrawals
// and completed orders (all orders settle against USD).
const ACTIVITY_DAYS = 30;

const getStats = async (req, res) => {

    const userId = req.user.id;

    try {

        const [orders, deposits, withdrawals, transactions, daily] = await Promise.all([
            pool.query(
                `
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
                    COUNT(*) FILTER (WHERE side = 'BUY')::int AS buy,
                    COUNT(*) FILTER (WHERE side = 'SELL')::int AS sell,
                    COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0) AS volume_usd,
                    COALESCE(SUM(fee) FILTER (WHERE status = 'COMPLETED'), 0) AS fees_usd
                FROM orders
                WHERE user_id = $1
                `,
                [userId]
            ),
            pool.query(
                `
                SELECT
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
                    COALESCE(SUM(net_amount) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED'), 0) AS fiat_total_usd
                FROM deposits
                WHERE user_id = $1
                `,
                [userId]
            ),
            pool.query(
                `
                SELECT
                    COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                    COUNT(*) FILTER (WHERE status = 'PENDING_CONFIRMATION')::int AS pending,
                    COALESCE(SUM(amount) FILTER (WHERE type = 'FIAT' AND status = 'COMPLETED'), 0) AS fiat_total_usd
                FROM withdrawals
                WHERE user_id = $1
                `,
                [userId]
            ),
            pool.query(
                "SELECT COUNT(*)::int AS total FROM transactions WHERE user_id = $1",
                [userId]
            ),
            pool.query(
                `
                SELECT
                    to_char(d.day, 'YYYY-MM-DD') AS day,
                    COALESCE((
                        SELECT SUM(o.total) FROM orders o
                        WHERE o.user_id = $1 AND o.status = 'COMPLETED' AND o.created_at::date = d.day
                    ), 0) AS volume_usd,
                    COALESCE((
                        SELECT SUM(dp.net_amount) FROM deposits dp
                        WHERE dp.user_id = $1 AND dp.type = 'FIAT' AND dp.status = 'COMPLETED' AND dp.created_at::date = d.day
                    ), 0) AS deposits_usd,
                    COALESCE((
                        SELECT SUM(w.amount) FROM withdrawals w
                        WHERE w.user_id = $1 AND w.type = 'FIAT' AND w.status = 'COMPLETED' AND w.created_at::date = d.day
                    ), 0) AS withdrawals_usd
                FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day') AS d(day)
                ORDER BY d.day
                `,
                [userId, ACTIVITY_DAYS]
            )
        ]);

        const o = orders.rows[0];
        const d = deposits.rows[0];
        const w = withdrawals.rows[0];

        res.json({
            orders: {
                total: o.total,
                completed: o.completed,
                open: o.open,
                buy: o.buy,
                sell: o.sell,
                volumeUsd: Number(o.volume_usd),
                feesUsd: Number(o.fees_usd)
            },
            deposits: {
                completed: d.completed,
                pending: d.pending,
                fiatTotalUsd: Number(d.fiat_total_usd)
            },
            withdrawals: {
                completed: w.completed,
                pending: w.pending,
                fiatTotalUsd: Number(w.fiat_total_usd)
            },
            transactions: {
                total: transactions.rows[0].total
            },
            daily: daily.rows.map((row) => ({
                day: row.day,
                volumeUsd: Number(row.volume_usd),
                depositsUsd: Number(row.deposits_usd),
                withdrawalsUsd: Number(row.withdrawals_usd)
            }))
        });

    } catch (error) {

        console.error("GET USER STATS ERROR:", error);

        res.status(500).json({ message: "Unable to load account statistics" });

    }

};

module.exports = {
    getStats,
    getProfile,
    updateProfile,
    updatePreferences,
    changePassword
};