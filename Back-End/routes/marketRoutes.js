const express = require("express");
const router = express.Router();

const {
    getCoinsMarkets,
    getGlobalMarketData,
    getCoinDetail,
    getSimplePrice,
    getBinanceTicker,
    getBinanceOrderBook,
    getBinanceTrades
} = require("../controllers/marketController");

router.get("/coins", getCoinsMarkets);

router.get("/global", getGlobalMarketData);

router.get("/price", getSimplePrice);

router.get("/ticker/:symbol", getBinanceTicker);

router.get("/orderbook/:symbol", getBinanceOrderBook);

router.get("/trades/:symbol", getBinanceTrades);

router.get("/coins/:id", getCoinDetail);

module.exports = router;
