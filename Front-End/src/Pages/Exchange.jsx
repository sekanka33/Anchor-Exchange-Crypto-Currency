import { useState, useEffect } from 'react';
import { FaCalculator, FaGem, FaPhone, FaSearch, FaStar } from 'react-icons/fa';
import { FiMoon, FiSun } from "react-icons/fi";
import { BsDiamond } from 'react-icons/bs';
import { getCoinDetail } from '../api/coingecko';


const Exchange = () => {

  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch real-time Bitcoin data via the backend market data proxy
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const data = await getCoinDetail("bitcoin");
        setMarketData(data.market_data);
        setError("");
      } catch (error) {
        console.error("Error fetching market data:", error);
        setError("Unable to load live market data right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000); // 30-second refresh
    return () => clearInterval(interval);
  }, []);

  // Order book rows mock data
  const greenAsks = [
    { amount: "0.001", depth: 15, price: "71,728,000", change: "+1.81 %" },
    { amount: "0.138", depth: 65, price: "71,727,000", change: "+1.81 %" },
    { amount: "0.001", depth: 25, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 35, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 20, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 15, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 50, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 30, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 10, price: "71,726,000", change: "+1.81 %" },
  ];

  const redBids = [
    { amount: "0.001", depth: 5, price: "71,728,000", change: "-1.81 %" },
    { amount: "1.481", depth: 40, price: "71,727,000", change: "-1.81 %" },
    { amount: "0.601", depth: 20, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.001", depth: 10, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.501", depth: 55, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.401", depth: 30, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.001", depth: 80, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.021", depth: 70, price: "71,726,000", change: "-1.81 %" },
  ];

  const bidsLeft = [
    { bidder: "71,726,000", amount: "0.003", isGreen: true },
    { bidder: "71,726,000", amount: "0.003", isGreen: true },
    { bidder: "71,726,000", amount: "0.003", isGreen: true },
    { bidder: "71,726,000", amount: "0.003", isGreen: true },
    { bidder: "71,726,000", amount: "0.033", isGreen: true },
    { bidder: "71,726,000", amount: "0.003", isGreen: false },
    { bidder: "71,726,000", amount: "0.003", isGreen: false },
    { bidder: "71,726,000", amount: "0.003", isGreen: false },
  ];

  return (
    <div className='text-slate-900 dark:text-white'>
      <h1 className="sr-only">Exchange</h1>
      <div className='flex justify-between bg-white dark:bg-hero2-dark w-full min-h-25 px-4 md:pl-10 md:pr-10 pt-5 pb-3 md:pb-0'>
        <div className='flex flex-row gap-8 md:gap-15 overflow-x-auto [&>div]:flex-shrink-0'>
          <div className='flex flex-col gap-2'>
            <div className='flex flex-row gap-3 items-center '>
              {/* Placeholder for the coin icon (an empty-src <img> made browsers re-request the page) */}
              <span aria-hidden="true" className='w-4 h-4 rounded-full'></span>
              <p className='font-bold'>BTC/USD</p>
            </div>
            <p className='pl-9 text-sm'>Bitcoin</p>
          </div>

          <div className='w-0 h-15 border-gray-200 dark:border-line-color border-r'></div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>Current Price</p>
            <p>61,075.53 USD</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Change</p>
            <p className='text-green-700 dark:text-green-600'>+1.45%</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H High</p>
            <p>62,378.38

            </p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Low</p>
            <p>59,378.38</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Turnover(USDT)</p>
            <p>16,730,064.72</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-gray-500 dark:text-text-color'>24H Volume(BTC)</p>
            <p>273.37</p>
          </div>
        </div>

      </div>
      <div className='flex flex-col lg:flex-row justify-between gap-4 px-4 lg:px-0 lg:overflow-x-auto'>
        {/* LEFT SECTION */}
        <div className='w-full lg:w-auto'>
          <div className='bg-white dark:bg-hero2-dark w-full lg:w-230 h-10 mt-3 flex flex-row gap-8 md:gap-15 pt-2 pl-4 md:pl-10 overflow-x-auto'>
            <div>
              <p>CHART</p>
            </div>

            <div className='flex flex-row gap-4'>
              <p>5M</p>
              <p>30M</p>
              <p>1H</p>
              <p>4H</p>
              <p>D</p>
              <p>W</p>
              <p>M</p>
            </div>
          </div>

          {/* This div is where im going to display the chart */}
          <div className='w-full lg:w-230 h-100 bg-white dark:bg-hero2-dark mt-1'></div>

          <div className='flex flex-col md:flex-row justify-between gap-3 pt-3'>
            <div className="w-full md:w-130 h-auto md:h-150 max-w-4xl bg-white dark:bg-hero2-dark shadow-2xl overflow-hidden">
                
                {/* Navigation Tabs */}
                <div className="grid grid-cols-3 text-center text-xs font-semibold tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                  <div className="py-3 cursor-pointer text-blue-400 border-b-2 border-blue-500 uppercase">
                    General Quote
                  </div>
                  <div className="py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white uppercase">
                    Cumulative Quote
                  </div>
                  <div className="py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white uppercase">
                    Quote Order
                  </div>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-slate-800/80">
                  
                  {/* Order Book Visualizations (Columns 1 & 2) */}
                  <div className="col-span-2 grid grid-cols-2">
                    
                    {/* Upper Asks (Green) */}
                    <div className="col-span-2 grid grid-cols-2 border-b border-gray-200 dark:border-slate-800/60">
                      <div className="flex flex-col justify-end py-2 pr-2 border-r border-gray-200 dark:border-slate-800/60">
                        {greenAsks.map((row, idx) => (
                          <div key={idx} className="relative flex justify-end items-center h-7 text-xs font-mono">
                            <div
                              className="absolute right-0 top-1 bottom-1 bg-emerald-900/40 rounded-sm"
                              style={{ width: `${row.depth}%` }}
                            />
                            <span className="relative z-10 px-2 text-slate-700 dark:text-slate-200">{row.amount}</span>
                          </div>
                        ))}
                      </div>

                      <div className="bg-emerald-950/20 py-2 px-3 flex flex-col justify-end">
                        {greenAsks.map((row, idx) => (
                          <div key={idx} className="flex justify-between items-center h-7 text-xs font-mono">
                            <span className="text-emerald-400 font-medium">{row.price}</span>
                            <span className="text-emerald-400">{row.change}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fastening Metric */}
                    <div className="col-span-2 flex justify-between items-center px-4 py-2 border-b border-gray-200 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400">
                      <span>Fastening</span>
                      <span className="font-mono text-emerald-400">+93.03%</span>
                    </div>

                    {/* Lower Bids Left */}
                    <div className="border-r border-gray-200 dark:border-slate-800/60 py-2">
                      <div className="flex justify-between text-[11px] text-gray-500 dark:text-slate-400 px-3 pb-2 font-medium">
                        <span>Bidder</span>
                        <span>Contract Amount</span>
                      </div>
                      {bidsLeft.map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center px-3 h-7 text-xs font-mono">
                          <span className="text-gray-500 dark:text-slate-400">{row.bidder}</span>
                          <span className={row.isGreen ? "text-emerald-400" : "text-rose-500"}>
                            {row.amount}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Lower Bids Right (Red) */}
                    <div className="bg-rose-950/20 py-2 px-3">
                      {redBids.map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center h-7 text-xs font-mono">
                          <span className="text-rose-500 font-medium">{row.price}</span>
                          <span className="text-rose-500">{row.change}</span>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Live Market Stats (Column 3) */}
                  <div className="col-span-1 p-4 flex flex-col justify-between text-xs space-y-3 bg-white dark:bg-hero2-dark">
                    {error && <p role="alert" className="text-red-500 text-xs">{error}</p>}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">Trading</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {loading ? "..." : `${(marketData?.total_volume?.btc / 1000 || 7.841).toFixed(3)} BTC`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">Volume Transaction Amount</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {loading
                            ? "..."
                            : marketData?.total_volume?.usd
                            ? Math.round(marketData.total_volume.usd / 100000).toLocaleString()
                            : "564,464"}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-slate-400 text-right -mt-2">(Last 24 hours)</div>

                      <div className="pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400">52 weeks Hight</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {loading ? "..." : `$${marketData?.ath?.usd?.toLocaleString() || "82.7 million"}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 text-right mt-0.5">
                          ( {marketData?.ath_date?.usd ? new Date(marketData.ath_date.usd).toISOString().split('T')[0] : "2021.11.09"} )
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400">52 weeks Low</span>
                          <span className="font-mono font-bold text-rose-500">
                            {loading ? "..." : `$${marketData?.atl?.usd?.toLocaleString() || "18,500,000"}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-slate-400 text-right mt-0.5">
                          ( {marketData?.atl_date?.usd ? new Date(marketData.atl_date.usd).toISOString().split('T')[0] : "2020.11.27"} )
                        </div>
                      </div>

                      <div className="pt-2 space-y-2 border-t border-gray-200 dark:border-slate-800/80">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400">Previous</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">
                            {marketData?.high_24h?.usd ? `$${marketData.high_24h.usd.toLocaleString()}` : "70,047,000"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400">Day's Closing</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">same-day</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400">Price</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">price</span>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-gray-500 dark:text-slate-400">Price</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {loading ? "..." : `$${marketData?.current_price?.usd?.toLocaleString() || "71,287,000"}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Depth Overlay Section */}
                    <div className="pt-2 border-t border-gray-200 dark:border-slate-800 space-y-1">
                      {redBids.slice(0, 7).map((row, idx) => (
                        <div key={idx} className="relative flex items-center h-6 font-mono text-xs">
                          <div
                            className="absolute left-0 top-0.5 bottom-0.5 bg-rose-900/30 rounded-sm"
                            style={{ width: `${row.depth}%` }}
                          />
                          <span className="relative z-10 px-2 text-gray-600 dark:text-slate-300">{row.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Footer Bar */}
                <div className="grid grid-cols-3 items-center px-6 py-3 bg-white dark:bg-hero2-dark border-t border-gray-200 dark:border-slate-800 text-xs font-mono font-bold">
                  <div className="text-left text-slate-700 dark:text-slate-200">2.147</div>
                  <div className="text-center text-gray-500 dark:text-slate-400 flex items-center justify-center gap-1 font-sans text-xs">
                    Quantity <span className="text-[10px] text-gray-500 dark:text-slate-400">(BTC)</span> ⇄
                  </div>
                  <div className="text-right text-slate-700 dark:text-slate-200">2.227</div>
                </div>

              </div>
               <div className='flex flex-col gap-1 w-full md:w-98'>
                <div className='bg-white dark:bg-hero2-dark h-10 w-full flex justify-between items-center pr-4'>
                  <div className='flex flex-row gap-3 pt-1 pl-4'>
                    <div className='bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white h-7 w-15 flex justify-center items-center'>
                      <p className='text-sm hover:text-blue-500'>Cross</p>
                    </div>

                    <div className='bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white h-7 w-15 flex justify-center items-center'>
                      <p className='text-sm hover:text-blue-500'>10.00x</p>
                    </div>
                  </div>

                  <div>
                    <FaCalculator className='hover:text-blue-500'/>
                  </div>
                </div>

                <div className='bg-white dark:bg-hero2-dark h-auto md:h-85 w-full pb-5 pt-3'>
                  <div className='flex flex-row gap-5 pl-4'>
                    <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>Limit</p>
                    <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>Market</p>
                    <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>Conditional</p>
                  </div>

                  <hr className='mt-2 text-gray-200 dark:text-line-color'/>

                  <div className='px-4'>
                    <input type="text" aria-label="Order quantity" placeholder='Qty' className='w-full h-10 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white mt-4 pl-2'/>
                    <p className='text-sm relative bottom-7 flex justify-end right-2'>USD</p>
                  </div>

                  <div className="flex justify-center w-full pt-3 pl-6 pr-6">
                    <div className="relative flex justify-between items-center w-full">
                      {/* Horizontal Line */}
                      <div className="absolute top-1/2 left-0 right-0 h-1px bg-[#2d3139] -translate-y-1/2 z-0" />

                      {/* Step 1 */}
                      <div className="relative z-10 px-1 text-[#6b7280] text-xs">
                        <BsDiamond />
                      </div>

                      {/* Step 2 */}
                      <div className="relative z-10  px-1 text-[#6b7280] text-xs">
                        <BsDiamond />
                      </div>

                      {/* Step 3 (Active / Center) */}
                      <div className="relative z-10 px-1 text-[#6b7280] text-xs">
                        <BsDiamond />
                      </div>

                      {/* Step 4 */}
                      <div className="relative z-10 px-1 text-[#6b7280] text-xs">
                        <BsDiamond />
                      </div>

                      {/* Step 5 */}
                      <div className="relative z-10 px-1 text-[#6b7280] text-xs">
                        <BsDiamond />
                      </div>
                    </div>
                  </div>

                  <div className='flex flex-wrap gap-4 justify-between pr-6 pl-6 pt-6'>
                    <div>
                      <label className='flex flex-row gap-3 items-center cursor-pointer'>
                        <input type="checkbox" />
                        <span className='text-gray-500 dark:text-text-color'>Buy Long with TP/SL</span>
                      </label>

                      <label className='flex flex-row gap-3 items-center pt-2 cursor-pointer'>
                        <input type="checkbox" />
                        <span className='text-gray-500 dark:text-text-color'>Sell Short with TP/SL</span>
                      </label>
                    </div>

                    <div className='flex flex-col gap-3 text-base'>
                      <p>Order Value</p>
                      <p>0.00000000 BTC</p>
                    </div>
                  </div>

                  <div className='flex flex-row gap-6 pl-6 pr-6 pt-7'>
                    <button className='h-10 w-full max-w-40 bg-green-700 text-white rounded-sm'>Buy / Long</button>
                    <button className='h-10 w-full max-w-40 bg-red-600 text-white rounded-sm'>Sell / Short</button>
                  </div>
                </div>
              </div>
          </div>
        </div>



        {/* RIGHT SECTION */}
        <div className='w-full lg:w-auto'>
          <div className='bg-white dark:bg-hero2-dark h-auto lg:h-210 w-full lg:w-148 mt-3 flex flex-col gap-5 pl-3 pr-3 pt-5 pb-5 overflow-x-auto'>
            <div className='relative'>
              <input type="text" aria-label="Search trading pairs" placeholder='Search' className='h-10 w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white text-gray-500 dark:text-text-color pl-10 pb-1'/>
              <FaSearch className='absolute top-1/2 -translate-y-1/2 left-3' />
            </div>

            <div className='flex flex-row gap-6 md:gap-10 pl-2 md:pl-6 pr-2 md:pr-10 pt-2 overflow-x-auto [&>*]:flex-shrink-0'>
              <div className='flex flex-row gap-2 items-center'>
                <FaStar className='hover:text-yellow-300' />
                <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>Favorite</p>
              </div>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>BUSD</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>USDT</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>BNB</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>BTC</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>ALTS</p>
              <p className='text-gray-500 dark:text-text-color hover:text-slate-900 dark:hover:text-white'>FIAT</p>
            </div>

            <hr className='text-gray-200 dark:text-line-color mt-4' />

            <div className='flex gap-4 min-w-max text-gray-500 dark:text-text-color text-sm pt-3 pl-2 md:pl-10 pr-2 md:pr-10'>
              <p>Pair</p>
              <p>Current Price</p>
              <p>Day to day</p>
              <p>Transaction amount</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Exchange
