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

module.exports = {
    getCoinsMarkets,
    getGlobalMarketData,
    getCoinDetail,
    getSimplePrice,
    getBinanceTicker
};
