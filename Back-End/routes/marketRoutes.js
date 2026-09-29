const express = require("express");
const router = express.Router();

const {
    getCoinsMarkets,
    getGlobalMarketData,
    getCoinDetail,
    getSimplePrice,
    getBinanceTicker
} = require("../controllers/marketController");

router.get("/coins", getCoinsMarkets);

router.get("/global", getGlobalMarketData);

router.get("/price", getSimplePrice);

router.get("/ticker/:symbol", getBinanceTicker);

router.get("/coins/:id", getCoinDetail);

module.exports = router;
