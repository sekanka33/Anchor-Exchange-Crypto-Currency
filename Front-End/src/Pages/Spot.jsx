import { useState, useEffect } from 'react';
import { FaSearch, FaStar } from 'react-icons/fa';
import { getCoinDetail } from '../api/coingecko';

const Spot = () => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("Market");

  // Fetch real-time Bitcoin data via the backend market data proxy — same
  // pattern as Exchange.jsx, this page is Spot's simpler sibling.
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const data = await getCoinDetail("bitcoin");
        setMarketData(data.market_data);
      } catch (error) {
        console.error("Error fetching market data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  const recentTrades = [
    { time: "14:04:54", price: "61,408.47", amount: "0.02000", type: "sell" },
    { time: "14:04:54", price: "61,408.47", amount: "0.35777", type: "sell" },
    { time: "14:04:54", price: "61,412.10", amount: "1.03408", type: "buy" },
    { time: "14:04:54", price: "61,408.47", amount: "0.02000", type: "sell" },
    { time: "14:04:54", price: "61,412.10", amount: "0.35777", type: "buy" },
    { time: "14:04:54", price: "61,408.47", amount: "1.03408", type: "sell" },
  ];

  return (
    <div className='text-slate-900 dark:text-white'>
      <h1 className="sr-only">Spot</h1>

      <div className='flex justify-between bg-white dark:bg-hero2-dark w-full min-h-25 px-4 md:pl-10 md:pr-10 pt-5 pb-3 md:pb-0'>
        <div className='flex flex-row gap-8 md:gap-15 overflow-x-auto [&>div]:flex-shrink-0'>
          <div className='flex flex-col gap-2'>
            <p className='font-bold'>BTC/USDT</p>
            <p className='pl-1 text-sm'>Bitcoin</p>
          </div>

          <div className='w-0 h-15 border-gray-200 dark:border-line-color border-r'></div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>Current Price</p>
            <p>{loading ? "…" : `$${marketData?.current_price?.usd?.toLocaleString() ?? "61,075.53"}`}</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Change</p>
            <p className={Number(marketData?.price_change_percentage_24h) < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
              {loading ? "…" : `${Number(marketData?.price_change_percentage_24h ?? 1.45).toFixed(2)}%`}
            </p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H High</p>
            <p>{loading ? "…" : `$${marketData?.high_24h?.usd?.toLocaleString() ?? "62,378.38"}`}</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Low</p>
            <p>{loading ? "…" : `$${marketData?.low_24h?.usd?.toLocaleString() ?? "59,378.38"}`}</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Volume(BTC)</p>
            <p>{loading ? "…" : (marketData?.total_volume?.btc ?? 273).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className='flex flex-col lg:flex-row justify-between gap-4 px-4 lg:px-0 lg:overflow-x-auto'>
        {/* LEFT SECTION: chart + recent trades */}
        <div className='w-full lg:w-auto'>
          <div className='bg-white dark:bg-hero2-dark w-full lg:w-230 h-10 mt-3 flex flex-row gap-8 md:gap-15 pt-2 pl-4 md:pl-10 overflow-x-auto'>
            <p>CHART</p>
            <div className='flex flex-row gap-4 text-gray-500 dark:text-slate-400'>
              <p>5M</p><p>30M</p><p>1H</p><p>4H</p><p>D</p><p>W</p><p>M</p>
            </div>
          </div>

          <div className='w-full lg:w-230 h-100 bg-white dark:bg-hero2-dark mt-1 border border-gray-200 dark:border-transparent'></div>

          <div className='w-full lg:w-230 mt-3 bg-white dark:bg-hero2-dark p-5 border border-gray-200 dark:border-transparent'>
            <h2 className='font-bold mb-3'>Recent trades</h2>
            <div className="grid grid-cols-3 text-gray-500 dark:text-slate-400 font-semibold mb-2 text-sm">
              <span>Time</span>
              <span className="text-center">Price(USDT)</span>
              <span className="text-right">Amount(BTC)</span>
            </div>
            <div className="space-y-1 text-sm">
              {recentTrades.map((trade, idx) => (
                <div key={idx} className="grid grid-cols-3 items-center">
                  <span className="text-gray-500 dark:text-slate-400">{trade.time}</span>
                  <span className={`text-center font-medium ${trade.type === "sell" ? "text-red-600 dark:text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {trade.price}
                  </span>
                  <span className="text-right">{trade.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: simple spot order form (no margin/leverage, unlike Exchange) */}
        <div className='w-full lg:w-auto'>
          <div className='bg-white dark:bg-hero2-dark w-full lg:w-98 mt-3 border border-gray-200 dark:border-transparent'>
            <div className='flex'>
              <button
                type="button"
                onClick={() => setSide("BUY")}
                className={`flex-1 h-12 font-semibold ${side === "BUY" ? "bg-green-600 text-white" : "bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white"}`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setSide("SELL")}
                className={`flex-1 h-12 font-semibold ${side === "SELL" ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white"}`}
              >
                SELL
              </button>
            </div>

            <div className='flex flex-row gap-5 px-4 pt-4 text-sm'>
              {["Limit", "Market", "Conditional"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={orderType === type ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white"}
                >
                  {type}
                </button>
              ))}
            </div>

            <hr className='mt-3 border-gray-200 dark:border-line-color' />

            <div className='px-4 py-4 space-y-3'>
              <div className='flex justify-between text-sm text-gray-500 dark:text-text-color'>
                <span>Available Balance</span>
                <span>0 USDT</span>
              </div>

              {orderType !== "Market" && (
                <div className='relative'>
                  <input
                    type="text"
                    aria-label="Order price"
                    placeholder='Order Price'
                    className='w-full h-10 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white pl-3 pr-14 rounded'
                  />
                  <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-text-color'>USD</span>
                </div>
              )}

              <div className='relative'>
                <input
                  type="text"
                  aria-label="Order quantity"
                  placeholder='Qty'
                  className='w-full h-10 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white pl-3 pr-14 rounded'
                />
                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-text-color'>BTC</span>
              </div>

              <button
                type="button"
                className={`w-full h-11 rounded font-semibold text-white ${side === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {side === "BUY" ? "Buy BTC" : "Sell BTC"}
              </button>

              <p className='text-xs text-gray-500 dark:text-text-color text-right'>
                Spot trading fees apply.
              </p>
            </div>
          </div>

          {/* PAIR LIST */}
          <div className="bg-white dark:bg-hero2-dark h-auto lg:h-100 w-full mt-3 flex flex-col gap-5 pl-3 pr-3 pt-5 pb-5 border border-gray-200 dark:border-transparent overflow-x-auto">
            <div className='relative'>
              <input type="text" aria-label="Search trading pairs" placeholder='Search' className='h-10 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white pl-10 pb-1 rounded' />
              <FaSearch className='absolute top-1/2 -translate-y-1/2 left-3 text-gray-400' />
            </div>

            <div className='flex flex-row gap-6 pl-2 overflow-x-auto [&>*]:flex-shrink-0'>
              <div className='flex flex-row gap-2 items-center'>
                <FaStar className='hover:text-yellow-300' />
                <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>Favorite</p>
              </div>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>BTC</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>USDT</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>ALTS</p>
            </div>

            <hr className='border-gray-200 dark:border-line-color' />

            <div className='flex gap-4 min-w-max text-gray-500 dark:text-text-color text-sm px-2'>
              <p>Pair</p>
              <p>Last Price</p>
              <p>24h %</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Spot;
