const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const { getWallet, getWalletTransactions } = require("../controllers/walletController");

router.get(
    "/",
    authenticate,
    getWallet
);

router.get(
    "/transactions",
    authenticate,
    getWalletTransactions
);

module.exports = router;