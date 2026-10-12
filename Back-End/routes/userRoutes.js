const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const { requireAccount, requireCustomer } = require("../middleware/authorizeRole");

const {
    getStats,
    getProfile,
    updateProfile,
    updatePreferences,
    changePassword
}=require("../controllers/userController");

// changePassword requires knowing the current password, so it's the one
// account-settings action worth rate-limiting — otherwise a stolen JWT could
// be used to brute-force the current password with unlimited attempts.
const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});


router.get(
    "/profile",
    requireAccount,
    getProfile
);


router.get(
    "/stats",
    requireCustomer,
    getStats
);


router.put(
    "/profile",
    requireAccount,
    updateProfile
);


router.put(
    "/preferences",
    requireAccount,
    updatePreferences
);


router.post(
    "/change-password",
    requireAccount,
    changePasswordLimiter,
    changePassword
);


module.exports = router;