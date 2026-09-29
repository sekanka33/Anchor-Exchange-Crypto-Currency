const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const authenticate = require("../middleware/authenticate");
const {
    requestCryptoWithdrawal,
    requestFiatWithdrawal,
    confirmWithdrawal,
    cancelWithdrawal,
    getWithdrawals,
    getWithdrawalById
} = require("../controllers/withdrawalController");

const withdrawalLimiter = rateLimit({
    windowMs: 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many withdrawal attempts. Please slow down." }
});

router.get("/", authenticate, getWithdrawals);

router.get("/confirm", confirmWithdrawal);

router.post("/crypto", authenticate, withdrawalLimiter, requestCryptoWithdrawal);

router.post("/fiat", authenticate, withdrawalLimiter, requestFiatWithdrawal);

router.post("/:id/cancel", authenticate, cancelWithdrawal);

router.get("/:id", authenticate, getWithdrawalById);

module.exports = router;
