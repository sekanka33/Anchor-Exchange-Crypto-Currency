const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const authenticate = require("../middleware/authenticate");
const {
    createFiatDeposit,
    getDeposits,
    getDepositById,
    getCryptoNetworks,
    getCryptoDepositAddress,
    simulateCryptoDeposit
} = require("../controllers/depositController");

const depositLimiter = rateLimit({
    windowMs: 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many deposit attempts. Please slow down." }
});

router.get("/", authenticate, getDeposits);

router.get("/crypto/networks", authenticate, getCryptoNetworks);

router.get("/crypto/address", authenticate, getCryptoDepositAddress);

router.post("/crypto/simulate", authenticate, depositLimiter, simulateCryptoDeposit);

router.get("/:id", authenticate, getDepositById);

router.post("/fiat", authenticate, depositLimiter, createFiatDeposit);

module.exports = router;
