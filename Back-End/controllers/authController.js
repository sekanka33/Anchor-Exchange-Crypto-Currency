const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailService");
const { welcomeEmail, passwordResetEmail, passwordChangedEmail } = require("../emails/templates");
const { createNotification } = require("../utils/notify");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res) => {

    const { email, password, fullName, surname, country, phoneNumber, username } = req.body;

    if(!email || !EMAIL_PATTERN.test(email)){
        return res.status(400).json({ message: "A valid email is required" });
    }

    if(!password || password.length < 8){
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    if(!fullName || !surname || !country || !phoneNumber){
        return res.status(400).json({ message: "Full name, surname, country and phone number are required" });
    }

    const client = await pool.connect();

    try {

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

        await client.query("BEGIN");

        const result = await client.query(
            `
            INSERT INTO users(username, email, password, fullname, surname, country, phonenumber, verification_token, verification_token_expires_at)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, username, email, fullname, surname, country, phonenumber, created_at
            `,
            [
                username || null,
                email,
                hashedPassword,
                fullName,
                surname,
                country,
                phoneNumber,
                verificationToken,
                verificationExpiresAt
            ]
        );

        const user = result.rows[0];

        const wallet = await client.query(
            `
            INSERT INTO wallets(user_id)
            VALUES($1)
            RETURNING id
            `,
            [
                user.id
            ]
        );

        await client.query(
            `
            INSERT INTO wallet_balances(wallet_id, asset_symbol, available_balance)
            VALUES($1, 'USD', 0)
            `,
            [
                wallet.rows[0].id
            ]
        );

        await client.query("COMMIT");

        const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const email_ = welcomeEmail({ fullName, verifyUrl });

        sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND VERIFICATION EMAIL FAILED:", err));

        createNotification(user.id, {
            title: "Welcome to Anchor Exchange",
            message: "Your account has been created. Verify your email to unlock all features.",
            type: "INFO",
            link: "/profile-setting"
        });

        res.status(201).json({
            message: "User created. Please check your email to verify your account.",
            user
        });


    } catch(error){

        await client.query("ROLLBACK");

        console.error("REGISTER ERROR:", error);

        if(error.code === "23505"){
            return res.status(409).json({
                message: "An account with that email already exists"
            });
        }

        res.status(500).json({
            message: "Unable to complete registration"
        });

    } finally {

        client.release();

    }
};



const login = async (req,res)=>{

    const {email,password} = req.body;

    if(!email || !password){
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {

        const result = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
        );


        if(result.rows.length === 0){
            return res.status(401).json({
                message:"Invalid email or password"
            });
        }


        const user = result.rows[0];


        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );


        if(!passwordMatch){
            return res.status(401).json({
                message:"Invalid email or password"
            });
        }


        if(user.is_suspended){
            return res.status(403).json({
                message:"This account has been suspended. Contact support for assistance."
            });
        }


        const token = jwt.sign(
            {
                id:user.id,
                email:user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn:"1h"
            }
        );


        res.json({
            message:"Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                fullname: user.fullname,
                isVerified: user.is_verified,
                role: user.role
            }
        });


    } catch(error){

        console.error("LOGIN ERROR:", error);

        res.status(500).json({
            message:"Unable to complete login"
        });

    }

};


const verifyEmail = async (req, res) => {

    const { token } = req.query;

    if(!token){
        return res.status(400).json({ message: "Verification token is required" });
    }

    try {

        const result = await pool.query(
            `
            SELECT id FROM users
            WHERE verification_token = $1
            AND verification_token_expires_at > NOW()
            `,
            [token]
        );

        if(result.rows.length === 0){
            return res.status(400).json({ message: "This verification link is invalid or has expired" });
        }

        await pool.query(
            `
            UPDATE users
            SET is_verified = true, verification_token = NULL, verification_token_expires_at = NULL
            WHERE id = $1
            `,
            [result.rows[0].id]
        );

        res.json({ message: "Email verified successfully" });

    } catch(error){

        console.error("VERIFY EMAIL ERROR:", error);

        res.status(500).json({ message: "Unable to verify email" });

    }

};


const forgotPassword = async (req, res) => {

    const { email } = req.body;

    if(!email || !EMAIL_PATTERN.test(email)){
        return res.status(400).json({ message: "A valid email is required" });
    }

    const genericResponse = {
        message: "If an account exists for that email, a password reset link has been sent."
    };

    try {

        const result = await pool.query(
            "SELECT id, fullname, email FROM users WHERE email = $1",
            [email]
        );

        if(result.rows.length === 0){
            // Do not reveal whether the email exists.
            return res.json(genericResponse);
        }

        const user = result.rows[0];

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await pool.query(
            `
            UPDATE users
            SET reset_token = $1, reset_token_expires_at = $2
            WHERE id = $3
            `,
            [resetToken, resetExpiresAt, user.id]
        );

        const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
        const email_ = passwordResetEmail({ fullName: user.fullname, resetUrl });

        sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND RESET EMAIL FAILED:", err));

        res.json(genericResponse);

    } catch(error){

        console.error("FORGOT PASSWORD ERROR:", error);

        res.status(500).json({ message: "Unable to process request" });

    }

};


const resetPassword = async (req, res) => {

    const { token, password } = req.body;

    if(!token){
        return res.status(400).json({ message: "Reset token is required" });
    }

    if(!password || password.length < 8){
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    try {

        const result = await pool.query(
            `
            SELECT id, fullname, email FROM users
            WHERE reset_token = $1
            AND reset_token_expires_at > NOW()
            `,
            [token]
        );

        if(result.rows.length === 0){
            return res.status(400).json({ message: "This reset link is invalid or has expired" });
        }

        const user = result.rows[0];

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            `
            UPDATE users
            SET password = $1, reset_token = NULL, reset_token_expires_at = NULL
            WHERE id = $2
            `,
            [hashedPassword, user.id]
        );

        const email_ = passwordChangedEmail({ fullName: user.fullname });

        sendEmail({ to: user.email, subject: email_.subject, html: email_.html })
            .catch((err) => console.error("SEND PASSWORD CHANGED EMAIL FAILED:", err));

        createNotification(user.id, {
            title: "Password changed",
            message: "Your password was reset successfully. If this wasn't you, contact support immediately.",
            type: "SECURITY",
            link: "/profile-setting"
        });

        res.json({ message: "Password has been reset successfully" });

    } catch(error){

        console.error("RESET PASSWORD ERROR:", error);

        res.status(500).json({ message: "Unable to reset password" });

    }

};


// VERY IMPORTANT
module.exports = {
    register,
    login,
    verifyEmail,
    forgotPassword,
    resetPassword
};