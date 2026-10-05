import { useState, useEffect } from "react";
import { useCurrency } from "../hooks/useCurrency";
import { getCoinsMarkets } from "../api/coingecko";

const CATEGORIES = [
  { name: "Crypto", id: "" },
  { name: "DeFi", id: "decentralized-finance-defi" },
  { name: "BSC", id: "binance-smart-chain" },
  { name: "NFT", id: "non-fungible-tokens-nft" },
  { name: "Metaverse", id: "metaverse" },
  { name: "Polkadot", id: "polkadot-ecosystem" },
  { name: "Solana", id: "solana-ecosystem" },
  { name: "Opensea", id: "opensea-nft-ecosystem" },
  { name: "Makersplace", id: "makersplace" },
];

function Sparkline({ data, isPositive }) {
  if (!data || data.length === 0) return null;

  const sampledData = data.filter((_, index) => index % 4 === 0);
  const min = Math.min(...sampledData);
  const max = Math.max(...sampledData);
  const range = max - min || 1;

  const width = 100;
  const height = 30;

  const points = sampledData
    .map((val, idx) => {
      const x = (idx / (sampledData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function CryptoMarketBar() {
  const { formatMoney } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCryptoData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCoinsMarkets({
          category: selectedCategory.id || "all",
          perPage: 15,
          page: 1,
          sparkline: true,
          priceChangePercentage: "24h",
        });
        setCoins(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCryptoData();
  }, [selectedCategory]);

  return (
    <div className="relative px-4 md:px-12 lg:px-20 py-6 bottom-50">
      <div className="w-full bg-white dark:bg-[#111319] text-slate-900 dark:text-white p-6 rounded-2xl border border-gray-200 dark:border-[#212634] shadow-2xl">
        {/* Top Navigation Bar / Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-gray-200 dark:border-[#1e2330] scrollbar-none">
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory.name === category.name;
            return (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category)}
                className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? "bg-[#155dfc] text-white shadow-lg shadow-blue-500/25 scale-105"
                    : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1a1e2b]"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        {/* Cards Scroll Container */}
        {loading ? (
          <div className="flex gap-4 overflow-hidden py-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="min-w-[280px] h-[140px] bg-gray-100 dark:bg-[#161a25] animate-pulse rounded-2xl border border-gray-200 dark:border-[#232938]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400 font-medium">
            {error} — Please try again shortly.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent" tabIndex={0} role="region" aria-label="Coin cards, scroll horizontally">
            {coins.map((coin) => {
              const isPositive = coin.price_change_percentage_24h >= 0;
              const priceFormatted = formatMoney(coin.current_price, { maximumFractionDigits: 6 });

              return (
                <div
                  key={coin.id}
                  className="min-w-[280px] flex-1 bg-white dark:bg-[#151821] hover:bg-gray-50 dark:hover:bg-[#1a1e2b] transition-all duration-200 border border-gray-200 dark:border-[#212735] rounded-2xl p-4 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <img
                      src={coin.image}
                      alt={coin.name}
                      className="w-10 h-10 rounded-full border border-gray-700/50 shadow-md"
                    />

                    <div className="flex flex-col items-end gap-1">
                      <Sparkline
                        data={coin.sparkline_in_7d?.price || []}
                        isPositive={isPositive}
                      />

                      <div
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          isPositive
                            ? "bg-green-100 text-green-700 dark:bg-[#22c55e]/15 dark:text-[#22c55e]"
                            : "bg-red-100 text-red-700 dark:bg-[#ef4444]/15 dark:text-[#f87171]"
                        }`}
                      >
                        <span>{isPositive ? "↑" : "↓"}</span>
                        <span>
                          {Math.abs(
                            coin.price_change_percentage_24h || 0
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium block mb-1">
                        {coin.name}
                      </span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">
                        {priceFormatted}
                      </span>
                    </div>

                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      {coin.symbol}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}