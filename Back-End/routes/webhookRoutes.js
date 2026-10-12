const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { handlePaymentWebhook, handleCustodyWebhook } = require("../controllers/webhookController");

// Public endpoints — not protected by JWT (providers can't log in as a
// user). Authenticity is the HMAC signature over the raw body; see
// controllers/webhookController.js.
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 600,
    skip: () => process.env.NODE_ENV === "test",
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many webhook requests" }
});

router.post("/payments", webhookLimiter, handlePaymentWebhook);

router.post("/custody", webhookLimiter, handleCustodyWebhook);

module.exports = router;
