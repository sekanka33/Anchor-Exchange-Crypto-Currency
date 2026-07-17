import React from 'react'
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCoinsByCategory } from "../api/coingecko";
import graphic from "../assets/Graphic.png";

const Home = () => {

  const [coins, setCoins] = useState([]);
  const [category, setCategory] = useState("layer-1");

  useEffect(() => {
    const loadCoins = async () => {
      const data = await getCoinsByCategory(category);
      setCoins(data);
    };

    loadCoins();
  }, [category]);

  return (
    <div>
        {/* Hero Section (Left & Right) */}
        <div className='flex justify-between pr-30 pl-30 bg-hero-dark h-160 pt-16'>
          {/* left-Section */}
          <div>
            <div className='flex flex-col gap-4'>
              <h1 className='text-5xl font-bold'>Buy & Sell Digital</h1>
              <h1 className='text-5xl font-bold'> Assets In The Anchor Exchange</h1>
            </div>
            <p className='pt-4'>Anchor Exchange is the easiest, safest, and fastest way to buy & sell <br /> crypto asset exchange.</p>
            <Link to="/signup"><button className='mt-8 bg-blue-500 hover:bg-blue-400 rounded-full h-10 w-45'>Get started now</button></Link>
            <h2 className='text-2xl pt-7'>Our partners</h2>
            <div className='flex flex-row gap-5 pt-5'>
              <img src="src/assets/Trust_Wallet_logo_(2026).png" alt="" className='h-12 w-30' />
              <img src="src/assets/edited-photo.png" alt="" className='h-25 w-30 ' />
              <img src="src/assets/Stripe_Logo,_revised_2016.svg.webp" alt="" className='h-5 w-30 mt-5' />
            </div>
          </div>

          {/* right-Section */}
          <div>
            <img src="src/assets/homepage-hero.webp" alt="hero-image" className='w-120 h-115'/>
          </div>
        </div>
        <div className="flex justify-end">
          <img
            src={graphic}
            alt="Green graphic"
            className="w-72 h-auto"
          />
        </div>
        <div className='flex justify-center relative -mt-45'>
          <div className='w-280 h-60 bg-hero-dark border border-gray-600 rounded-2xl mb-50 shadow-xl'>
            <div className='flex flex-row gap-8 pt-6 pl-8'>
              <p className="cursor-pointer hover:text-blue-500" onClick={() => setCategory("layer-1")}>Crypto</p>
              <p className="cursor-pointer hover:text-blue-500" onClick={() => setCategory("decentralized-finance-defi")}>DeFi</p>
              <p className="cursor-pointer hover:text-blue-500" onClick={() => setCategory("binance-smart-chain")}> BSC</p>
              <p className="cursor-pointer hover:text-blue-500" onClick={() => setCategory("non-fungible-tokens-nft")}> NFT</p>
            </div>
            <hr className='mt-4 ml-8 mr-10 text-gray-600'></hr>
            <div className="flex gap-6 ml-8 mt-5">
              {coins.map((coin, index) => (
                <div
                  key={coin.id}
                  className={`w-60 h-20 rounded-xl p-4 transition ${
                    index === 1
                      ? "bg-[#232737]"
                      : "bg-transparent hover:bg-[#232737]"
                  }`}
                >
                  {/* Top */}
                  <div className="flex items-center gap-2">
                    <img
                      src={coin.image}
                      alt={coin.name}
                      className="w-5 h-5"
                    />

                    <span className="text-sm font-semibold">
                      {coin.name}
                    </span>

                    <span className="text-xs text-gray-400 uppercase">
                      {coin.symbol}/USD
                    </span>
                  </div>

                  {/* Price */}
                  <h2 className="text-2xl font-bold mt-2">
                    $
                    {coin.current_price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </h2>

                  {/* Bottom */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">
                      {new Intl.NumberFormat("en-US", {
                        notation: "compact",
                      }).format(coin.market_cap)}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-full ${
                        coin.price_change_percentage_24h >= 0
                          ? "bg-green-600"
                          : "bg-red-600"
                      }`}
                    >
                      {coin.price_change_percentage_24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </div>
  )
}

export default Home