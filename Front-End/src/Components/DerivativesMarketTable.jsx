import { useState, useEffect } from "react";
import { getCoinsMarkets } from "../api/coingecko";

// Category mappings for the market data proxy
const CATEGORIES = [
  { name: "Hot", id: "" }, // Top overall coins by market cap
  { name: "New", id: "recently-added" },
  { name: "DeFi", id: "decentralized-finance-defi" },
  { name: "NFT", id: "non-fungible-tokens-nft" },
];

export default function DerivativesMarketTable() {
  const [mainTab, setMainTab] = useState("Derivatives");
  const [subTab, setSubTab] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetches top 15 coins per selected category
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

    fetchMarketData();
  }, [selectedCategory]);

  return (
    <div className="w-full min-h-screen text-slate-900 dark:text-white px-4 md:px-12 lg:px-20 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white dark:bg-line-color text-slate-900 dark:text-white rounded-2xl border border-gray-200 dark:border-[#212634] p-6 shadow-2xl">
        
        {/* Top Level Navigation Tabs (Favorites, Derivatives, Spot) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-gray-200 dark:border-[#232938] [&>button]:flex-shrink-0">
          {["Favorites", "Derivatives", "Spot"].map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                mainTab === tab
                  ? "bg-[#155dfc] text-white shadow-md shadow-blue-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1f2432]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sub Navigation (All, Inverse Perpetual, USDT Perpetual, Inserve Futures) */}
        <div className="flex items-center gap-8 overflow-x-auto border-b border-gray-200 dark:border-[#232938] pb-3 mb-5 text-sm font-medium [&>button]:flex-shrink-0">
          {["All", "Inverse Perpetual", "USDT Perpetual", "Inserve Futures"].map((sub) => (
            <button
              key={sub}
              onClick={() => setSubTab(sub)}
              className={`relative pb-3 transition-colors ${
                subTab === sub ? "text-slate-900 dark:text-white font-semibold" : "text-gray-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200"
              }`}
            >
              {sub}
              {subTab === sub && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#3b82f6]" />
              )}
            </button>
          ))}
        </div>

        {/* Category Pill Filters (Hot, New, DeFi, NFT) - 15 per category */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 mb-6 [&>button]:flex-shrink-0">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory.name === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#155dfc] text-white shadow-md shadow-blue-500/20"
                    : "text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#202534]"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Market Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 text-xs font-medium border-b border-gray-200 dark:border-[#232938]">
                <th className="py-3 px-2 w-10">#</th>
                <th className="py-3 px-2">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    Trading Pairs <SortIcon />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    Last Traded <SortIcon />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    24H Change % <SortIcon />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">24H High</th>
                <th className="py-3 px-2 text-right">24H Low</th>
                <th className="py-3 px-2 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    24H Turnover <SortIcon />
                  </div>
                </th>
                <th className="py-3 px-2 text-center">Chart</th>
                <th className="py-3 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton Loader Rows
                [...Array(15)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-[#1d222e]/50 animate-pulse">
                    <td colSpan="9" className="py-4">
                      <div className="h-6 bg-gray-100 dark:bg-[#212635] rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan="9" className="text-center py-10 text-red-400">
                    {error}
                  </td>
                </tr>
              ) : (
                coins.map((coin, index) => {
                  const isPositive = coin.price_change_percentage_24h >= 0;

                  return (
                    <tr
                      key={coin.id}
                      className="border-b border-gray-200 dark:border-[#1e2330] hover:bg-gray-50 dark:hover:bg-[#1e2332] transition-colors"
                    >
                      {/* Rank & Favorite Star */}
                      <td className="py-3.5 px-2 text-gray-500 dark:text-gray-400 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 dark:text-gray-500 hover:text-yellow-400 cursor-pointer">
                            ☆
                          </span>
                          <span>{index + 1}</span>
                        </div>
                      </td>

                      {/* Coin Logo & Name */}
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={coin.image}
                            alt={coin.name}
                            className="w-6 h-6 rounded-full"
                          />
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {coin.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
                            | {coin.symbol}
                          </span>
                        </div>
                      </td>

                      {/* Last Traded Price */}
                      <td className="py-3.5 px-2 text-right font-medium text-slate-900 dark:text-white">
                        {coin.current_price?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </td>

                      {/* 24h Change % */}
                      <td
                        className={`py-3.5 px-2 text-right font-semibold ${
                          isPositive ? "text-[#22c55e]" : "text-[#f87171]"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {coin.price_change_percentage_24h?.toFixed(2)}%
                      </td>

                      {/* 24h High */}
                      <td className="py-3.5 px-2 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {coin.high_24h?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        }) || "—"}
                      </td>

                      {/* 24h Low */}
                      <td className="py-3.5 px-2 text-right text-gray-600 dark:text-gray-300 font-medium">
                        {coin.low_24h?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        }) || "—"}
                      </td>

                      {/* 24h Turnover (Volume) formatted like 5.04B(USD) */}
                      <td className="py-3.5 px-2 text-right text-gray-600 dark:text-gray-300 font-medium text-xs">
                        {formatTurnover(coin.total_volume)}
                      </td>

                      {/* Sparkline Mini Graph */}
                      <td className="py-3.5 px-2 text-center">
                        <div className="flex justify-center">
                          <MiniSparkline
                            data={coin.sparkline_in_7d?.price || []}
                            isPositive={isPositive}
                          />
                        </div>
                      </td>

                      {/* Trade Button */}
                      <td className="py-3.5 px-2 text-right">
                        <button
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            index === 1
                              ? "bg-blue-600 border-blue-600 text-white shadow-md"
                              : "border-slate-900 dark:border-gray-500 text-slate-900 dark:text-gray-200 hover:border-blue-600 hover:bg-blue-600 hover:text-white"
                          }`}
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sparkline SVG renderer
function MiniSparkline({ data, isPositive }) {
  if (!data || data.length === 0) return <div className="w-[80px] h-[20px]" />;

  const sampled = data.filter((_, idx) => idx % 6 === 0);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;

  const width = 80;
  const height = 24;

  const points = sampled
    .map((val, idx) => {
      const x = (idx / (sampled.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// Sort Arrow Icon Helper
function SortIcon() {
  return (
    <span className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white flex flex-col leading-none">
      ▲▼
    </span>
  );
}

// Formats raw volume numbers into B(USD) or M(USD) like the image
function formatTurnover(num) {
  if (!num) return "—";
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B(USD)`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M(USD)`;
  return `${num.toLocaleString()}(USD)`;
}