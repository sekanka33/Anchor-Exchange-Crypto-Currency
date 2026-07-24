const API_KEY = import.meta.env.VITE_COINGECKO_API_KEY;

export const getCoinsByCategory = async (category) => {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=4&page=1&sparkline=false`,
    {
      headers: {
        "x-cg-demo-api-key": API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch coins");
  }

  return await response.json();
};