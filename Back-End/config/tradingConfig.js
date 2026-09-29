const { SYMBOL_TO_COINGECKO_ID } = require("../utils/assetPrices");

const SUPPORTED_ASSETS = Object.keys(SYMBOL_TO_COINGECKO_ID);

module.exports = {
    FEE_RATE: 0.01,
    MIN_BUY_USD: 10,
    MAX_BUY_USD: 10000,
    MIN_SELL_USD: 10,
    MAX_SELL_USD: 10000,
    SUPPORTED_ASSETS
};
