const express = require("express");
const router = express.Router();

const { handlePaymentWebhook } = require("../controllers/depositController");

// Public endpoint — not protected by JWT (real payment providers can't log
// in as a user). Authenticity is verified via HMAC signature instead, see
// paymentProviderService.verifySignature.
router.post("/payments", handlePaymentWebhook);

module.exports = router;
