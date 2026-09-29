const marketDataService = require("../services/marketDataService");

// Only a small set of assets are supported for now — extend as new assets are listed.
const SYMBOL_TO_COINGECKO_ID = {
    BTC: "bitcoin",
    ETH: "ethereum",
    BNB: "binancecoin",
    SOL: "solana",
    XRP: "ripple",
    DOGE: "dogecoin",
    ADA: "cardano",
    USDT: "tether",
};

const FIAT_SYMBOLS = new Set(["USD"]);

const getUsdPrice = async (assetSymbol) => {

    const symbol = assetSymbol.toUpperCase();

    if (FIAT_SYMBOLS.has(symbol)) {
        return 1;
    }

    const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol];

    if (!coingeckoId) {
        return 0;
    }

    try {

        const priceData = await marketDataService.getSimplePrice(coingeckoId, "usd");
        return priceData?.[coingeckoId]?.usd || 0;

    } catch (error) {

        console.error(`ASSET PRICE ERROR (${symbol}):`, error.message);
        return 0;

    }

};

module.exports = { getUsdPrice, SYMBOL_TO_COINGECKO_ID };
