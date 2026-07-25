const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const { getWallet } = require("../controllers/walletController");


router.get(
    "/wallet",
    authenticate,
    getWallet
);


module.exports = router;