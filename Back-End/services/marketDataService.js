const cache = require("../utils/cache");

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const BINANCE_BASE_URL = "https://api.binance.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

const TTL = {
    coinsMarkets: 30_000,
    global: 60_000,
    coinDetail: 30_000,
    simplePrice: 15_000,
    ticker: 10_000,
    orderBook: 3_000,
    trades: 3_000
};

const cachedFetch = async (key, ttlMs, fetchFn) => {

    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    try {

        const data = await fetchFn();
        cache.set(key, data, ttlMs);
        return data;

    } catch (error) {

        const stale = cache.getStale(key);

        if (stale !== undefined) {
            console.error(`MARKET DATA: live fetch failed for "${key}", serving stale cache:`, error.message);
            return stale;
        }

        throw error;

    }

};

const coingeckoFetch = async (path) => {

    const response = await fetch(`${COINGECKO_BASE_URL}${path}`, {
        headers: COINGECKO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_API_KEY } : {}
    });

    if (!response.ok) {
        throw new Error(`CoinGecko request failed with status ${response.status}`);
    }

    return response.json();

};

const getCoinsMarkets = ({ category = "all", perPage = 15, page = 1, sparkline = false, priceChangePercentage } = {}) => {

    const key = `coinsMarkets:${category}:${perPage}:${page}:${sparkline}:${priceChangePercentage || ""}`;

    return cachedFetch(key, TTL.coinsMarkets, async () => {

        let path =
            `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=${sparkline}`;

        if (category && category !== "all") {
            path += `&category=${encodeURIComponent(category)}`;
        }

        if (priceChangePercentage) {
            path += `&price_change_percentage=${encodeURIComponent(priceChangePercentage)}`;
        }

        return coingeckoFetch(path);

    });

};

const getGlobalMarketData = () => {

    return cachedFetch("global", TTL.global, () => coingeckoFetch("/global"));

};

const getCoinDetail = (id) => {

    return cachedFetch(`coinDetail:${id}`, TTL.coinDetail, () => coingeckoFetch(
        `/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
    ));

};

const getSimplePrice = (ids, vsCurrencies = "usd") => {

    return cachedFetch(`simplePrice:${ids}:${vsCurrencies}`, TTL.simplePrice, () => coingeckoFetch(
        `/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vsCurrencies)}`
    ));

};

const binanceFetch = async (path) => {

    const response = await fetch(`${BINANCE_BASE_URL}${path}`);

    if (!response.ok) {
        throw new Error(`Binance request failed with status ${response.status}`);
    }

    return response.json();

};

const getBinanceTicker = (symbol) => {

    return cachedFetch(`ticker:${symbol}`, TTL.ticker, () => binanceFetch(
        `/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
    ));

};

// Top-of-book bids/asks, e.g. { bids: [["63445.00", "1.45"], ...], asks: [...] }
const getBinanceOrderBook = (symbol, limit = 10) => {

    return cachedFetch(`orderBook:${symbol}:${limit}`, TTL.orderBook, () => binanceFetch(
        `/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
    ));

};

// Most recent public trades, newest last (Binance order).
const getBinanceTrades = (symbol, limit = 20) => {

    return cachedFetch(`trades:${symbol}:${limit}`, TTL.trades, () => binanceFetch(
        `/trades?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
    ));

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
