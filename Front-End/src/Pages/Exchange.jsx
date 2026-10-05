import React, { useState, useEffect } from 'react';
import { useCurrency } from "../hooks/useCurrency";
import { 
  FaCalculator, 
  FaSearch, 
  FaStar, 
  FaChevronDown, 
  FaRegStar, 
  FaCompress, 
  FaExpand, 
  FaExternalLinkAlt 
} from 'react-icons/fa';
import { FiMoon, FiSun } from "react-icons/fi";
import { BsDiamond, BsDiamondFill } from 'react-icons/bs';
import { getCoinDetail } from '../api/coingecko';

const Exchange = () => {
  const { currency, convert, formatMoney } = useCurrency();

  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChartTab, setActiveChartTab] = useState("15m");
  const [activeQuoteTab, setActiveQuoteTab] = useState("GENERAL");
  const [activeOrderTab, setActiveOrderTab] = useState("Limit");
  const [activeBottomTab, setActiveBottomTab] = useState("OPEN ORDER");

  // Fetch real-time Bitcoin data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const data = await getCoinDetail("bitcoin");
        setMarketData(data.market_data);
        setError("");
      } catch (err) {
        console.error("Error fetching market data:", err);
        setError("Unable to load live market data right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Mock data matching UI screenshot
  const greenAsks = [
    { amount: "0.001", depth: 20, price: "71,728,000", change: "+1.81 %" },
    { amount: "0.138", depth: 60, price: "71,727,000", change: "+1.81 %" },
    { amount: "0.001", depth: 15, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 30, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 25, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 10, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 45, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 35, price: "71,726,000", change: "+1.81 %" },
    { amount: "0.001", depth: 15, price: "71,726,000", change: "+1.81 %" },
  ];

  const redBids = [
    { amount: "0.001", depth: 10, price: "71,728,000", change: "-1.81 %" },
    { amount: "1.481", depth: 75, price: "71,727,000", change: "-1.81 %" },
    { amount: "0.601", depth: 35, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.001", depth: 15, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.501", depth: 50, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.401", depth: 40, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.001", depth: 85, price: "71,726,000", change: "-1.81 %" },
    { amount: "0.021", depth: 65, price: "71,726,000", change: "-1.81 %" },
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

  const recentTrades = [
    { price: "61,408.47", qty: "0.357777", time: "0.357777", isGreen: false },
    { price: "61,408.47", qty: "1.034090", time: "1.034090", isGreen: false },
    { price: "61,408.47", qty: "0.023000", time: "0.023000", isGreen: false },
    { price: "61,408.47", qty: "0.357777", time: "0.357777", isGreen: false },
    { price: "61,408.47", qty: "1.034090", time: "1.034090", isGreen: false },
    { price: "61,408.47", qty: "0.023000", time: "0.023000", isGreen: false },
    { price: "61,408.47", qty: "0.357777", time: "0.357777", isGreen: false },
    { price: "61,408.47", qty: "1.034090", time: "1.034090", isGreen: false },
    { price: "61,408.47", qty: "0.023000", time: "0.023000", isGreen: false },
    { price: "61,408.47", qty: "0.357777", time: "0.357777", isGreen: false },
    { price: "61,408.47", qty: "1.034090", time: "1.034090", isGreen: false },
  ];

  const pairsList = [
    { star: true, pair: "BT/USDT", price: "17,010.1", change: "+0.68%", subChange: "110", amount: "311.52 million" },
    { star: true, pair: "BTC/USDT", price: "6,416", change: "+3.62%", subChange: "-60.00", amount: "532.152 million" },
    { star: true, pair: "ETH/USDT", price: "71,729,000", change: "-1.95%", subChange: "-4,010.00", amount: "462.417 million" },
    { star: true, pair: "XRP/USDT", price: "180", change: "-11.08%", subChange: "-23.00", amount: "532.152 million" },
    { star: true, pair: "LUNA/BNB", price: "3.465", change: "+6.82%", subChange: "60.00", amount: "532.152 million" },
    { star: false, pair: "ETH/USDT", price: "71,729,000", change: "-1.95%", subChange: "-4,010.00", amount: "462.417 million" },
    { star: false, pair: "XRP/USDT", price: "180", change: "-11.08%", subChange: "-23.00", amount: "532.152 million" },
    { star: false, pair: "LUNA/BNB", price: "3.465", change: "+6.82%", subChange: "-60.00", amount: "532.152 million" },
    { star: false, pair: "ETH/USDT", price: "71,729,000", change: "-1.95%", subChange: "-4,010.00", amount: "462.417 million" },
    { star: false, pair: "XRP/USDT", price: "180", change: "-11.08%", subChange: "23.00", amount: "532.152 million" },
    { star: false, pair: "LUNA/BNB", price: "3.465", change: "+6.82%", subChange: "-60.00", amount: "532.152 million" },
    { star: false, pair: "LUNA/BNB", price: "3.465", change: "+6.82%", subChange: "-60.00", amount: "532.152 million" },
    { star: false, pair: "ETH/USDT", price: "71,729,000", change: "-1.95%", subChange: "-4,010.00", amount: "462.417 million" },
    { star: false, pair: "XRP/USDT", price: "180", change: "-11.08%", subChange: "-23.00", amount: "532.152 million" },
  ];

  const openOrders = [
    { date: "10-02 10:38:42", pair: "C98/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "C98/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "NEAR/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "ALICE/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "C98/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "NEAR/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "ALICE/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "C98/BUSD", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "MBOX/USDT", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "MBOX/USDT", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
    { date: "10-02 10:38:42", pair: "MBOX/USDT", type: "Limit", side: "Sell", price: "7632", amount: "40.0", filled: "0.00%", total: "305.280 BUSD", trigger: "Cancel" },
  ];

  return (
    <div className="bg-[#12161f] text-slate-200 text-xs font-sans min-h-screen">
      <h1 className="sr-only">Exchange</h1>

      {/* TOP MARKET HEADER BAR */}
      <div className="flex items-center justify-between bg-[#1e232d] border-b border-[#2d3139] px-4 py-2 text-xs overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-black">
              ₿
            </div>
            <div>
              <div className="flex items-center gap-1 font-bold text-white text-sm">
                BTC/USDT <FaChevronDown className="text-[10px] text-gray-400" />
              </div>
              <div className="text-[10px] text-gray-400">Bitcoin</div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#2d3139]"></div>

          <div>
            <div className="text-emerald-400 font-bold text-sm">61,075.53</div>
            <div className="text-[10px] text-emerald-400">≈ $61,075.53 USD</div>
          </div>

          <div>
            <div className="text-gray-400 text-[10px]">24H Change</div>
            <div className="text-emerald-400 font-semibold">+1.45%</div>
          </div>

          <div>
            <div className="text-gray-400 text-[10px]">24H High</div>
            <div className="text-white font-medium">62,378.38</div>
          </div>

          <div>
            <div className="text-gray-400 text-[10px]">24H Low</div>
            <div className="text-white font-medium">59,378.38</div>
          </div>

          <div>
            <div className="text-gray-400 text-[10px]">24H Turnover(USDT)</div>
            <div className="text-white font-medium">16,730,064.72</div>
          </div>

          <div>
            <div className="text-gray-400 text-[10px]">24H Volume(BTC)</div>
            <div className="text-white font-medium">273.37</div>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT GRID */}
      <div className="p-1 space-y-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-1">
          
          {/* LEFT & CENTER COLUMN (Chart + Order Book + Order Inputs) */}
          <div className="lg:col-span-9 space-y-1">
            
            {/* CANDLESTICK CHART CONTAINER */}
            <div className="bg-[#1e232d] p-2 rounded-sm border border-[#2d3139]">
              {/* Chart Header Tools */}
              <div className="flex items-center justify-between border-b border-[#2d3139] pb-2 text-[11px] text-gray-400">
                <div className="flex items-center gap-4">
                  <span className="text-white font-bold tracking-wider">CHART</span>
                  <div className="flex items-center gap-3">
                    {['1m', '5m', '15m', '1h', '4h', 'D', 'W', 'M'].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setActiveChartTab(tf)}
                        className={`hover:text-white transition-colors ${
                          activeChartTab === tf ? 'text-blue-400 font-bold border-b-2 border-blue-500 pb-0.5' : ''
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chart Canvas Mock Representation */}
              <div className="relative h-80 w-full bg-[#161a23] mt-2 flex flex-col justify-between p-3 rounded-sm overflow-hidden font-mono text-[10px] text-gray-400">
                <div className="flex justify-between items-center text-[10px] text-gray-400 z-10">
                  <div className="space-x-3">
                    <span>2021-11-03 11:00</span>
                    <span>Open: <span className="text-emerald-400">61047.37</span></span>
                    <span>Close: <span className="text-emerald-400">61053.90</span></span>
                    <span>High: <span className="text-emerald-400">61053.90</span></span>
                    <span>Low: <span className="text-rose-400">61003.94</span></span>
                    <span>Volume: <span className="text-white">0.009014</span></span>
                  </div>
                </div>

                {/* Grid Overlay Lines */}
                <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 pointer-events-none opacity-10">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div key={i} className="border border-slate-500"></div>
                  ))}
                </div>

                {/* Simulated Candlesticks */}
                <div className="relative h-48 w-full flex items-end justify-between px-6 z-10">
                  {[40, 55, 30, 45, 60, 75, 50, 65, 80, 95, 70, 85, 60, 40, 50, 65, 80, 90, 75, 85, 95].map((h, i) => {
                    const isGreen = i % 2 === 0;
                    return (
                      <div key={i} className="flex flex-col items-center justify-end h-full w-2">
                        <div className={`w-0.5 ${isGreen ? 'bg-emerald-400' : 'bg-rose-500'}`} style={{ height: `${h + 10}%` }}></div>
                        <div className={`w-2.5 ${isGreen ? 'bg-emerald-500' : 'bg-rose-600'} rounded-xs`} style={{ height: `${h}%` }}></div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-gray-500 text-[10px] z-10 pt-2 border-t border-[#2d3139]">
                  <span>03:00</span>
                  <span>06:00</span>
                  <span>09:00</span>
                  <span>12:00</span>
                  <span>2021-11-04 13:20</span>
                  <span>15:00</span>
                  <span>18:00</span>
                  <span>21:00</span>
                </div>
              </div>
            </div>

            {/* ORDER BOOK & LIVE STATS & ORDER ENTRY SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1">
              
              {/* ORDER BOOK (COL 1-7) */}
              <div className="md:col-span-7 bg-[#1e232d] p-2 rounded-sm border border-[#2d3139]">
                {/* Navigation Tabs */}
                <div className="grid grid-cols-3 text-center text-xs font-semibold text-gray-400 border-b border-[#2d3139] mb-2">
                  {['GENERAL QUOTE', 'CUMULATIVE QUOTE', 'QUOTE ORDER'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveQuoteTab(tab)}
                      className={`py-2 text-[11px] transition-colors ${
                        activeQuoteTab === tab ? 'text-blue-400 border-b-2 border-blue-500 font-bold' : 'hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Visual Order Asks / Bids List */}
                  <div className="col-span-2 space-y-1 border-r border-[#2d3139] pr-2">
                    {/* Upper Asks */}
                    <div className="space-y-0.5">
                      {greenAsks.map((row, idx) => (
                        <div key={idx} className="relative flex justify-between items-center h-5 text-[11px] font-mono">
                          <div
                            className="absolute right-0 top-0 bottom-0 bg-emerald-900/30 rounded-xs pointer-events-none"
                            style={{ width: `${row.depth}%` }}
                          />
                          <span className="z-10 text-gray-300">{row.amount}</span>
                          <span className="z-10 text-emerald-400">{row.price}</span>
                          <span className="z-10 text-emerald-400 text-[10px]">{row.change}</span>
                        </div>
                      ))}
                    </div>

                    {/* Fastening Mid Bar */}
                    <div className="flex justify-between items-center px-2 py-1 bg-[#161a23] my-1 rounded-xs text-[10px] text-gray-400">
                      <span>Fastening</span>
                      <span className="font-mono text-emerald-400 font-bold">+93.03%</span>
                    </div>

                    {/* Lower Bids */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-gray-400 px-1 font-medium">
                        <span>Bidder</span>
                        <span>Contract Amount</span>
                      </div>
                      {bidsLeft.map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center px-1 h-5 text-[11px] font-mono">
                          <span className="text-gray-400">{row.bidder}</span>
                          <span className={row.isGreen ? "text-emerald-400" : "text-rose-500"}>
                            {row.amount}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between px-2 pt-2 text-[11px] font-mono font-bold text-gray-300 border-t border-[#2d3139]">
                      <span>2.147</span>
                      <span className="text-[10px] font-normal text-gray-400">Quantity (BTC) ⇄</span>
                      <span>2.227</span>
                    </div>
                  </div>

                  {/* Right Column Market Stats */}
                  <div className="col-span-1 space-y-2 text-[10px] text-gray-400">
                    <div>
                      <div className="text-gray-400">Trading</div>
                      <div className="font-mono font-bold text-white text-xs">7.841 BTC</div>
                    </div>

                    <div>
                      <div className="text-gray-400">Volume Transaction Amount</div>
                      <div className="font-mono font-bold text-white text-xs">564,464</div>
                      <div className="text-[9px] text-gray-500">(Last 24 hours)</div>
                    </div>

                    <div>
                      <div className="text-gray-400">52 weeks High</div>
                      <div className="font-mono font-bold text-emerald-400 text-xs">82.7 million</div>
                      <div className="text-[9px] text-gray-500">(2021.11.09)</div>
                    </div>

                    <div>
                      <div className="text-gray-400">52 weeks Low</div>
                      <div className="font-mono font-bold text-rose-500 text-xs">18,500,000</div>
                      <div className="text-[9px] text-gray-500">(2020.11.27)</div>
                    </div>

                    <div className="pt-1 border-t border-[#2d3139] space-y-1">
                      <div className="flex justify-between">
                        <span>Previous</span>
                        <span className="text-white font-mono">70,047,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Day's Closing</span>
                        <span className="text-white font-mono">same-day</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Price</span>
                        <span className="text-white font-mono">price</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span>Price</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs">71,287,000</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ORDER INPUT & RECENT TRADES (COL 8-12) */}
              <div className="md:col-span-5 space-y-1">
                
                {/* Order Input Controls */}
                <div className="bg-[#1e232d] p-3 rounded-sm border border-[#2d3139] space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex gap-2">
                      <button className="bg-[#2a2f3d] hover:bg-[#343a4a] text-white px-3 py-1 rounded-xs font-semibold">
                        Cross
                      </button>
                      <button className="bg-[#2a2f3d] hover:bg-[#343a4a] text-white px-3 py-1 rounded-xs font-semibold">
                        10.00x
                      </button>
                    </div>
                    <FaCalculator className="text-gray-400 hover:text-white cursor-pointer" />
                  </div>

                  <div className="flex gap-4 border-b border-[#2d3139] pb-2 text-xs">
                    {['Limit', 'Market', 'Conditional'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setActiveOrderTab(type)}
                        className={`text-gray-400 hover:text-white transition-colors ${
                          activeOrderTab === type ? 'text-white font-bold border-b-2 border-blue-500 pb-1' : ''
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Order Input Price / Qty */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Order Price"
                        className="w-full bg-[#12161f] border border-[#2d3139] text-white text-xs px-3 py-2 rounded-xs focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2.5 text-gray-500 text-[10px]">USD</span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Qty"
                        className="w-full bg-[#12161f] border border-[#2d3139] text-white text-xs px-3 py-2 rounded-xs focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2.5 text-gray-500 text-[10px]">{currency}</span>
                    </div>
                  </div>

                  {/* Percentage Slider Step Nodes */}
                  <div className="relative flex justify-between items-center py-2 px-1">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#2d3139] -translate-y-1/2 z-0" />
                    {[0, 25, 50, 75, 100].map((step, idx) => (
                      <div key={idx} className="relative z-10 text-gray-500 hover:text-white cursor-pointer">
                        {idx === 2 ? <BsDiamondFill className="text-blue-400 text-xs" /> : <BsDiamond className="text-xs" />}
                      </div>
                    ))}
                  </div>

                  {/* Options Checkboxes */}
                  <div className="space-y-1.5 text-[11px] text-gray-400">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-gray-200">
                      <input type="checkbox" className="rounded bg-[#12161f] border-[#2d3139]" />
                      <span>Buy Long with TP/SL</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-gray-200">
                      <input type="checkbox" className="rounded bg-[#12161f] border-[#2d3139]" />
                      <span>Sell Short with TP/SL</span>
                    </label>

                    <div className="flex justify-between pt-2 text-[10px]">
                      <span>Order Value</span>
                      <span className="font-mono text-white">0.00000000 BTC</span>
                    </div>
                  </div>

                  {/* Buy / Sell Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xs text-xs transition-colors">
                      Buy / Long (BTC)
                    </button>
                    <button className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xs text-xs transition-colors">
                      Sell / Short (BTC)
                    </button>
                  </div>

                  <div className="flex justify-between text-[10px] text-gray-400 pt-1">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" className="rounded bg-[#12161f] border-[#2d3139]" />
                      <span>Post Only</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" className="rounded bg-[#12161f] border-[#2d3139]" />
                      <span>Reduce-Only</span>
                    </label>
                    <span className="text-gray-400 cursor-pointer">Good-Till-Canceled ▾</span>
                  </div>
                </div>

                {/* RECENT TRADES PANEL */}
                <div className="bg-[#1e232d] p-2 rounded-sm border border-[#2d3139] space-y-2">
                  <div className="text-xs font-bold text-gray-300 border-b border-[#2d3139] pb-1">RECENT TRADES</div>
                  <div className="flex justify-between text-[10px] text-gray-400 px-1">
                    <span>Price(USDT)</span>
                    <span>Quantity(BTC)</span>
                    <span>Timestamp</span>
                  </div>
                  <div className="space-y-1 h-32 overflow-y-auto font-mono text-[10px]">
                    {recentTrades.map((trade, idx) => (
                      <div key={idx} className="flex justify-between items-center px-1">
                        <span className="text-rose-500 font-medium">{trade.price}</span>
                        <span className="text-gray-300">{trade.qty}</span>
                        <span className="text-gray-400">{trade.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* RIGHT COLUMN (Market Pairs List & Wallet Info) */}
          <div className="lg:col-span-3 space-y-1">
            
            {/* SEARCH & MARKETS PAIR TABLE */}
            <div className="bg-[#1e232d] p-3 rounded-sm border border-[#2d3139] space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full bg-[#12161f] border border-[#2d3139] text-white text-xs pl-8 pr-3 py-1.5 rounded-xs focus:outline-none focus:border-blue-500"
                />
                <FaSearch className="absolute left-2.5 top-2.5 text-gray-500 text-xs" />
              </div>

              {/* Markets Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto text-[11px] text-gray-400 pb-1 border-b border-[#2d3139] min-w-max">
                <button className="flex items-center gap-1 text-yellow-400 font-bold">
                  <FaStar className="text-xs" /> FAVORITE
                </button>
                {['BUSD', 'USDT', 'BNB', 'BTC', 'ALTS', 'FIAT'].map((tab) => (
                  <button key={tab} className="hover:text-white transition-colors">
                    {tab}
                  </button>
                ))}
              </div>

              {/* Table Headers */}
              <div className="grid grid-cols-4 text-[10px] text-gray-400 border-b border-[#2d3139] pb-1">
                <span>Pair</span>
                <span className="text-right">Current Price ↕</span>
                <span className="text-right">Day to day ↕</span>
                <span className="text-right">Transaction amount ↕</span>
              </div>

              {/* Pairs List */}
              <div className="space-y-2 h-96 overflow-y-auto pr-1 text-[11px]">
                {pairsList.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 items-center hover:bg-[#252b37] p-1 rounded-xs cursor-pointer font-mono">
                    <div className="flex items-center gap-1">
                      {item.star ? (
                        <FaStar className="text-yellow-400 text-[10px]" />
                      ) : (
                        <FaRegStar className="text-gray-500 text-[10px]" />
                      )}
                      <span className="text-white font-sans text-xs">{item.pair}</span>
                    </div>
                    <div className="text-right text-gray-200">{item.price}</div>
                    <div className={`text-right ${item.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-500'}`}>
                      <div>{item.change}</div>
                      <div className="text-[9px] text-gray-500">{item.subChange}</div>
                    </div>
                    <div className="text-right text-gray-400 text-[10px]">{item.amount}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ASSETS & DEPOSIT PANEL */}
            <div className="bg-[#1e232d] p-3 rounded-sm border border-[#2d3139] space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                <span>Assets ⚙</span>
                <button className="text-blue-400 text-[10px] flex items-center gap-1 hover:underline">
                  <FaExternalLinkAlt className="text-[9px]" /> Transfer Assets
                </button>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-400">
                  <span>Equity (Derivatives Account)</span>
                  <span className="text-white font-mono font-semibold">0.00000000 BTC</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Available Balance (Derivatives Account)</span>
                  <span className="text-white font-mono font-semibold">0.00000000 BTC</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-semibold text-xs">
                <button className="bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-xs transition-colors">
                  Deposit
                </button>
                <button className="bg-[#2a2f3d] hover:bg-[#343a4a] text-white py-1.5 rounded-xs transition-colors">
                  Exchange
                </button>
                <button className="bg-[#2a2f3d] hover:bg-[#343a4a] text-white py-1.5 rounded-xs transition-colors">
                  Buy
                </button>
              </div>
            </div>

            {/* CONTRACT DETAILS PANEL */}
            <div className="bg-[#1e232d] p-3 rounded-sm border border-[#2d3139] space-y-2 text-[11px] text-gray-400">
              <div className="font-bold text-gray-300 text-xs border-b border-[#2d3139] pb-1">
                Contract Details BTC USD
              </div>

              <div className="flex justify-between">
                <span>Expiration Date</span>
                <span className="text-white font-mono">Perpetual</span>
              </div>
              <div className="flex justify-between">
                <span>Index Price</span>
                <span className="text-emerald-400 font-mono">63,070.47</span>
              </div>
              <div className="flex justify-between">
                <span>Mark Price</span>
                <span className="text-emerald-400 font-mono">63,048.39</span>
              </div>
              <div className="flex justify-between">
                <span>Open Interest</span>
                <span className="text-white font-mono">51,631.59 BTC</span>
              </div>
              <div className="flex justify-between">
                <span>24H Turnover</span>
                <span className="text-white font-mono">3,229,855,012 USD</span>
              </div>
              <div className="flex justify-between">
                <span>Risk Limit</span>
                <span className="text-white font-mono">150 BTC</span>
              </div>
              <div className="flex justify-between">
                <span>Contract Value</span>
                <span className="text-white font-mono">1 USD</span>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM SECTION - OPEN ORDERS & TRADE HISTORY */}
        <div className="bg-[#1e232d] p-3 rounded-sm border border-[#2d3139] space-y-3">
          {/* Bottom Tabs */}
          <div className="flex gap-6 border-b border-[#2d3139] pb-2 text-xs font-bold text-gray-400">
            {['OPEN ORDER(11)', 'ORDER HISTORY', 'TRADE HISTORY', 'FUNDS'].map((tab) => {
              const cleanTab = tab.split('(')[0];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveBottomTab(cleanTab)}
                  className={`hover:text-white transition-colors ${
                    activeBottomTab === cleanTab ? 'text-white border-b-2 border-blue-500 pb-2' : ''
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="text-gray-400 border-b border-[#2d3139] font-sans">
                  <th className="py-2 px-2 font-normal">Date</th>
                  <th className="py-2 px-2 font-normal">Pair</th>
                  <th className="py-2 px-2 font-normal">Type</th>
                  <th className="py-2 px-2 font-normal">Side</th>
                  <th className="py-2 px-2 font-normal">Price</th>
                  <th className="py-2 px-2 font-normal">Amount</th>
                  <th className="py-2 px-2 font-normal">Filled</th>
                  <th className="py-2 px-2 font-normal">Total</th>
                  <th className="py-2 px-2 font-normal">Trigger Conditions</th>
                  <th className="py-2 px-2 font-normal text-right">Cancel All ✕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3139]/50 text-gray-300">
                {openOrders.map((order, idx) => (
                  <tr key={idx} className="hover:bg-[#252b37] transition-colors">
                    <td className="py-1.5 px-2 text-gray-400">{order.date}</td>
                    <td className="py-1.5 px-2 font-sans text-white">{order.pair}</td>
                    <td className="py-1.5 px-2">{order.type}</td>
                    <td className="py-1.5 px-2 text-rose-500">{order.side}</td>
                    <td className="py-1.5 px-2">{order.price}</td>
                    <td className="py-1.5 px-2">{order.amount}</td>
                    <td className="py-1.5 px-2">{order.filled}</td>
                    <td className="py-1.5 px-2">{order.total}</td>
                    <td className="py-1.5 px-2 text-gray-500">-</td>
                    <td className="py-1.5 px-2 text-right">
                      <button className="text-blue-400 hover:underline">Cancel</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Exchange;