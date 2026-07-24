import React from 'react'
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCoinsByCategory } from "../api/coingecko";
import graphic from "../assets/Graphic.png";
import { FaAppStore, FaAppStoreIos, FaCheckCircle, FaGooglePlay, FaSearch, FaStar } from 'react-icons/fa';
import { FcCandleSticks } from 'react-icons/fc';
import CreateAnAccoutSection from '../Components/CreateAnAccoutSection';

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
              <img src="src/assets/edited-photo.png" alt="" className='h-32 w-30 -mt-10' />
              <img src="src/assets/Stripe_Logo,_revised_2016.svg.webp" alt="" className='h-5 w-30 mt-5' />
            </div>
          </div>

          {/* right-Section */}
          <div>
            <img src="src/assets/homepage-hero.webp" alt="hero-image" className='w-120 h-115'/>
          </div>
        </div>

        <div className="flex justify-end">
          <img src={graphic} alt="Green graphic" className="w-72 h-auto"/>
        </div>

        <div className='flex justify-center relative -top-45'>
          <div className='w-280 h-60 bg-hero-dark border border-gray-600 rounded-2xl shadow-xl'>
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
                    <img src={coin.image} alt={coin.name} className="w-5 h-5"/>

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

        <div className='flex flex-col gap-7 pl-28 pr-28'>

          <div className='flex justify-between'>
            <h1 className='text-3xl font-bold'>Market Update</h1>
            <p>See All Coins</p>
          </div>

          <div className='flex justify-between items-center'>
            <div className='flex flex-row gap-8'>
              <p>View ALL</p>
              <p>Layer 1</p>
              <p>DeFi</p>
              <p>Stablecoins</p>
              <p>Memecoins</p>
              <p>Memecoins</p>
              <p>NFT</p>
              <p>Gaming</p>
            </div>

            <div className=''>
              <FaSearch className='relative top-6 ml-4'/>
              <input placeholder='Search Coin' className='h-8 w-65 bg-gray-900 rounded-2xl pl-11 pb-1'></input>
            </div>
          </div>

          <div>
            <div className='flex justify-center pt-11 pb-5'>
              <p className='pr-5'></p>
              <p className='pr-52'>Name</p>
              <p className='pr-22'>Last Price</p>
              <p className='pr-40'>24h %</p>
              <p className='pr-40'>Market Cap</p>
              <p className='pr-20'>Last 7 Days</p>
              <p></p>
            </div>

      
            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>1</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>


            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>2</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>


            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>3</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>


            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>4</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>


            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>5</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>


            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>6</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>7</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>


            <div className='flex flex-col gap-2'>
              <hr className='text-gray-600 mt-4'/>

              <div className='flex pt-5 justify-center items-center'>
                <FaStar className='mr-8' />
                <p className='pr-10'>8</p>
                <p className='pr-60'>Name</p>
                <p className='pr-26'>Last Price</p>
                <p className='pr-40'>%</p>
                <p className='pr-40'>Market Cap</p>
                <p className='pr-12'>Last 7 Days</p>
                <button className='w-20 h-8 border-2 rounded-full border-white hover:bg-blue-500 hover:border-blue-500 ml-8'>
                  Trade
                </button>
              </div>
            </div>

          </div>
        </div>

        <div className='w-full h-150 bg-hero-dark mt-40'>
          <div className='flex flex-row gap-10 justify-center'>
            <div className='flex flex-col gap-3 text-center pt-15'>
              <h1 className='text-3xl font-bold'>How it works</h1>
              <p>Stacks is a production-ready library of stackable <br /> content blocks built in React Native.</p>
            </div>
          </div>

          <div>
              <div className='flex flex-row justify-center gap-40 pt-20'>
                <div>
                  <img src="src/assets/Bitcoin Cloud.png" alt="bitcoin-cloud" className='pl-13' />
                  <p className='text-center text-gray-500 pt-3'>Step 1</p>
                  <p className='text-center text-white text-1xl pt-3'>Download</p>
                  <p className='text-center text-sm text-gray-500 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br /> built in React Native.</p>
                </div>

                <div>
                  <img src="src/assets/Bitcoin Wallet.png" alt="wallet" className='pl-13' />
                  <p className='text-center text-gray-500 pt-3'>Step 2</p>
                  <p className='text-center text-white text-1xl pt-3'>Connect Wallet</p>
                  <p className='text-center text-sm text-gray-500 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br />  built in React Native.</p>
                </div>

                <div>
                  <img src="src/assets/Bitcoin Mining.png" alt="mining" className='pl-13' />
                  <p className='text-center text-gray-500 pt-3'>Step 3</p>
                  <p className='text-center text-white text-1xl pt-3'>Start Trading</p>
                  <p className='text-center text-sm text-gray-500 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br />built in React Native.</p>
                </div>

                <div>
                  <img src="src/assets/Bitcoin Comparison.png" alt="Comparing" className='pl-13' />
                  <p className='text-center text-gray-500 pt-3'>Step 4</p>
                  <p className='text-center text-white text-1xl pt-3'>Earn Money</p>
                  <p className='text-center text-sm text-gray-500 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br />built in React Native.</p>
                </div>
              </div>
            </div>

        </div>

        <div className='flex justify-between w-full h-150 pt-20 mb-35 items-center'>
          <div className='pl-30'>
            <img src="src/assets/Frame.png" alt="ETH"  className='relative left-160 top-70'/>
            <img src="src/assets/IMG (1).png" alt="laptop" />
            <img src="src/assets/Frame.png" alt="ETH" className='relative bottom-50 left-5'/>
          </div>

          <div className='flex flex-col gap-5 pr-30'>
            <p className='text-4xl font-bold pt-20'>What is Anchor Exchange</p>
            <p>Experience a variety of trading on Bitcost. You can use various <br /> types of coin transactions such as Spot Trade, Futures Trade, <br />P2P, Staking, Mining, and margin.</p>
            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>View real-time cryptocurrency prices</p>
            </div>
            <p>Experience a variety of trading on Bitcost. You can use various <br /> types of coin transactions such as Spot Trade, Futures Trade, <br />P2P, Staking, Mining, and margin.</p>

            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>Buy and sell</p>
            </div>
            <p>Experience a variety of trading on Bitcost. You can use various <br /> types of coin transactions such as Spot Trade, Futures Trade, <br />P2P, Staking, Mining, and margin.</p>
            <Link to="/"><button className='bg-blue-500 hover:bg-blue-400 w-33 h-10 rounded-full'>Explorer More</button></Link>
          </div>
        </div>

        <div className='w-full bg-hero-dark h-150 pr-25 pl-25 flex justify-between pt-20'>
          <div className='flex flex-col gap-5'>
            <div className='flex flex-col gap-2'> 
              <h1 className='text-4xl font-bold'>Free your money &</h1>
              <h1 className='text-4xl font-bold'>Invest with confident</h1>
            </div>
            <p className='text-gray-500'>With Cryptor Trade, you can be sure your trading skills are matched</p>
            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>Buy, Sell, And Trade On The Go</p>
            </div>
            <p className='text-gray-500 pl-7'>Managa your holdings from your mobile decive</p>

            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>Take Control Of Your Wealth</p>
            </div>
            <p className='text-gray-500 pl-7'>Rest assured you (and only you) have access to your funds</p>

            <div className='flex flex-row gap-8'>
              <div className='w-55 h-20 bg-black rounded-md border-white border-2 flex flex-row gap-7 hover:bg-hero-dark'>
                <FaGooglePlay className='ml-3 mt-6 text-3xl'/>
                <div className='flex flex-col gap-1 pt-3'>
                  <p className='text-sm'>GET IT ON</p>
                  <p className='text-2xl'>Google Play</p>
                </div>
              </div>
              
              <div className='w-55 h-20 bg-black rounded-md border-white border-2 flex flex-row gap-7 hover:bg-hero-dark'>
                <FaAppStore className='ml-3 mt-6 text-3xl'/>
                <div className='flex flex-col gap-1 pt-3'>
                  <p className='text-sm'>DOWNLOAD ON</p>
                  <p className='text-2xl'>Apple Store</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <img src="src/assets/Illustration.png" alt="crypto-world" className='w-120 h-120 relative bottom-6'/>
          </div>
        </div>

        <div className='pl-25 pr-25 flex justify-between pt-30'>
          <div className='flex flex-col gap-7'>
            <div className='flex flex-col gap-2'>
              <h1 className='text-4xl font-bold'>Our customers love</h1>
              <h1 className='text-4xl font-bold'> what we do</h1>
            </div>
            <p className='font-bold'>Transform your idea into reality with finsweet</p>
            <p className='text-gray-500'>It is a long established fact that a reader will be distracted by <br /> the readable content of a page when looking at its layout. </p>
            <div className='flex flex-row gap-5'>
              <div className='bg-gray-500 w-15 h-15 rounded-full'>
                <img src="src\assets\ape.jpg" alt="ape" className='rounded-full w-15 h-15' />
              </div>
              <div className='bg-gray-500 w-15 h-15 rounded-full'>
                <img src="src/assets/file.jpg" alt="nft" className='rounded-full w-15 h-15' />
              </div>
              <div className='bg-gray-500 w-15 h-15 rounded-full'>
                <img src="src/assets/pfp-nft.webp" alt="monkey"  className='rounded-full w-15 h-15'/>
              </div>

            </div>

            <div className='flex flex-row gap-2'>
                <p className='text-blue-500'>30+</p>
                <p> Customer Reviews</p>
              </div>
          </div>


          <div className='pb-15'>
            <div className='h-80 w-130 bg-hero-dark rounded-2xl flex flex-row gap-10'>
              <div className='bg-blue-500 w-2 h-80 rounded-l-2xl'></div>
              <p className='pt-10 text-lg'>“Great course I really enjoyed it and the course<br /> was way easy to learn with very good <br />explanations of the code, I could easily<br /> understand and develop applications with the<br /> knowledge gathered during the course.”</p>
            </div>


            <div className='relative bottom-20 left-10 flex justify-between'>
              <div className='flex flex-row gap-5'>
                <div className='bg-gray-500 w-13 h-13 rounded-full'>
                <img src="src/assets/art.jpg" alt="" className='w-13 h-13 rounded-full' />
                </div>
                <div>
                  <p className='font-bold'>Johnny Andro</p>
                  <p>Director, Company</p>
                </div>
              </div>
              <img src="src/assets/logo.png" alt="" className='w-40 h-10 relative right-17'/>
            </div>
          </div>
        </div>

        <CreateAnAccoutSection />

    </div>
  )
}

export default Home