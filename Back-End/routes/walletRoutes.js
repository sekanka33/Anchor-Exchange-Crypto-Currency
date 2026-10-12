const express = require("express");
const router = express.Router();

const { requireCustomer } = require("../middleware/authorizeRole");
const { getWallet, getWalletTransactions } = require("../controllers/walletController");

router.get(
    "/",
    requireCustomer,
    getWallet
);

router.get(
    "/transactions",
    requireCustomer,
    getWalletTransactions
);

module.exports = router;