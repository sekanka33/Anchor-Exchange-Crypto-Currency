const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const { requireCustomer } = require("../middleware/authorizeRole");
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

router.get("/", requireCustomer, getWithdrawals);

router.get("/confirm", confirmWithdrawal);

router.post("/crypto", requireCustomer, withdrawalLimiter, requestCryptoWithdrawal);

router.post("/fiat", requireCustomer, withdrawalLimiter, requestFiatWithdrawal);

router.post("/:id/cancel", requireCustomer, cancelWithdrawal);

router.get("/:id", requireCustomer, getWithdrawalById);

module.exports = router;
