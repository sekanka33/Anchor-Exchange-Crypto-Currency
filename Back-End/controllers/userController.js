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


module.exports = {
    getProfile,
    updateProfile,
    updatePreferences,
    changePassword
};