const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const authenticate = require("../middleware/authenticate");

const {
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
    authenticate,
    getProfile
);


router.put(
    "/profile",
    authenticate,
    updateProfile
);


router.put(
    "/preferences",
    authenticate,
    updatePreferences
);


router.post(
    "/change-password",
    authenticate,
    changePasswordLimiter,
    changePassword
);


module.exports = router;