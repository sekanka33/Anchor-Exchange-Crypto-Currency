const marketDataService = require("../services/marketDataService");
const { FIAT_CURRENCIES } = require("../config/fiatCurrencies");

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

// Live price of `assetSymbol` in fiat `quote` (e.g. BTC in ZAR), or 0 when
// unavailable. A market quote — used to price trades and value portfolios,
// never as a stored balance.
const getPrice = async (assetSymbol, quote = "USD") => {
    const symbol = String(assetSymbol).toUpperCase();
    const quoteCode = String(quote).toUpperCase();
    const vs = FIAT_CURRENCIES[quoteCode]?.coingecko;

    if (!vs) return 0;
    if (symbol === quoteCode) return 1;

    try {
        // Fiat in another fiat: via Tether, which tracks USD
        // (e.g. ZAR in USD = USDT/USD ÷ USDT/ZAR).
        if (FIAT_CURRENCIES[symbol]) {
            const fromVs = FIAT_CURRENCIES[symbol].coingecko;
            const data = await marketDataService.getSimplePrice("tether", `${vs},${fromVs}`);
            const inQuote = data?.tether?.[vs];
            const inSymbol = data?.tether?.[fromVs];
            return inQuote && inSymbol ? inQuote / inSymbol : 0;
        }

        const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol];
        if (!coingeckoId) return 0;

        const data = await marketDataService.getSimplePrice(coingeckoId, vs);
        return data?.[coingeckoId]?.[vs] || 0;
    } catch (error) {
        console.error(`ASSET PRICE ERROR (${symbol}/${quoteCode}):`, error.message);
        return 0;
    }
};

const getUsdPrice = (assetSymbol) => getPrice(assetSymbol, "USD");

module.exports = { getPrice, getUsdPrice, SYMBOL_TO_COINGECKO_ID };
