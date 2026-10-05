import { useState, useEffect, useRef } from 'react'
import { FaChevronDown, FaPlus, FaSearch, FaStar, FaRegStar } from 'react-icons/fa'
import { FiMoon, FiSun, FiBell } from "react-icons/fi";
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme';
import useNotificationSocket from '../hooks/useNotificationSocket';
import { API_BASE_URL } from '../api/config';
import { getBinanceTicker, getCoinsMarkets } from '../api/coingecko';
import { IoCheckmarkCircleOutline, IoCloseCircleOutline } from "react-icons/io5";

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
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    navigate("/signin");
  };

  const [unreadCount, setUnreadCount] = useState(0);
  const [walletSummary, setWalletSummary] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${API_BASE_URL}/api/notifications?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setWalletSummary(data))
      .catch(() => {});
  }, []);

  // Real-time notification badge — bumps the moment the backend creates a
  // notification (deposit cleared, withdrawal confirmed, order filled...)
  // instead of only reflecting what was true when the page last loaded.
  useNotificationSocket(() => setUnreadCount((c) => c + 1));

  // Order History / Open Orders / Closed Orders widget — real data from
  // Stage 6/7's orders table via Stage 12's filterable GET /api/orders.
  const [ordersTab, setOrdersTab] = useState("HISTORY");
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setOrdersLoading(true);

    const params = new URLSearchParams({ limit: "5" });
    if (ordersTab === "OPEN") params.set("status", "OPEN");
    if (ordersTab === "CLOSED") params.set("status", "COMPLETED");

    fetch(`${API_BASE_URL}/api/orders?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRecentOrders(data.orders || []))
      .catch(() => setRecentOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [ordersTab]);

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

  // 8. Fetch 24hr ticker via the backend market data proxy
  useEffect(() => {
    getBinanceTicker(selectedCoin.symbol)
      .then((data) => {
        setMarketData(data);
      })
      .catch((err) => console.error("Error fetching ticker data:", err));
  }, [selectedCoin]);

  // Fetch live market data (Top 15 coins) via the backend market data proxy
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const data = await getCoinsMarkets({ perPage: 15, page: 1, sparkline: false });

        const formatted = data.map((coin) => ({
          id: coin.id,
          pair: `${coin.symbol.toUpperCase()}/BTC`,
          lastPrice: coin.current_price > 1 
            ? (coin.current_price / 65000).toFixed(6) 
            : coin.current_price.toFixed(6),
          change: Number(coin.price_change_percentage_24h) || 0,
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
    <div className="flex flex-col md:flex-row min-h-screen">
      <h1 className="sr-only">Dashboard</h1>

      {/* Side NavBar */}
      <div className="w-full md:w-70 md:h-screen bg-white dark:bg-dark-void border-r border-gray-200 dark:border-transparent px-4 md:pl-8 py-4 md:pt-5 md:sticky md:top-0 flex-shrink-0">

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
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/home-icon.png" alt="" className="w-6 h-6" />
              <Link to="/" className="text-lg font-medium">Home</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/bitcoin-card-777.png" alt="" className="w-6 h-6" />
              <Link to="/buy-crypto" className="text-lg font-medium">Buy Crypto</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="" className="w-6 h-6" />
              <Link to="/markets" className="text-lg font-medium">Market</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="" className="w-6 h-6" />
              <Link to="/exchange" className="text-lg font-medium">Exchange</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="" className="w-6 h-6" />
              <Link to="/spot" className="text-lg font-medium">Spot</Link>
            </div>
          </div>

          <hr className="mr-15 border-dark-void" />

          <div className="flex flex-col gap-5">
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="" className="w-6 h-6" />
              <Link to="/wallet" className="text-lg font-medium">Asset</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="" className="w-6 h-6" />
              <Link to="/orderstrades" className="text-lg font-medium">Order & Trades</Link>
            </div>
            <div className="flex flex-row gap-5 items-center hover:bg-blue-600 hover:text-white hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="" className="w-6 h-6" />
              <Link to="/wallet" className="text-lg font-medium">Wallet</Link>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className='flex flex-row gap-5 items-center pt-35'>
          <img src="src/assets/log out icon.png" alt="log-out" />
          <p className='text-lg text-red-600 dark:text-red-400 font-medium'>Log out</p>
        </button>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar */}
        <div className="h-20 bg-white dark:bg-[#0d0e12] border-b border-gray-200 dark:border-dark-void flex items-center justify-end px-4 md:px-8 sticky top-0 z-30">
          <div className='flex flex-row gap-4 md:gap-8 items-center'>
            <div className="relative hidden sm:block">
              <input type="text" placeholder='Search anything' className='w-40 md:w-55 h-11 bg-slate-100 dark:bg-hero-dark text-slate-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-full pl-10'/>
              <FaSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'/>
            </div>
            <span className="hidden sm:inline">EN/USD</span>
            <button 
              onClick={toggleTheme} 
              className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl p-1 rounded-full transition-colors"
              aria-label="Toggle theme layout"
            >
              {isDarkMode ? <FiSun /> : <FiMoon />}
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl relative"
            >
              <FiBell />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] flex items-center justify-center bg-red-500 text-white rounded-full">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Ticker Bar */}
        <div className='bg-white dark:bg-crypto-color text-slate-900 dark:text-white h-35 rounded-2xl mt-7 mx-4 md:mx-7 flex items-center px-4 md:px-10 flex-row gap-8 md:gap-15 overflow-x-auto border border-gray-200 dark:border-transparent'>
          
          {/* 4. Header & 5. Coin Dropdown */}
          <div className='flex flex-row gap-3 items-center shrink-0'>
            <select
              value={selectedCoin.symbol}
              onChange={(e) => {
                const coin = topCoins.find((c) => c.symbol === e.target.value);
                setSelectedCoin(coin);
              }}
              aria-label="Select trading pair"
              className="bg-transparent cursor-pointer text-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
              {topCoins.map((coin) => (
                <option key={coin.symbol} value={coin.symbol} className="bg-gray-800 text-white">
                  {coin.pair}
                </option>
              ))}
            </select>
          </div>

          <div className='w-0.5 h-10 bg-gray-200 dark:bg-line-color shrink-0'></div>

          {/* 9. Connect Header Data */}
          <div className='flex flex-col gap-2 shrink-0'>
            <p className='text-gray-600 dark:text-gray-400'>Last Prices</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{Number(marketData?.lastPrice).toFixed(2)}</p>
            </div>
          </div>

          <div className='flex flex-col gap-2 shrink-0'>
            <p className='text-gray-600 dark:text-gray-400'>24h Change</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg text-green-700 dark:text-green-500'>{Number(marketData?.priceChange).toFixed(2)}</p>
              <div>
                <div className='w-18 h-7 bg-green-700 rounded-full flex items-center justify-center px-2'>
                  <p className='text-base text-white'>{Number(marketData?.priceChangePercent).toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className='shrink-0'>
            <p className='text-gray-600 dark:text-gray-400'>24h High</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{marketData?.highPrice}</p>
            </div>
          </div>

          <div className='shrink-0'>
            <p className='text-gray-600 dark:text-gray-400'>24h Low</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{marketData?.lowPrice}</p>
            </div>
          </div>

          <div className='shrink-0'>
            <p className='text-gray-600 dark:text-gray-400'>24h Volume</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>{marketData?.volume}</p>
            </div>
          </div>
        </div>

        {/* Main Grid: Left & Right */}
        <div className='flex flex-col lg:flex-row justify-between px-4 md:px-7 pt-5 gap-6'>
          {/* left Section */}
          <div className='flex-1 min-w-0 lg:max-w-[800px]'>
            <div className='flex flex-row gap-10'>
              <div className='flex justify-between w-full h-20 bg-white dark:bg-crypto-color text-slate-900 dark:text-white items-center px-8 rounded-t-2xl border border-b-0 border-gray-200 dark:border-transparent'>
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
                          : "text-gray-600 dark:text-gray-400 hover:text-blue-500"
                      }`}
                    >
                      {tf.label}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* TradingView Widget Container */}
            <div className='w-full h-115 bg-white dark:bg-crypto-color text-slate-900 dark:text-white mt-1 rounded-b-2xl overflow-hidden relative border border-t-0 border-gray-200 dark:border-transparent'>
              <div 
                className="tradingview-widget-container w-full h-full" 
                ref={chartContainerRef} 
              />
            </div>

            <div className="w-full h-95 bg-white dark:bg-hero-dark mt-5 rounded-2xl p-6 text-slate-700 dark:text-gray-200 font-sans shadow-xl border border-gray-200 dark:border-transparent">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800/40">
                <div className="flex items-center space-x-8 text-sm font-semibold">
                  <button type="button"
                    aria-pressed={ordersTab === "HISTORY"}
                    onClick={() => setOrdersTab("HISTORY")}
                    className={`cursor-pointer pb-2 transition ${
                      ordersTab === "HISTORY"
                        ? "text-slate-900 dark:text-white border-b-2 border-indigo-500 font-bold"
                        : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
                    }`}
                  >
                    Order History
                  </button>
                  <button type="button"
                    aria-pressed={ordersTab === "OPEN"}
                    onClick={() => setOrdersTab("OPEN")}
                    className={`cursor-pointer pb-2 transition ${
                      ordersTab === "OPEN"
                        ? "text-slate-900 dark:text-white border-b-2 border-indigo-500 font-bold"
                        : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
                    }`}
                  >
                    Open Orders
                  </button>
                  <button type="button"
                    aria-pressed={ordersTab === "CLOSED"}
                    onClick={() => setOrdersTab("CLOSED")}
                    className={`cursor-pointer pb-2 transition ${
                      ordersTab === "CLOSED"
                        ? "text-slate-900 dark:text-white border-b-2 border-indigo-500 font-bold"
                        : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
                    }`}
                  >
                    Closed Orders
                  </button>
                </div>

                <Link
                  to="/orderstrades"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  View all
                </Link>
              </div>

              {/* 11. Order History */}
              <div className="overflow-x-auto mt-2">
                {ordersLoading && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm py-6">Loading orders...</p>
                )}

                {!ordersLoading && recentOrders.length === 0 && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm py-6">
                    {ordersTab === "OPEN"
                      ? "No open orders — orders fill instantly on Anchor Exchange, so none stay open."
                      : "No orders yet."}
                  </p>
                )}

                {!ordersLoading && recentOrders.length > 0 && (
                  <table className="w-full text-left text-xs font-semibold">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-300 font-bold border-b border-transparent">
                        <th className="py-3 px-3 text-lg">Date</th>
                        <th className="py-3 px-3 text-lg">Pair</th>
                        <th className="py-3 px-3 text-lg">Buy/Sell</th>
                        <th className="py-3 px-3 text-lg">Price</th>
                        <th className="py-3 px-3 text-lg">Executed</th>
                        <th className="py-3 px-3 text-right text-lg">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-100 dark:hover:bg-black/10 transition-colors">
                          <td className="py-3 px-3 text-gray-600 dark:text-gray-300 text-base whitespace-nowrap">
                            {new Date(order.created_at).toLocaleString(undefined, {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-3 text-gray-600 dark:text-gray-300 text-base">{order.pair}</td>
                          <td className={`py-3 px-3 text-base ${order.side === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-500"}`}>
                            {order.side}
                          </td>
                          <td className="py-3 px-3 text-gray-600 dark:text-gray-300 text-base">${Number(order.price).toFixed(2)}</td>
                          <td className="py-3 px-3 flex justify-center">
                            {order.status === "COMPLETED" && (
                              <IoCheckmarkCircleOutline className="text-emerald-600 dark:text-emerald-400 text-lg" />
                            )}
                            {order.status === "CANCELLED" && (
                              <IoCloseCircleOutline className="text-rose-600 dark:text-rose-500 text-lg" />
                            )}
                            {order.status === "OPEN" && (
                              <span className="text-amber-600 dark:text-amber-400 text-xs">Open</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-700 dark:text-gray-200 text-base">
                            {Number(order.amount).toFixed(4)} {order.pair.split("/")[0]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className='w-full lg:w-91 flex flex-col gap-5 lg:shrink-0'>
            {/* 10. Buy/Sell Panel */}
            <div className='w-full h-117 bg-white dark:bg-crypto-color text-slate-900 dark:text-white rounded-2xl flex flex-col gap-5 pt-7 border border-gray-200 dark:border-transparent'>
              <div className='flex justify-center flex-row gap-27'>
                <p className='text-2xl cursor-pointer'>Buy</p>
                <p className='text-2xl cursor-pointer'>Sell</p>
              </div>

              <div>
                <hr className='ml-10 mr-48 border-gray-200 dark:border-gray-700'/>
                <hr className='ml-48 mr-10 border-gray-200 dark:border-gray-700'/>
              </div>

              <div className='flex flex-row gap-5 justify-center pt-2 text-gray-600 dark:text-gray-400'>
                <p className='text-sm cursor-pointer'>Limit</p>
                <p className='text-sm cursor-pointer'>Market</p>
                <p className='text-sm cursor-pointer'>Stop limit</p>
                <p className='text-sm cursor-pointer'>Stop market</p>
              </div>

              <div className='flex flex-col gap-5 pl-6'>
                <div className='w-75 h-20 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl'>
                  <p className='pt-2 pl-2'>Pay</p>
                  <div className='flex justify-between pt-2 pl-2 pr-2 items-center'>
                    <p className='text-lg font-medium'>3,000,000</p>
                    <p>USD</p>
                  </div>
                </div>

                <div className='w-75 h-20 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-2xl'>
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
                  <div className='w-7 h-7 rounded-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white flex items-center justify-center'>
                    <img src="src/assets/repeat.png" alt="" className='w-5 h-5'/>
                  </div>
                </div>

                <button className='w-75 h-10 bg-blue-600 rounded-full text-white font-medium'>
                  Buy {selectedCoin.pair.split("/")[0]}
                </button>
              </div>
            </div>

            <div className='w-full h-112 bg-white dark:bg-crypto-color text-slate-900 dark:text-white rounded-2xl border border-gray-200 dark:border-transparent'>
              <div className='flex justify-center flex-col gap-2 pt-7 mt-7 px-10 items-center'>
                <p className='text-gray-600 dark:text-gray-400'>Your Balance</p>
                <p className='text-2xl font-medium'>
                  {walletSummary
                    ? walletSummary.portfolioValue.toLocaleString(undefined, { style: "currency", currency: "USD" })
                    : "$0.00"}
                </p>
              </div>

              <Link to="/wallet" className='flex flex-row gap-3 items-center w-75 h-10 border-slate-900 dark:border-white border-2 rounded-full justify-center mx-auto mt-5 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-colors cursor-pointer'>
                <FaPlus />
                <span>Top up balance</span>
              </Link>

              <div className='flex justify-between px-6 pt-7 items-center'>
                <p>Your assets</p>
                <Link to="/wallet" className='text-sm text-blue-600 dark:text-blue-400 hover:underline'>View all</Link>
              </div>

              <div className='px-6 pt-3 flex flex-col gap-2'>
                {!walletSummary && <p className='text-sm text-gray-600 dark:text-gray-400'>Loading...</p>}
                {walletSummary && walletSummary.balances.every((b) => b.totalBalance === 0) && (
                  <p className='text-sm text-gray-600 dark:text-gray-400'>No assets yet.</p>
                )}
                {walletSummary &&
                  walletSummary.balances
                    .filter((b) => b.totalBalance > 0)
                    .slice(0, 3)
                    .map((b) => (
                      <div key={b.assetSymbol} className='flex justify-between text-sm'>
                        <span>{b.assetSymbol}</span>
                        <span>{b.usdValue.toLocaleString(undefined, { style: "currency", currency: "USD" })}</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        </div>

      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-7 py-7 text-xs font-sans text-gray-600 dark:text-gray-300 mt-auto">

          <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-800/40 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Order book</h2>

              <div className="grid grid-cols-3 text-gray-600 dark:text-gray-400 font-semibold mb-3 text-base">
                <span>Price(BTC)</span>
                <span className="text-center">Amount(ETH)</span>
                <span className="text-right border-b border-blue-500 pb-0.5 w-max justify-self-end text-blue-600 dark:text-blue-400">
                  Total(BTC)
                </span>
              </div>

              {/* Red Rows (Asks) */}
              <div className="space-y-2">
                {asks.map((item, idx) => (
                  <div key={idx} className="relative grid grid-cols-3 items-center text-sm">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-100 dark:bg-red-950/40 rounded-sm pointer-events-none"
                      style={{ width: `${item.depth}%` }}
                    />
                    <span className="text-red-600 dark:text-red-500 font-semibold relative z-10">{item.price}</span>
                    <span className="text-center relative z-10">{item.amount}</span>
                    <span className="text-right relative z-10">{item.total}</span>
                  </div>
                ))}
              </div>

              {/* Price Banner */}
              <div className="my-5 py-3 border-y border-gray-200 dark:border-gray-800/60 flex items-center justify-between">
                <div>
                  <p className="text-base text-gray-600 dark:text-gray-400 uppercase">Last Price</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">0.020367</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 dark:text-gray-400 uppercase">USD</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">148.65</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 dark:text-gray-400 uppercase">Change</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-500">-0.52%</p>
                </div>
              </div>

              {/* Green Rows (Bids) */}
              <div className="space-y-2">
                {bids.map((item, idx) => (
                  <div key={idx} className="relative grid grid-cols-3 items-center text-sm">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-100 dark:bg-emerald-950/40 rounded-sm pointer-events-none"
                      style={{ width: `${item.depth}%` }}
                    />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold relative z-10">{item.price}</span>
                    <span className="text-center relative z-10">{item.amount}</span>
                    <span className="text-right relative z-10">{item.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD 2: RECENT TRADES */}
          <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-800/40">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent trades</h2>

            <div className="grid grid-cols-3 text-gray-600 dark:text-gray-400 font-semibold mb-3 text-base">
              <span>Time</span>
              <span className="text-center">Price(BTC)</span>
              <span className="text-right">Amount (ETH)</span>
            </div>

            <div className="space-y-2 overflow-hidden text-sm">
              {recentTrades.map((trade, idx) => (
                <div key={idx} className="grid grid-cols-3 items-center">
                  <span className="text-gray-600 dark:text-gray-400">{trade.time}</span>
                  <span
                    className={`text-center font-semibold ${
                      trade.type === "sell" ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-400"
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
          <div className="bg-white dark:bg-[#0f1117] rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-800/40">
            <div className="flex items-center justify-between mb-4 ">
              <div className="flex items-center space-x-4">
                <FaRegStar className="text-gray-600 dark:text-gray-400 cursor-pointer hover:text-slate-900 dark:hover:text-white" />
                {["BTC", "ETH", "USDT"].map((tab) => (
                  <button
                    key={tab}
                    aria-pressed={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      activeTab === tab
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 text-gray-600 dark:text-gray-400 font-semibold mb-3 text-base">
              <span>Pair</span>
              <span className="text-center">Last price</span>
              <span className="text-right">Change</span>
            </div>

            <div className="space-y-2.5 overflow-hidden text-sm">
              {loading ? (
                <div className="text-center py-10 text-gray-600 dark:text-gray-400">Loading pairs...</div>
              ) : (
                marketPairs.map((item) => (
                  <div key={item.id} className="grid grid-cols-3 items-center">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleStar(item.id)}
                        aria-label={item.isStarred ? `Remove ${item.pair} from favorites` : `Add ${item.pair} to favorites`}
                        aria-pressed={item.isStarred}
                      >
                        {item.isStarred ? (
                          <FaStar className="text-amber-400 text-xs" />
                        ) : (
                          <FaRegStar className="text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 text-xs" />
                        )}
                      </button>
                      <span className="font-semibold text-slate-900 dark:text-white">{item.pair}</span>
                    </div>

                    <span className="text-center font-medium">{item.lastPrice}</span>

                    <span
                      className={`text-right font-semibold ${
                        item.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500"
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