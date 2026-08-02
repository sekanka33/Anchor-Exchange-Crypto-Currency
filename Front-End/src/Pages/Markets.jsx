import React, { useState, useEffect } from "react";
import CryptoMarketBar from "../Components/DerivativesMarketTable";

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

export default function Markets() {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [coins, setCoins] = useState([]);
  const [globalMarketCap, setGlobalMarketCap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch Global Crypto Market Cap
  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/global");
        if (!response.ok) throw new Error("Failed to fetch global stats");
        const json = await response.json();
        const totalCapUSD = json.data?.total_market_cap?.usd;

        if (totalCapUSD) {
          // Format into Trillions ($1.86T) or Billions ($860B)
          const formattedCap =
            totalCapUSD >= 1e12
              ? `$${(totalCapUSD / 1e12).toFixed(2)}T`
              : `$${(totalCapUSD / 1e9).toFixed(2)}B`;
          setGlobalMarketCap(formattedCap);
        }
      } catch (err) {
        console.error("Global market cap fetch error:", err);
      }
    };

    fetchGlobalData();
  }, []);

  // 2. Fetch Top 15 Category Coins
  useEffect(() => {
    const fetchCryptoData = async () => {
      setLoading(true);
      setError(null);
      try {
        const categoryParam = selectedCategory.id
          ? `&category=${selectedCategory.id}`
          : "";
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd${categoryParam}&order=market_cap_desc&per_page=15&page=1&sparkline=true&price_change_percentage=24h`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch market data from CoinGecko");
        }
        const data = await response.json();
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
    <div>
      {/* Hero Header Section */}
      <div className="w-full h-110 bg-hero2-dark pr-35 pl-35 pt-20">
        <div className="flex flex-col gap-2 text-4xl md:text-5xl font-bold tracking-tight">
          <p>Today’s</p>
          <p>Cryptocurrency</p>
          <p>prices</p>
        </div>

        {/* Dynamic Global Market Cap Paragraph */}
        <p className="text-gray-400 pt-4 text-xl md:text-2xl">
          The global crypto market cap is{" "}
          <span className="text-white font-semibold">
            {globalMarketCap || "loading..."}
          </span>
        </p>
      </div>

      {/* Main Market Bar Container */}
      <div className="relative px-4 md:px-12 lg:px-20 py-6 bottom-20">
        <div className="w-full bg-line-color p-6 rounded-2xl border border-[#212634] shadow-2xl">
          {/* Top Navigation Bar / Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-[#1e2330] scrollbar-none">
            {CATEGORIES.map((category) => {
              const isActive = selectedCategory.name === category.name;
              return (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-[#3b82f6] text-white shadow-lg  scale-105"
                      : "text-gray-400 hover:text-white hover:bg-[#1a1e2b]"
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
                  className="min-w-[280px] h-[140px] bg-[#161a25] animate-pulse rounded-2xl border border-[#232938]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 font-medium">
              {error} — Please try again shortly.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {coins.map((coin) => {
                const isPositive = coin.price_change_percentage_24h >= 0;
                const priceFormatted = coin.current_price?.toLocaleString(
                  "en-US",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  }
                );

                return (
                  <div
                    key={coin.id}
                    className="min-w-[280px] flex-1 bg-[#151821] hover:bg-[#1a1e2b] transition-all duration-200 border border-[#212735] rounded-2xl p-4 flex flex-col justify-between"
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
                              ? "bg-[#22c55e]/15 text-[#22c55e]"
                              : "bg-[#ef4444]/15 text-[#ef4444]"
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
                        <span className="text-xs text-gray-400 font-medium block mb-1">
                          {coin.name}
                        </span>
                        <span className="text-lg font-bold text-white tracking-wide">
                          USD {priceFormatted}
                        </span>
                      </div>

                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
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
      
      <div>
        <CryptoMarketBar />
      </div>
      
      <div className="pt-45 pb-16 px-4 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col gap-3 text-center mb-12">
          <div className="flex justify-center text-3xl sm:text-4xl font-bold">
            <p>Learn And Earn</p>
          </div>

          <div className="text-text-color flex justify-center">
            <div className="flex flex-col gap-1 items-center max-w-md">
              <p>Stacks is a production-ready library of stackable</p>
              <p>content blocks built in React Native.</p>
            </div>
          </div>
        </div>

          {/* Cards Grid Container */}
          <div className="flex flex-wrap justify-center gap-8">
            {/* Card 1 */}
            <div className="w-full sm:w-80 md:w-96 flex flex-col justify-between p-4 bg-background rounded-2xl shadow-sm">
              <div className="w-full aspect-video bg-hero2-dark rounded-2xl overflow-hidden">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/6VEzWfADwJE"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="h-8 w-32 bg-blue-500 text-white text-xs uppercase font-semibold flex items-center justify-center rounded-sm mt-5">
                <p>learn & earn</p>
              </div>

              <div className="mt-4 font-medium text-lg">
                <p>Learn about UI8 coin and earn an All-Access Pass</p>
              </div>

              <div className="flex justify-between items-center mt-6 pt-3 text-sm">
                <div className="flex flex-row gap-2 items-center">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <p className="font-medium">Binance</p>
                </div>

                <div>
                  <p className="text-gray-500">2025</p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="w-full sm:w-80 md:w-96 flex flex-col justify-between p-4 bg-background rounded-2xl shadow-sm">
              <div className="w-full aspect-video bg-hero2-dark rounded-2xl overflow-hidden">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/k9sR7UkXX-s"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="h-8 w-32 bg-blue-500 text-white text-xs uppercase font-semibold flex items-center justify-center rounded-sm mt-5">
                <p>learn & earn</p>
              </div>

              <div className="mt-4 font-medium text-lg">
                <p>Learn about API</p>
              </div>

              <div className="flex justify-between items-center mt-6 pt-3 text-sm">
                <div className="flex flex-row gap-2 items-center">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <p className="font-medium">Binance</p>
                </div>

                <div>
                  <p className="text-gray-500">2025</p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="w-full sm:w-80 md:w-96 flex flex-col justify-between p-4 bg-background rounded-2xl shadow-sm">
              <div className="w-full aspect-video bg-hero2-dark rounded-2xl overflow-hidden">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/ekl4Tc5-qJ4"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="h-8 w-32 bg-blue-500 text-white text-xs uppercase font-semibold flex items-center justify-center rounded-sm mt-5">
                <p>learn & earn</p>
              </div>

              <div className="mt-4 font-medium text-lg">
                <p>Learn about how to trade daily</p>
              </div>

              <div className="flex justify-between items-center mt-6 pt-3 text-sm">
                <div className="flex flex-row gap-2 items-center">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <p className="font-medium">Bybit</p>
                </div>

                <div>
                  <p className="text-gray-500">2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>

    </div>
  );
}