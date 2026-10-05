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
    <div className="flex flex-col gap-7 px-4 md:pl-28 md:pr-28 relative md:bottom-17 pt-15">
      <div className="w-full bg-white dark:bg-gray-900 text-slate-900 dark:text-white rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl">
        
        {/* Top Level Navigation Tabs (Favorites, Derivatives, Spot) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-gray-200 dark:border-gray-800 [&>button]:flex-shrink-0">
          {["Favorites", "Derivatives", "Spot"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMainTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                mainTab === tab
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-8 overflow-x-auto border-b border-gray-200 dark:border-gray-800 pb-3 mb-5 text-sm font-medium [&>button]:flex-shrink-0">
          {["All", "Inverse Perpetual", "USDT Perpetual", "Inserve Futures"].map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSubTab(sub)}
              className={`relative pb-3 transition-colors ${
                subTab === sub
                  ? "text-slate-900 dark:text-white font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
              }`}
            >
              {sub}
              {subTab === sub && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* Category Pill Filters (Hot, New, DeFi, NFT) */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 mb-6 [&>button]:flex-shrink-0">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory.name === cat.name;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Market Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm border-collapse">
            <thead>
              <tr className="text-gray-600 dark:text-gray-400 text-xs font-semibold border-b border-gray-200 dark:border-gray-800">
                <th scope="col" className="py-3 px-3 w-12 text-center">#</th>
                <th scope="col" className="py-3 px-3">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    Trading Pairs <SortIcon />
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    Last Traded <SortIcon />
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    24H Change % <SortIcon />
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 text-right">24H High</th>
                <th scope="col" className="py-3 px-3 text-right">24H Low</th>
                <th scope="col" className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                    24H Turnover <SortIcon />
                  </div>
                </th>
                <th scope="col" className="py-3 px-3 text-center">Chart</th>
                <th scope="col" className="py-3 px-3 text-right w-24">Action</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                [...Array(15)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-3.5 px-3">
                      <div className="h-6 bg-slate-100 dark:bg-gray-800/60 rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-red-600 dark:text-red-500 font-medium">
                    {error}
                  </td>
                </tr>
              ) : (
                coins.map((coin, index) => {
                  const isPositive = coin.price_change_percentage_24h >= 0;

                  return (
                    <tr
                      key={coin.id}
                      className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Rank & Favorite Star */}
                      <td className="py-3.5 px-3 text-gray-500 dark:text-gray-400 text-xs text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-gray-400 dark:text-gray-500 hover:text-amber-400 cursor-pointer">
                            ★
                          </span>
                          <span>{index + 1}</span>
                        </div>
                      </td>

                      {/* Coin Logo & Name */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="flex items-center gap-2.5 font-medium">
                          <img
                            src={coin.image}
                            alt={coin.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {coin.name}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                            {coin.symbol}
                          </span>
                        </div>
                      </td>

                      {/* Last Traded Price */}
                      <td className="py-3.5 px-3 text-right font-semibold text-slate-900 dark:text-white align-middle">
                        ${coin.current_price?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </td>

                      {/* 24h Change % */}
                      <td
                        className={`py-3.5 px-3 text-right font-semibold align-middle ${
                          isPositive
                            ? "text-green-700 dark:text-green-500"
                            : "text-red-600 dark:text-red-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {coin.price_change_percentage_24h?.toFixed(2)}%
                      </td>

                      {/* 24h High */}
                      <td className="py-3.5 px-3 text-right text-gray-600 dark:text-gray-300 font-medium align-middle">
                        ${coin.high_24h?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        }) || "—"}
                      </td>

                      {/* 24h Low */}
                      <td className="py-3.5 px-3 text-right text-gray-600 dark:text-gray-300 font-medium align-middle">
                        ${coin.low_24h?.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        }) || "—"}
                      </td>

                      {/* 24h Turnover */}
                      <td className="py-3.5 px-3 text-right text-gray-600 dark:text-gray-300 font-medium text-xs align-middle">
                        {formatTurnover(coin.total_volume)}
                      </td>

                      {/* Sparkline Mini Graph */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <div className="flex justify-center">
                          <MiniSparkline
                            data={coin.sparkline_in_7d?.price || []}
                            isPositive={isPositive}
                          />
                        </div>
                      </td>

                      {/* Trade Button */}
                      <td className="py-3.5 px-3 text-right align-middle">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-20 h-8 border-2 rounded-full border-slate-900 dark:border-white hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-colors text-xs font-semibold"
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
    <span className="text-[10px] text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white flex flex-col leading-none">
      ▲▼
    </span>
  );
}

// Formats raw volume numbers into B(USD) or M(USD)
function formatTurnover(num) {
  if (!num) return "—";
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B(USD)`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M(USD)`;
  return `${num.toLocaleString()}(USD)`;
}