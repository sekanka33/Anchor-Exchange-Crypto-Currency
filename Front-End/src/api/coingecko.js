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
