const express = require("express");
const router = express.Router();

router.param("id", require("../middleware/validateId"));
const rateLimit = require("express-rate-limit");

const { requireCustomer } = require("../middleware/authorizeRole");
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

router.get("/", requireCustomer, getDeposits);

router.get("/crypto/networks", requireCustomer, getCryptoNetworks);

router.get("/crypto/address", requireCustomer, getCryptoDepositAddress);

router.post("/crypto/simulate", requireCustomer, depositLimiter, simulateCryptoDeposit);

router.get("/:id", requireCustomer, getDepositById);

router.post("/fiat", requireCustomer, depositLimiter, createFiatDeposit);

module.exports = router;
