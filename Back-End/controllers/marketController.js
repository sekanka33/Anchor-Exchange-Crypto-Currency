const marketDataService = require("../services/marketDataService");

const handleUpstreamError = (res, error, label) => {
    console.error(`${label} ERROR:`, error);
    res.status(502).json({ message: "Market data is temporarily unavailable. Please try again shortly." });
};

const getCoinsMarkets = async (req, res) => {

    try {

        const { category, perPage, page, sparkline, priceChangePercentage } = req.query;

        const data = await marketDataService.getCoinsMarkets({
            category,
            perPage: perPage ? Number(perPage) : undefined,
            page: page ? Number(page) : undefined,
            sparkline: sparkline === "true",
            priceChangePercentage
        });

        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET COINS MARKETS");

    }

};

const getGlobalMarketData = async (req, res) => {

    try {

        const data = await marketDataService.getGlobalMarketData();
        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET GLOBAL MARKET DATA");

    }

};

const getCoinDetail = async (req, res) => {

    try {

        const data = await marketDataService.getCoinDetail(req.params.id);
        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET COIN DETAIL");

    }

};

const getSimplePrice = async (req, res) => {

    const { ids, vsCurrencies } = req.query;

    if (!ids) {
        return res.status(400).json({ message: "ids query parameter is required" });
    }

    try {

        const data = await marketDataService.getSimplePrice(ids, vsCurrencies);
        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET SIMPLE PRICE");

    }

};

const getBinanceTicker = async (req, res) => {

    try {

        const data = await marketDataService.getBinanceTicker(req.params.symbol);
        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET BINANCE TICKER");

    }

};

// Binance symbols are uppercase alphanumerics, e.g. BTCUSDT.
const BINANCE_SYMBOL = /^[A-Z0-9]{5,20}$/;

// Binance only accepts these depth limits.
const ORDER_BOOK_LIMITS = [5, 10, 20, 50, 100];

const getBinanceOrderBook = async (req, res) => {

    const symbol = String(req.params.symbol).toUpperCase();

    if (!BINANCE_SYMBOL.test(symbol)) {
        return res.status(400).json({ message: "Invalid symbol" });
    }

    const requested = parseInt(req.query.limit, 10);
    const limit = ORDER_BOOK_LIMITS.includes(requested) ? requested : 10;

    try {

        const data = await marketDataService.getBinanceOrderBook(symbol, limit);
        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET BINANCE ORDER BOOK");

    }

};

const getBinanceTrades = async (req, res) => {

    const symbol = String(req.params.symbol).toUpperCase();

    if (!BINANCE_SYMBOL.test(symbol)) {
        return res.status(400).json({ message: "Invalid symbol" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    try {

        const data = await marketDataService.getBinanceTrades(symbol, limit);
        res.json(data);

    } catch (error) {

        handleUpstreamError(res, error, "GET BINANCE TRADES");

    }

};

module.exports = {
    getCoinsMarkets,
    getGlobalMarketData,
    getCoinDetail,
    getSimplePrice,
    getBinanceTicker,
    getBinanceOrderBook,
    getBinanceTrades
};
