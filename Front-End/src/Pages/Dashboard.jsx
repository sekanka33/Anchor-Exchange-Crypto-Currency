import React, { useState, useEffect, useRef } from 'react'
import { FaChevronDown, FaPlus, FaSearch, FaStar, FaRegStar } from 'react-icons/fa'
import { FiMoon, FiSun, FiBell } from "react-icons/fi";
import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme';
import { IoSearch, IoCheckmarkCircleOutline, IoCloseCircleOutline } from "react-icons/io5";

// 1. Top 15 Coins
export const topCoins = [
  { name: "Bitcoin", symbol: "BTCUSDT", pair: "BTC/USD" },
  { name: "Ethereum", symbol: "ETHUSDT", pair: "ETH/USD" },
  { name: "BNB", symbol: "BNBUSDT", pair: "BNB/USD" },
  { name: "Solana", symbol: "SOLUSDT", pair: "SOL/USD" },
  { name: "XRP", symbol: "XRPUSDT", pair: "XRP/USD" },
  { name: "Dogecoin", symbol: "DOGEUSDT", pair: "DOGE/USD" },
  { name: "Cardano", symbol: "ADAUSDT", pair: "ADA/USD" },
  { name: "TRON", symbol: "TRXUSDT", pair: "TRX/USD" },
  { name: "Avalanche", symbol: "AVAXUSDT", pair: "AVAX/USD" },
  { name: "Chainlink", symbol: "LINKUSDT", pair: "LINK/USD" },
  { name: "Toncoin", symbol: "TONUSDT", pair: "TON/USD" },
  { name: "Sui", symbol: "SUIUSDT", pair: "SUI/USD" },
  { name: "Shiba Inu", symbol: "SHIBUSDT", pair: "SHIB/USD" },
  { name: "Litecoin", symbol: "LTCUSDT", pair: "LTC/USD" },
  { name: "Polkadot", symbol: "DOTUSDT", pair: "DOT/USD" },
];

// 3. Timeframes
const timeframes = [
  { label: "5M", value: "5" },
  { label: "30M", value: "30" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "D", value: "D" },
  { label: "W", value: "W" },
  { label: "M", value: "M" },
];

