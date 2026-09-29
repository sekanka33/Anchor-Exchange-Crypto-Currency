const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { register, login, verifyEmail, forgotPassword, resetPassword } = require("../controllers/authController");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});

router.post("/register", authLimiter, register);

router.post("/login", authLimiter, login);

router.get("/verify-email", verifyEmail);

router.post("/forgot-password", authLimiter, forgotPassword);

router.post("/reset-password", authLimiter, resetPassword);


module.exports = router;