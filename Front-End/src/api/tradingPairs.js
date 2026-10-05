// Assets the backend can actually trade (Back-End/utils/assetPrices.js),
// quoted against USDT on Binance for live market data.
export const PAIRS = [
  { asset: "BTC", name: "Bitcoin", coingeckoId: "bitcoin" },
  { asset: "ETH", name: "Ethereum", coingeckoId: "ethereum" },
  { asset: "BNB", name: "BNB", coingeckoId: "binancecoin" },
  { asset: "SOL", name: "Solana", coingeckoId: "solana" },
  { asset: "XRP", name: "XRP", coingeckoId: "ripple" },
  { asset: "DOGE", name: "Dogecoin", coingeckoId: "dogecoin" },
  { asset: "ADA", name: "Cardano", coingeckoId: "cardano" },
].map((p) => ({ ...p, symbol: `${p.asset}USDT` }));

// Mirrors Back-End/config/tradingConfig.js
export const FEE_RATE = 0.01;
export const MIN_TRADE_USD = 10;
export const MAX_TRADE_USD = 10000;