const Dashboard = () => {

  const { isDarkMode, toggleTheme } = useTheme();

  // 2. State
  const [selectedCoin, setSelectedCoin] = useState(topCoins[0]);
  const [timeframe, setTimeframe] = useState("60");
  const [marketData, setMarketData] = useState(null);

  // State for Market Pairs Card (CoinGecko Data)
  const [marketPairs, setMarketPairs] = useState([]);
  const [activeTab, setActiveTab] = useState("BTC");
  const [loading, setLoading] = useState(true);

  // Ref for TradingView Chart Container
  const chartContainerRef = useRef(null);

  // 6. TradingView
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartContainerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${selectedCoin.symbol}`,
      interval: timeframe,
      timezone: "Etc/UTC",
      theme: isDarkMode ? "dark" : "light",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: true,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com"
    });

    chartContainerRef.current.appendChild(script);
  }, [selectedCoin, timeframe, isDarkMode]);

  // 8. Fetch Binance 24hr ticker
  useEffect(() => {
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${selectedCoin.symbol}`)
      .then((res) => res.json())
      .then((data) => {
        setMarketData(data);
      })
      .catch((err) => console.error("Error fetching Binance market data:", err));
  }, [selectedCoin]);

  // Fetch live market data from CoinGecko (Top 15 coins)
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=false"
        );
        const data = await response.json();

        const formatted = data.map((coin) => ({
          id: coin.id,
          pair: `${coin.symbol.toUpperCase()}/BTC`,
          lastPrice: coin.current_price > 1 
            ? (coin.current_price / 65000).toFixed(6) 
            : coin.current_price.toFixed(6),
          change: coin.price_change_percentage_24h,
          isStarred: Math.random() > 0.5,
        }));

        setMarketPairs(formatted);
      } catch (err) {
        console.error("Error fetching market data from CoinGecko:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
  }, []);

  const toggleStar = (id) => {
    setMarketPairs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isStarred: !item.isStarred } : item
      )
    );
  };

  // Static/Mock Data for Order Book
  const asks = [
    { price: "0.022572", amount: "1.262415", total: "15.19648", depth: 40 },
    { price: "0.020371", amount: "1.262415", total: "15.19648", depth: 60 },
    { price: "0.023572", amount: "1.262415", total: "15.19648", depth: 75 },
    { price: "0.032378", amount: "1.262415", total: "15.19648", depth: 50 },
    { price: "0.022573", amount: "1.262415", total: "15.19648", depth: 85 },
  ];

  const bids = [
    { price: "0.022572", amount: "1.262415", total: "15.19648", depth: 80 },
    { price: "0.020371", amount: "1.262415", total: "15.19648", depth: 65 },
    { price: "0.023572", amount: "1.262415", total: "15.19648", depth: 45 },
    { price: "0.032378", amount: "1.262415", total: "15.19648", depth: 30 },
  ];

  // Static/Mock Data for Recent Trades
  const recentTrades = [
    { time: "14:04:54", price: "0.022572", amount: "1.262415", type: "sell" },
    { time: "14:04:54", price: "0.020371", amount: "1.262415", type: "buy" },
    { time: "14:04:54", price: "0.020371", amount: "1.262415", type: "buy" },
    { time: "14:04:54", price: "0.022572", amount: "1.262415", type: "sell" },
    { time: "14:04:54", price: "0.020371", amount: "1.262415", type: "buy" },
    { time: "14:04:54", price: "0.022572", amount: "1.262415", type: "sell" },
    { time: "14:04:54", price: "0.023572", amount: "1.262415", type: "buy" },
    { time: "14:04:54", price: "0.032378", amount: "1.262415", type: "sell" },
    { time: "14:04:54", price: "0.023572", amount: "1.262415", type: "buy" },
    { time: "14:04:54", price: "0.023572", amount: "1.262415", type: "buy" },
    { time: "14:04:54", price: "0.032378", amount: "1.262415", type: "sell" },
    { time: "14:04:54", price: "0.032378", amount: "1.262415", type: "sell" },
  ];

  return (
    <div className="flex min-h-screen">

      {/* Side NavBar */}
      <div className="w-70 h-screen border-2 border-dark-void pl-8 pt-5 sticky top-0 flex-shrink-0">

        {/* Logo */}
        <div>
          <Link>
            <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-white hover:text-blue-500">
              Anchor Exchange
            </span>
          </Link>
        </div>

        {/* middle Section */}
        <div className="pt-15 flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/home-icon.png" alt="Home" className="w-6 h-6" />
              <Link className="text-lg font-medium">Home</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/bitcoin-card-777.png" alt="Buy Crypto" className="w-6 h-6" />
              <Link className="text-lg font-medium">Buy Crypto</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Market" className="w-6 h-6" />
              <Link className="text-lg font-medium">Market</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Exchange" className="w-6 h-6" />
              <Link className="text-lg font-medium">Exchange</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Spot" className="w-6 h-6" />
              <Link className="text-lg font-medium">Spot</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="ByFi Center" className="w-6 h-6" />
              <Link className="text-lg font-medium">ByFi Center</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="More" className="w-6 h-6" />
              <Link className="text-lg font-medium">More</Link>
            </div>
          </div>

          <hr className="mr-15 border-dark-void" />

          <div className="flex flex-col gap-5">
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Asset" className="w-6 h-6" />
              <Link className="text-lg font-medium">Asset</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Orders" className="w-6 h-6" />
              <Link className="text-lg font-medium">Order & Trades</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Wallet" className="w-6 h-6" />
              <Link className="text-lg font-medium">Wallet</Link>
            </div>
          </div>
        </div>

        <div className='flex flex-row gap-5 items-center pt-35'>
          <img src="src/assets/log out icon.png" alt="log-out" />
          <p className='text-lg text-red-500 font-medium'>Log out</p>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar */}
        <div className="h-20 bg-white dark:bg-[#0d0e12] border-b border-dark-void flex items-center justify-end px-8 sticky top-0 z-10">
          <div className='flex flex-row gap-8 items-center'>
            <div className="relative">
              <input type="text" placeholder='Search anything' className='w-55 h-11 bg-hero-dark rounded-full pl-10'/>
              <FaSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'/>
            </div>
            <Link>EN/USD</Link>
            <button 
              onClick={toggleTheme} 
              className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl p-1 rounded-full transition-colors"
              aria-label="Toggle theme layout"
            >
              {isDarkMode ? <FiSun /> : <FiMoon />}
            </button>
            <button className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl relative"><FiBell /></button>
          </div>
        </div>

        {/* Ticker Bar */}
        <div className='bg-crypto-color h-35 rounded-2xl mt-7 mx-7 flex items-center px-10 flex-row gap-15'>
          
          {/* 4. Header & 5. Coin Dropdown */}
          <div className='flex flex-row gap-3 items-center shrink-0'>
            <select
              value={selectedCoin.symbol}
              onChange={(e) => {
                const coin = topCoins.find((c) => c.symbol === e.target.value);
                setSelectedCoin(coin);
              }}
              className="bg-transparent cursor-pointer text-xl outline-none"
            >
              {topCoins.map((coin) => (
                <option key={coin.symbol} value={coin.symbol} className="bg-gray-800 text-white">
                  {coin.pair}
                </option>
              ))}
            </select>
          </div>

          <div className='w-0.5 h-10 bg-line-color shrink-0'></div>

          {/* 9. Connect Header Data */}
          <div className='flex flex-col gap-2 shrink-0'>
            <p className='text-gray-500'>Last Prices</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{Number(marketData?.lastPrice).toFixed(2)}</p> 
            </div>
          </div>

          <div className='flex flex-col gap-2 shrink-0'>
            <p className='text-gray-500'>24h Change</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg text-green-500'>{Number(marketData?.priceChange).toFixed(2)}</p> 
              <div>
                <div className='w-18 h-7 bg-green-500 rounded-full flex items-center justify-center px-2'>
                  <p className='text-base text-white'>{Number(marketData?.priceChangePercent).toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className='shrink-0'>
            <p className='text-gray-500'>24h High</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{marketData?.highPrice}</p> 
            </div>
          </div>

          <div className='shrink-0'>
            <p className='text-gray-500'>24h Low</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{marketData?.lowPrice}</p> 
            </div>
          </div>

          <div className='shrink-0'>
            <p className='text-gray-500'>24h Volume</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{marketData?.volume}</p> 
            </div>
          </div>
        </div>

        {/* Main Grid: Left & Right */}
        <div className='flex flex-row justify-between px-7 pt-5 gap-6'>
          {/* left Section */}
          <div className='flex-1 max-w-[800px]'>
            <div className='flex flex-row gap-10'>
              <div className='flex justify-between w-full h-20 bg-crypto-color items-center px-8 rounded-t-2xl'>
                <div>
                  <p className='text-lg font-bold'>Trading market</p>
                </div>
                
                {/* 7. Timeframe Buttons */}
                <div className="flex gap-3">
                  {timeframes.map((tf) => (
                    <p
                      key={tf.value}
                      onClick={() => setTimeframe(tf.value)}
                      className={`cursor-pointer ${
                        timeframe === tf.value
                          ? "text-blue-500 font-bold"
                          : "text-gray-400 hover:text-blue-500"
                      }`}
                    >
                      {tf.label}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            
            {/* TradingView Widget Container */}
            <div className='w-full h-115 bg-crypto-color mt-1 rounded-b-2xl overflow-hidden relative'>
              <div 
                className="tradingview-widget-container w-full h-full" 
                ref={chartContainerRef} 
              />
            </div>

            <div className="w-full h-95 bg-hero-dark mt-5 rounded-2xl p-6 text-gray-200 font-sans shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-gray-800/40">
                <div className="flex items-center space-x-8 text-sm font-semibold">
                  <p className="cursor-pointer text-white pb-2 border-b-2 border-indigo-500 font-bold">
                    Order History
                  </p>
                  <p className="cursor-pointer text-gray-400 hover:text-gray-200 transition">
                    Open Orders
                  </p>
                  <p className="cursor-pointer text-gray-400 hover:text-gray-200 transition">
                    Closed Orders
                  </p>
                </div>

                <div className="relative">
                  <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search By Date"
                    className="w-50 h-10 bg-crypto-color text-xs text-gray-200 placeholder-gray-400 pl-9 pr-4 rounded-full outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 11. Order History */}
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs font-semibold">
                  <thead>
                    <tr className="text-gray-300 font-bold border-b border-transparent">
                      <th className="py-3 px-3 text-lg">Date</th>
                      <th className="py-3 px-3 text-lg">Pair</th>
                      <th className="py-3 px-3 text-lg">Buy/Sell</th>
                      <th className="py-3 px-3 text-lg">Price</th>
                      <th className="py-3 px-3 text-lg">Executed</th>
                      <th className="py-3 px-3 text-right text-lg">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-black/10 transition-colors">
                      <td className="py-3 px-3 text-gray-300 text-base">24-04 14:40</td>
                      <td className="py-3 px-3 text-gray-300 text-base">{selectedCoin.pair}</td>
                      <td className="py-3 px-3 text-emerald-400 text-base">BUY</td>
                      <td className="py-3 px-3 text-gray-300 text-base">$222</td>
                      <td className="py-3 px-3 flex justify-center">
                        <IoCheckmarkCircleOutline className="text-emerald-400 text-lg" />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-200 text-base">
                        0.4314 BTC
                      </td>
                    </tr>
                    <tr className="hover:bg-black/10 transition-colors">
                      <td className="py-3 px-3 text-gray-300 text-base">24-04 14:40</td>
                      <td className="py-3 px-3 text-gray-300 text-base">{selectedCoin.pair}</td>
                      <td className="py-3 px-3 text-rose-500 text-base">SELL</td>
                      <td className="py-3 px-3 text-gray-300 text-base">$222</td>
                      <td className="py-3 px-3 flex justify-center">
                        <IoCheckmarkCircleOutline className="text-emerald-400 text-lg" />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-200 text-base">
                        0.4314 BTC
                      </td>
                    </tr>
                    <tr className="hover:bg-black/10 transition-colors">
                      <td className="py-3 px-3 text-gray-300 text-base">24-04 14:40</td>
                      <td className="py-3 px-3 text-gray-300 text-base">{selectedCoin.pair}</td>
                      <td className="py-3 px-3 text-emerald-400 text-base">BUY</td>
                      <td className="py-3 px-3 text-gray-300 text-base">$222</td>
                      <td className="py-3 px-3 flex justify-center">
                        <IoCloseCircleOutline className="text-rose-500 text-lg" />
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-200 text-base">
                        0.4314 BTC
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className='w-91 flex flex-col gap-5 shrink-0'>
            {/* 10. Buy/Sell Panel */}
            <div className='w-full h-117 bg-crypto-color rounded-2xl flex flex-col gap-5 pt-7'>
              <div className='flex justify-center flex-row gap-27'>
                <p className='text-2xl cursor-pointer'>Buy</p>
                <p className='text-2xl cursor-pointer'>Sell</p>
              </div>

              <div>
                <hr className='ml-10 mr-48'/>
                <hr className='ml-48 mr-10'/>
              </div>

              <div className='flex flex-row gap-5 justify-center pt-2 text-gray-500'>
                <p className='text-sm cursor-pointer'>Limit</p>
                <p className='text-sm cursor-pointer'>Market</p>
                <p className='text-sm cursor-pointer'>Stop limit</p>
                <p className='text-sm cursor-pointer'>Stop market</p>
              </div>

              <div className='flex flex-col gap-5 pl-6'>
                <div className='w-75 h-20 bg-input-field rounded-2xl'>
                  <p className='pt-2 pl-2'>Pay</p>
                  <div className='flex justify-between pt-2 pl-2 pr-2 items-center'>
                    <p className='text-lg font-medium'>3,000,000</p>
                    <p>USD</p>
                  </div>
                </div>

                <div className='w-75 h-20 bg-input-field rounded-2xl'>
                  <p className='pt-2 pl-2'>Receive</p>
                  <div className='flex justify-between items-center pt-2 pl-2 pr-2'>
                    <p className='text-lg font-medium'>0.00207026</p>
                    <p>{selectedCoin.symbol.replace("USDT","")}</p>
                  </div>
                </div>

                <div className='flex justify-center gap-2'>
                  <p className='text-sm pt-1'>
                    1 {selectedCoin.symbol.replace("USDT","")} ≈ {Number(marketData?.lastPrice).toFixed(2)} USD
                  </p>
                  <div className='w-7 h-7 rounded-full bg-input-field flex items-center justify-center'>
                    <img src="src/assets/repeat.png" alt="exchange" className='w-5 h-5'/>
                  </div>
                </div>

                <button className='w-75 h-10 bg-blue-500 rounded-full text-white font-medium'>
                  Buy {selectedCoin.pair.split("/")[0]}
                </button>
              </div>
            </div>

            <div className='w-full h-112 bg-crypto-color rounded-2xl'>
              <div className='flex justify-center flex-col gap-2 pt-7 mt-7 px-10 items-center'>
                <p className='text-gray-500'>Your Balance</p>
                <p className='text-2xl font-medium'>$132,832.89</p>
              </div>

              <div className='flex flex-row gap-3 items-center w-75 h-10 border-white border-2 rounded-full justify-center mx-auto mt-5 hover:bg-blue-500 hover:border-blue-500 transition-colors cursor-pointer'>
                <FaPlus />
                <button>Top up balance</button>
              </div>

              <div className='flex justify-between px-6 pt-7 items-center'>
                <p>Your assets</p>
                <div className='relative flex items-center'>
                  <input type="text" className='w-35 h-8 bg-input-field rounded-2xl pl-8 text-sm'/>
                  <FaSearch className='absolute left-2.5 text-gray-400 text-xs'/>
                </div>
              </div>
            </div>
          </div>
        </div>

      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-7 py-7 text-xs font-sans text-gray-300 mt-auto">
        
          <div className="bg-[#0f1117] rounded-2xl p-5 shadow-lg border border-gray-800/40 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Order book</h2>

              <div className="grid grid-cols-3 text-gray-400 font-semibold mb-3 text-base">
                <span>Price(BTC)</span>
                <span className="text-center">Amount(ETH)</span>
                <span className="text-right border-b border-blue-500 pb-0.5 w-max justify-self-end text-blue-400">
                  Total(BTC)
                </span>
              </div>

              {/* Red Rows (Asks) */}
              <div className="space-y-2">
                {asks.map((item, idx) => (
                  <div key={idx} className="relative grid grid-cols-3 items-center text-sm">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-950/40 rounded-sm pointer-events-none"
                      style={{ width: `${item.depth}%` }}
                    />
                    <span className="text-red-500 font-semibold relative z-10">{item.price}</span>
                    <span className="text-center relative z-10">{item.amount}</span>
                    <span className="text-right relative z-10">{item.total}</span>
                  </div>
                ))}
              </div>

              {/* Price Banner */}
              <div className="my-5 py-3 border-y border-gray-800/60 flex items-center justify-between">
                <div>
                  <p className="text-base text-gray-500 uppercase">Last Price</p>
                  <p className="text-lg font-bold text-white">0.020367</p>
                </div>
                <div>
                  <p className="text-base text-gray-500 uppercase">USD</p>
                  <p className="text-lg font-semibold text-white">148.65</p>
                </div>
                <div>
                  <p className="text-base text-gray-500 uppercase">Change</p>
                  <p className="text-lg font-semibold text-red-500">-0.52%</p>
                </div>
              </div>

              {/* Green Rows (Bids) */}
              <div className="space-y-2">
                {bids.map((item, idx) => (
                  <div key={idx} className="relative grid grid-cols-3 items-center text-sm">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-950/40 rounded-sm pointer-events-none"
                      style={{ width: `${item.depth}%` }}
                    />
                    <span className="text-emerald-400 font-semibold relative z-10">{item.price}</span>
                    <span className="text-center relative z-10">{item.amount}</span>
                    <span className="text-right relative z-10">{item.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD 2: RECENT TRADES */}
          <div className="bg-[#0f1117] rounded-2xl p-5 shadow-lg border border-gray-800/40">
            <h2 className="text-lg font-bold text-white mb-4">Recent trades</h2>

            <div className="grid grid-cols-3 text-gray-400 font-semibold mb-3 text-base">
              <span>Time</span>
              <span className="text-center">Price(BTC)</span>
              <span className="text-right">Amount (ETH)</span>
            </div>

            <div className="space-y-2 overflow-hidden text-sm">
              {recentTrades.map((trade, idx) => (
                <div key={idx} className="grid grid-cols-3 items-center">
                  <span className="text-gray-400">{trade.time}</span>
                  <span
                    className={`text-center font-semibold ${
                      trade.type === "sell" ? "text-red-500" : "text-emerald-400"
                    }`}
                  >
                    {trade.price}
                  </span>
                  <span className="text-right">{trade.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 3: MARKET PAIRS (COINGECKO DATA) */}
          <div className="bg-[#0f1117] rounded-2xl p-5 shadow-lg border border-gray-800/40">
            <div className="flex items-center justify-between mb-4 ">
              <div className="flex items-center space-x-4">
                <FaRegStar className="text-gray-400 cursor-pointer hover:text-white" />
                {["BTC", "ETH", "USDT"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      activeTab === tab
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 text-gray-400 font-semibold mb-3 text-base">
              <span>Pair</span>
              <span className="text-center">Last price</span>
              <span className="text-right">Change</span>
            </div>

            <div className="space-y-2.5 overflow-hidden text-sm">
              {loading ? (
                <div className="text-center py-10 text-gray-500">Loading pairs...</div>
              ) : (
                marketPairs.map((item) => (
                  <div key={item.id} className="grid grid-cols-3 items-center">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => toggleStar(item.id)}>
                        {item.isStarred ? (
                          <FaStar className="text-amber-400 text-xs" />
                        ) : (
                          <FaRegStar className="text-gray-600 hover:text-gray-400 text-xs" />
                        )}
                      </button>
                      <span className="font-semibold text-white">{item.pair}</span>
                    </div>

                    <span className="text-center font-medium">{item.lastPrice}</span>

                    <span
                      className={`text-right font-semibold ${
                        item.change >= 0 ? "text-emerald-400" : "text-red-500"
                      }`}
                    >
                      {item.change >= 0 ? `+${item.change.toFixed(2)}%` : `${item.change.toFixed(2)}%`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

export default Dashboard