import React, { useState, useEffect } from 'react';
import { FaCalculator, FaGem, FaPhone, FaSearch, FaStar } from 'react-icons/fa';
import { FiMoon, FiSun } from "react-icons/fi";
import { BsDiamond } from 'react-icons/bs';


const Exchange = () => {

  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch real-time Bitcoin data from CoinGecko API
  useEffect(() => {
    const fetchCoinGeckoData = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false"
        );
        const data = await response.json();
        setMarketData(data.market_data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching CoinGecko data:", error);
        setLoading(false);
      }
    };

    fetchCoinGeckoData();
    const interval = setInterval(fetchCoinGeckoData, 30000); // 30-second refresh
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
    <div>
      <div className='flex justify-between bg-hero2-dark w-full h-25 pl-10 pr-10 pt-5'>
        <div className='flex flex-row gap-15'>
          <div className='flex flex-col gap-2'>
            <div className='flex flex-row gap-3 items-center '>


              {/* This is where im going to add coins image */}
              <img src="" alt=""  className='w-4 h-4 rounded-full'/>
              <p className='font-bold'>BTC/USD</p>
            </div>
            <p className='pl-9 text-sm'>Bitcoin</p>
          </div>

          <div className='w-0 h-15 border-line-color border-r'></div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-text-color'>Current Price</p>
            <p>61,075.53 USD</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-text-color'>24H Change</p>
            <p className='text-green-600'>+1.45%</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-text-color'>24H High</p>
            <p>62,378.38

            </p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-text-color'>24H Low</p>
            <p>59,378.38</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-text-color'>24H Turnover(USDT)</p>
            <p>16,730,064.72</p>
          </div>

          <div className='flex flex-col gap-1'>
            <p className='text-sm text-text-color'>24H Volume(BTC)</p>
            <p>273.37</p>
          </div>
        </div>

      </div>
      <div className='flex justify-between'>
        {/* LEFT SECTION */}
        <div>
          <div className='bg-hero2-dark w-230 h-10 mt-3 flex flex-row gap-15 pt-2 pl-10'>
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
          <div className='w-230 h-100 bg-hero2-dark mt-1'></div>

          <div className='flex justify-between pt-3'>
            <div className="w-130 h-150 max-w-4xl bg-hero2-dark  shadow-2xl overflow-hidden">
                
                {/* Navigation Tabs */}
                <div className="grid grid-cols-3 text-center text-xs font-semibold tracking-wider text-slate-400 border-b border-slate-800">
                  <div className="py-3 cursor-pointer text-blue-400 border-b-2 border-blue-500 uppercase">
                    General Quote
                  </div>
                  <div className="py-3 cursor-pointer hover:text-white uppercase">
                    Cumulative Quote
                  </div>
                  <div className="py-3 cursor-pointer hover:text-white uppercase">
                    Quote Order
                  </div>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
                  
                  {/* Order Book Visualizations (Columns 1 & 2) */}
                  <div className="col-span-2 grid grid-cols-2">
                    
                    {/* Upper Asks (Green) */}
                    <div className="col-span-2 grid grid-cols-2 border-b border-slate-800/60">
                      <div className="flex flex-col justify-end py-2 pr-2 border-r border-slate-800/60">
                        {greenAsks.map((row, idx) => (
                          <div key={idx} className="relative flex justify-end items-center h-7 text-xs font-mono">
                            <div
                              className="absolute right-0 top-1 bottom-1 bg-emerald-900/40 rounded-sm"
                              style={{ width: `${row.depth}%` }}
                            />
                            <span className="relative z-10 px-2 text-slate-200">{row.amount}</span>
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
                    <div className="col-span-2 flex justify-between items-center px-4 py-2 border-b border-slate-800 text-xs text-slate-400">
                      <span>Fastening</span>
                      <span className="font-mono text-emerald-400">+93.03%</span>
                    </div>

                    {/* Lower Bids Left */}
                    <div className="border-r border-slate-800/60 py-2">
                      <div className="flex justify-between text-[11px] text-slate-400 px-3 pb-2 font-medium">
                        <span>Bidder</span>
                        <span>Contract Amount</span>
                      </div>
                      {bidsLeft.map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center px-3 h-7 text-xs font-mono">
                          <span className="text-slate-400">{row.bidder}</span>
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

                  {/* Live CoinGecko API Market Stats (Column 3) */}
                  <div className="col-span-1 p-4 flex flex-col justify-between text-xs space-y-3 bg-hero2-dark">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Trading</span>
                        <span className="font-mono font-bold text-white">
                          {loading ? "..." : `${(marketData?.total_volume?.btc / 1000 || 7.841).toFixed(3)} BTC`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Volume Transaction Amount</span>
                        <span className="font-mono font-bold text-white">
                          {loading
                            ? "..."
                            : marketData?.total_volume?.usd
                            ? Math.round(marketData.total_volume.usd / 100000).toLocaleString()
                            : "564,464"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 text-right -mt-2">(Last 24 hours)</div>

                      <div className="pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">52 weeks Hight</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {loading ? "..." : `$${marketData?.ath?.usd?.toLocaleString() || "82.7 million"}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 text-right mt-0.5">
                          ( {marketData?.ath_date?.usd ? new Date(marketData.ath_date.usd).toISOString().split('T')[0] : "2021.11.09"} )
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">52 weeks Low</span>
                          <span className="font-mono font-bold text-rose-500">
                            {loading ? "..." : `$${marketData?.atl?.usd?.toLocaleString() || "18,500,000"}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 text-right mt-0.5">
                          ( {marketData?.atl_date?.usd ? new Date(marketData.atl_date.usd).toISOString().split('T')[0] : "2020.11.27"} )
                        </div>
                      </div>

                      <div className="pt-2 space-y-2 border-t border-slate-800/80">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Previous</span>
                          <span className="font-mono text-slate-200">
                            {marketData?.high_24h?.usd ? `$${marketData.high_24h.usd.toLocaleString()}` : "70,047,000"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Day's Closing</span>
                          <span className="font-mono text-slate-200">same-day</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Price</span>
                          <span className="font-mono text-slate-200">price</span>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-400">Price</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {loading ? "..." : `$${marketData?.current_price?.usd?.toLocaleString() || "71,287,000"}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Depth Overlay Section */}
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      {redBids.slice(0, 7).map((row, idx) => (
                        <div key={idx} className="relative flex items-center h-6 font-mono text-xs">
                          <div
                            className="absolute left-0 top-0.5 bottom-0.5 bg-rose-900/30 rounded-sm"
                            style={{ width: `${row.depth}%` }}
                          />
                          <span className="relative z-10 px-2 text-slate-300">{row.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Footer Bar */}
                <div className="grid grid-cols-3 items-center px-6 py-3 bg-hero2-dark border-t border-slate-800 text-xs font-mono font-bold">
                  <div className="text-left text-slate-200">2.147</div>
                  <div className="text-center text-slate-400 flex items-center justify-center gap-1 font-sans text-xs">
                    Quantity <span className="text-[10px] text-slate-500">(BTC)</span> ⇄
                  </div>
                  <div className="text-right text-slate-200">2.227</div>
                </div>

              </div>
               <div className='flex flex-col gap-1'>
                <div className='bg-hero2-dark h-10 w-98 flex justify-between items-center pr-4'>
                  <div className='flex flex-row gap-3 pt-1 pl-4'>
                    <div className='bg-input-field h-7 w-15 flex justify-center items-center'>
                      <p className='text-sm hover:text-blue-500'>Cross</p>
                    </div>

                    <div className='bg-input-field h-7 w-15 flex justify-center items-center'>
                      <p className='text-sm hover:text-blue-500'>10.00x</p>
                    </div>
                  </div>

                  <div>
                    <FaCalculator className='hover:text-blue-500'/>
                  </div>
                </div>

                <div className='bg-hero2-dark h-85 w-98 pt-3'>
                  <div className='flex flex-row gap-5 pl-4'>
                    <p className='text-text-color hover:text-white'>Limit</p>
                    <p className='text-text-color hover:text-white'>Market</p>
                    <p className='text-text-color hover:text-white'>Conditional</p>
                  </div>

                  <hr className='mt-2 text-line-color'/>

                  <div>
                    <input type="text" placeholder='Qty' className='w-90 h-10 bg-input-field mt-4 ml-4 pl-2'/>
                    <p className='text-sm relative bottom-7 flex justify-end right-6'>USD</p>
                  </div>

                  <div className="flex justify-center w-full pt-3 pl-6 pr-6">
                    <div className="relative flex justify-between items-center w-full">
                      {/* Horizontal Line */}
                      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#2d3139] -translate-y-1/2 z-0" />

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

                  <div className='flex justify-between pr-6 pl-6 pt-6'>
                    <div>
                      <div className='flex flex-row gap-3 items-center'>
                        <input type="checkbox" />
                        <p className='text-text-color'>Buy Long with TP/SL</p>
                      </div>

                      <div className='flex flex-row gap-3 items-center pt-2'>
                        <input type="checkbox" />
                        <p className='text-text-color'>Sell Short with TP/SL</p>
                      </div>
                    </div>

                    <div className='flex flex-col gap-3 text-base'>
                      <p>Order Value</p>
                      <p>0.00000000 BTC</p>
                    </div>
                  </div>

                  <div className='flex flex-row gap-6 pl-6 pr-6 pt-7'>
                    <button className='h-10 w-40 bg-green-600 rounded-sm'>Buy / Long</button>
                    <button className='h-10 w-40 bg-red-600 rounded-sm'>Sell / Short</button>
                  </div>
                </div>
              </div>
          </div>
        </div>

       

        {/* RIGHT SECTION */}
        <div>
          <div className='bg-hero2-dark h-210 w-148 mt-3 flex-col gap-5 pl-3 pr-3 pt-5'>
            <div>
              <input type="text" placeholder='Search' className='h-10 w-140 bg-input-field text-text-color pl-10 pb-1'/>
              <FaSearch className='relative bottom-7 ml-4' />
            </div>

            <div className='flex flex-row gap-10 pl-6 pr-10 pt-2'>
              <div className='flex flex-row gap-2 items-center'>
                <FaStar className='hover:text-yellow-300' />
                <p className='text-text-color hover:text-white'>Favorite</p>
              </div>
              <p className='text-text-color hover:text-white'>BUSD</p>
              <p className='text-text-color hover:text-white'>USDT</p>
              <p className='text-text-color hover:text-white'>BNB</p>
              <p className='text-text-color hover:text-white'>BTC</p>
              <p className='text-text-color hover:text-white'>ALTS</p>
              <p className='text-text-color hover:text-white'>FIAT</p>
            </div>

            <hr className='text-line-color mt-4' />

            <div className='flex justify-between text-text-color text-sm pt-3 pl-10 pr-10'>
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
