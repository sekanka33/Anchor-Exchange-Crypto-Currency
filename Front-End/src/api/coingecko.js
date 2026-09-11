const API_KEY = import.meta.env.VITE_COINGECKO_API_KEY;

const BASE_URL = "https://api.coingecko.com/api/v3";

export const getCoinsByCategory = async (category = "all") => {
  let url =
    `${BASE_URL}/coins/markets` +
    `?vs_currency=usd` +
    `&order=market_cap_desc` +
    `&per_page=4` +
    `&page=1` +
    `&sparkline=false`;

  if (category !== "all") {
    url += `&category=${category}`;
  }

  const response = await fetch(url, {
    headers: {
      "x-cg-demo-api-key": API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch coins");
  }

  return await response.json();
};

export const getCoinPrice = async (coinId) => {
  const response = await fetch(
    `${BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd`,
    {
      headers: {
        "x-cg-demo-api-key": API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch coin price");
  }

  return await response.json();
};