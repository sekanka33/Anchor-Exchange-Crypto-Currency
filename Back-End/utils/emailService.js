const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || "Anchor Exchange <no-reply@anchorexchange.com>";

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
    : null;

// DEMO MODE: no SMTP configured. Emails are logged instead of sent so the
// verification/reset flows remain fully testable without real credentials.
// This must never be mistaken for production email delivery.
const sendEmail = async ({ to, subject, html }) => {

    if (!isConfigured) {
        console.log("\n===== [DEMO MODE] EMAIL NOT SENT — SMTP NOT CONFIGURED =====");
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log("(set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to send real emails)");
        console.log("==============================================================\n");
        return { demo: true };
    }

    return transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        html
    });
};

module.exports = { sendEmail, isEmailConfigured: isConfigured };
