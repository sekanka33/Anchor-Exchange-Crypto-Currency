import { API_BASE_URL } from "./config";

const request = async (path) => {
  const response = await fetch(`${API_BASE_URL}/api/markets${path}`);

  if (!response.ok) {
    throw new Error("Market data request failed");
  }

  return response.json();
};

export const getCoinsByCategory = async (category = "all", perPage = 4) => {
  const params = new URLSearchParams({ category, perPage: String(perPage) });
  return request(`/coins?${params.toString()}`);
};

export const getCoinsMarkets = async ({
  category = "all",
  perPage = 15,
  page = 1,
  sparkline = false,
  priceChangePercentage,
} = {}) => {
  const params = new URLSearchParams({
    category,
    perPage: String(perPage),
    page: String(page),
    sparkline: String(sparkline),
  });

  if (priceChangePercentage) {
    params.set("priceChangePercentage", priceChangePercentage);
  }

  return request(`/coins?${params.toString()}`);
};

export const getCoinPrice = async (coinId) => {
  return request(`/price?ids=${encodeURIComponent(coinId)}`);
};

export const getGlobalMarketData = async () => {
  return request("/global");
};

export const getCoinDetail = async (coinId) => {
  return request(`/coins/${encodeURIComponent(coinId)}`);
};

export const getBinanceTicker = async (symbol) => {
  return request(`/ticker/${encodeURIComponent(symbol)}`);
};

// USD -> fiat exchange rates, derived from Tether's price in each currency
// (USDT tracks USD), e.g. { USD: 1, ZAR: 18.1, EUR: 0.92, GBP: 0.79 }.
export const getFiatRates = async (currencies) => {
  const vs = currencies.map((c) => c.toLowerCase()).join(",");
  const data = await request(`/price?ids=tether&vsCurrencies=${encodeURIComponent(vs)}`);
  const tether = data?.tether;
  if (!tether?.usd) throw new Error("Exchange rates unavailable");

  return Object.fromEntries(
    currencies
      .filter((c) => tether[c.toLowerCase()])
      .map((c) => [c, tether[c.toLowerCase()] / tether.usd])
  );
};

export const getBinanceOrderBook = async (symbol, limit = 10) => {
  return request(`/orderbook/${encodeURIComponent(symbol)}?limit=${limit}`);
};

export const getBinanceTrades = async (symbol, limit = 20) => {
  return request(`/trades/${encodeURIComponent(symbol)}?limit=${limit}`);
};
