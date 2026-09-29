import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCoinsByCategory } from "../api/coingecko";
import graphic from "../assets/Graphic.png";
import { FaAppStore, FaCheckCircle, FaGooglePlay, FaSearch, FaStar, FaRegStar } from 'react-icons/fa';
import CreateAnAccoutSection from '../Components/CreateAnAccoutSection';
import CryptoMarketBar from '../Components/CryptoMarketBar';

const MARKET_CATEGORIES = [
  { name: "View All", id: "" },
  { name: "Layer 1", id: "layer-1" },
  { name: "DeFi", id: "decentralized-finance-defi" },
  { name: "Stablecoins", id: "stablecoins" },
  { name: "Memecoins", id: "meme-token" },
  { name: "NFT", id: "non-fungible-tokens-nft" },
  { name: "Gaming", id: "gaming" },
];

const Home = () => {

  const [coins, setCoins] = useState([]);
  const [category, setCategory] = useState("layer-1");
  const [coinsLoading, setCoinsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [starred, setStarred] = useState({});

  useEffect(() => {
    const loadCoins = async () => {
      setCoinsLoading(true);
      try {
        const data = await getCoinsByCategory(category, 8);
        setCoins(data);
      } catch {
        setCoins([]);
      } finally {
        setCoinsLoading(false);
      }
    };

    loadCoins();
  }, [category]);

  const visibleCoins = coins.filter((coin) =>
    (coin.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (coin.symbol ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
        {/* Hero Section (Left & Right) */}
        <div className='flex flex-col md:flex-row justify-between gap-8 px-4 md:pr-30 md:pl-30 bg-slate-100 dark:bg-hero-dark text-slate-900 dark:text-white md:h-160 pt-10 md:pt-16 pb-10 md:pb-0'>
          {/* left-Section */}
          <div>
            <div className='flex flex-col gap-4'>
              <h1 className='text-3xl sm:text-4xl md:text-5xl font-bold'>Buy & Sell Digital</h1>
              <h2 className='text-3xl sm:text-4xl md:text-5xl font-bold'> Assets In The Anchor Exchange</h2>
            </div>
            <p className='pt-4'>Anchor Exchange is the easiest, safest, and fastest way to buy & sell <br className="hidden sm:block" /> crypto asset exchange.</p>
            <Link to="/signup"><button className='mt-8 bg-blue-600 hover:bg-blue-600 rounded-full h-10 w-45 text-white'>Get started now</button></Link>
            <h2 className='text-2xl pt-7'>Our partners</h2>
            <div className='flex flex-row flex-wrap gap-5 pt-5'>
              <img src="src/assets/Trust_Wallet_logo_(2026).png" alt="" className='h-12 w-30' />
              <img src="src/assets/edited-photo.png" alt="" className='h-32 w-30 -mt-10' />
              <img src="src/assets/Stripe_Logo,_revised_2016.svg.webp" alt="" className='h-5 w-30 mt-5' />
            </div>
          </div>

          {/* right-Section */}
          <div className="flex justify-center md:block">
            <img src="src/assets/homepage-hero.webp" alt="hero-image" className='w-full max-w-120 h-auto md:h-115'/>
          </div>
        </div>

        <div className="flex justify-end">
          <img src={graphic} alt="Green graphic" className="w-40 md:w-72 h-auto"/>
        </div>
        {/* content */}
        <CryptoMarketBar />

        <div className='flex flex-col gap-7 px-4 md:pl-28 md:pr-28 relative md:bottom-17'>

          <div className='flex justify-between'>
            <h2 className='text-3xl font-bold'>Market Update</h2>
            <p>See All Coins</p>
          </div>

          <div className='flex flex-col md:flex-row md:justify-between md:items-center gap-4'>
            <div className='flex flex-row gap-8 overflow-x-auto pb-1 [&>button]:flex-shrink-0'>
              {MARKET_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={category === cat.id ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className='relative'>
              <FaSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400'/>
              <input
                aria-label="Search coin"
                placeholder='Search Coin'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='h-8 w-full md:w-65 bg-slate-100 dark:bg-gray-900 rounded-2xl pl-11 pb-1'
              />
            </div>
          </div>

          <div className='overflow-x-auto'>
           <div className='min-w-[820px]'>
            <div className='flex justify-center pt-11 pb-5 text-gray-500 dark:text-gray-400 text-sm font-semibold'>
              <p className='pr-5'></p>
              <p className='pr-52'>Name</p>
              <p className='pr-22'>Last Price</p>
              <p className='pr-40'>24h %</p>
              <p className='pr-40'>Market Cap</p>
              <p className='pr-20'>Last 7 Days</p>
              <p></p>
            </div>

            {coinsLoading && (
              <p className='text-center text-gray-500 dark:text-gray-400 py-10'>Loading market data…</p>
            )}

            {!coinsLoading && visibleCoins.length === 0 && (
              <p className='text-center text-gray-500 dark:text-gray-400 py-10'>No coins match your search.</p>
            )}

            {!coinsLoading && visibleCoins.map((coin, index) => (
              <div key={coin.id} className='flex flex-col gap-2'>
                <hr className='text-gray-200 dark:text-gray-600 mt-4'/>

                <div className='flex pt-5 justify-center items-center'>
                  <button
                    type="button"
                    onClick={() => setStarred((s) => ({ ...s, [coin.id]: !s[coin.id] }))}
                    aria-label={starred[coin.id] ? `Remove ${coin.name} from favorites` : `Add ${coin.name} to favorites`}
                    aria-pressed={!!starred[coin.id]}
                    className='mr-8'
                  >
                    {starred[coin.id] ? <FaStar className='text-amber-400' /> : <FaRegStar className='text-gray-400 hover:text-gray-500' />}
                  </button>
                  <p className='pr-10'>{index + 1}</p>
                  <p className='pr-60 flex items-center gap-2'>
                    {coin.image && <img src={coin.image} alt="" className='w-5 h-5 rounded-full' />}
                    {coin.name} <span className='text-gray-500 dark:text-gray-400 text-xs uppercase'>{coin.symbol}</span>
                  </p>
                  <p className='pr-26'>${Number(coin.current_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  <p className={`pr-40 ${Number(coin.price_change_percentage_24h) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                    {Number(coin.price_change_percentage_24h ?? 0) >= 0 ? "+" : ""}{Number(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                  </p>
                  <p className='pr-40'>${Number(coin.market_cap).toLocaleString()}</p>
                  <p className='pr-12 text-gray-500 dark:text-gray-400 text-xs'>—</p>
                  <Link
                    to="/exchange"
                    className='w-20 h-8 flex items-center justify-center border-2 rounded-full border-slate-900 dark:border-white hover:bg-blue-600 hover:border-blue-500 hover:text-white ml-8'
                  >
                    Trade
                  </Link>
                </div>
              </div>
            ))}

           </div>
          </div>
        </div>

        <div className='w-full py-16 md:h-150 bg-slate-100 dark:bg-hero-dark text-slate-900 dark:text-white mt-40'>
          <div className='flex flex-row gap-10 justify-center px-4'>
            <div className='flex flex-col gap-3 text-center pt-6 md:pt-15'>
              <h2 className='text-3xl font-bold'>How it works</h2>
              <p>Stacks is a production-ready library of stackable <br className="hidden sm:block" /> content blocks built in React Native.</p>
            </div>
          </div>

          <div>
              <div className='flex flex-col sm:flex-row flex-wrap justify-center gap-10 md:gap-20 lg:gap-40 pt-10 md:pt-20 px-4'>
                <div>
                  <img src="src/assets/Bitcoin Cloud.png" alt="bitcoin-cloud" className='pl-13' />
                  <p className='text-center text-gray-400 pt-3'>Step 1</p>
                  <p className='text-center text-slate-900 dark:text-white text-1xl pt-3'>Download</p>
                  <p className='text-center text-sm text-gray-400 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br /> built in React Native.</p>
                </div>

                <div>
                  <img src="src/assets/Bitcoin Wallet.png" alt="wallet" className='pl-13' />
                  <p className='text-center text-gray-400 pt-3'>Step 2</p>
                  <p className='text-center text-slate-900 dark:text-white text-1xl pt-3'>Connect Wallet</p>
                  <p className='text-center text-sm text-gray-400 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br />  built in React Native.</p>
                </div>

                <div>
                  <img src="src/assets/Bitcoin Mining.png" alt="mining" className='pl-13' />
                  <p className='text-center text-gray-400 pt-3'>Step 3</p>
                  <p className='text-center text-slate-900 dark:text-white text-1xl pt-3'>Start Trading</p>
                  <p className='text-center text-sm text-gray-400 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br />built in React Native.</p>
                </div>

                <div>
                  <img src="src/assets/Bitcoin Comparison.png" alt="Comparing" className='pl-13' />
                  <p className='text-center text-gray-400 pt-3'>Step 4</p>
                  <p className='text-center text-slate-900 dark:text-white text-1xl pt-3'>Earn Money</p>
                  <p className='text-center text-sm text-gray-400 pt-3'>Stacks is a production-ready <br />library of stackable content blocks <br />built in React Native.</p>
                </div>
              </div>
            </div>

        </div>

        <div className='flex flex-col-reverse lg:flex-row justify-between w-full md:h-150 gap-10 pt-20 pb-10 md:mb-35 items-center px-4 md:px-0'>
          <div className='md:pl-30 relative hidden lg:block'>
            <img src="src/assets/Frame.png" alt="ETH"  className='relative left-160 top-70'/>
            <img src="src/assets/IMG (1).png" alt="laptop" />
            <img src="src/assets/Frame.png" alt="ETH" className='relative bottom-50 left-5'/>
          </div>
          <div className='lg:hidden w-full max-w-xs'>
            <img src="src/assets/IMG (1).png" alt="laptop" className='w-full h-auto' />
          </div>

          <div className='flex flex-col gap-5 md:pr-30'>
            <p className='text-3xl md:text-4xl font-bold pt-6 md:pt-20'>What is Anchor Exchange</p>
            <p>Experience a variety of trading on Bitcost. You can use various <br className="hidden lg:block" /> types of coin transactions such as Spot Trade, Futures Trade, <br className="hidden lg:block" />P2P, Staking, Mining, and margin.</p>
            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>View real-time cryptocurrency prices</p>
            </div>
            <p>Experience a variety of trading on Bitcost. You can use various <br className="hidden lg:block" /> types of coin transactions such as Spot Trade, Futures Trade, <br className="hidden lg:block" />P2P, Staking, Mining, and margin.</p>

            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>Buy and sell</p>
            </div>
            <p>Experience a variety of trading on Bitcost. You can use various <br className="hidden lg:block" /> types of coin transactions such as Spot Trade, Futures Trade, <br className="hidden lg:block" />P2P, Staking, Mining, and margin.</p>
            <Link to="/"><button className='bg-blue-600 hover:bg-blue-700 w-33 h-10 rounded-full text-white'>Explorer More</button></Link>
          </div>
        </div>

        <div className='w-full bg-slate-100 dark:bg-hero-dark text-slate-900 dark:text-white md:h-150 px-4 md:pr-25 md:pl-25 flex flex-col-reverse md:flex-row justify-between gap-8 py-16 md:pt-20'>
          <div className='flex flex-col gap-5'>
            <div className='flex flex-col gap-2'>
              <h2 className='text-3xl md:text-4xl font-bold'>Free your money &</h2>
              <h2 className='text-3xl md:text-4xl font-bold'>Invest with confident</h2>
            </div>
            <p className='text-gray-400'>With Cryptor Trade, you can be sure your trading skills are matched</p>
            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>Buy, Sell, And Trade On The Go</p>
            </div>
            <p className='text-gray-400 pl-7'>Managa your holdings from your mobile decive</p>

            <div className='flex flex-row gap-3 items-center'>
              <FaCheckCircle className='text-blue-500 text-1xl'/>
              <p className='text-2xl'>Take Control Of Your Wealth</p>
            </div>
            <p className='text-gray-400 pl-7'>Rest assured you (and only you) have access to your funds</p>

            <div className='flex flex-row flex-wrap gap-4 md:gap-8'>
              <div className='w-55 h-20 bg-black text-white rounded-md border-2 border-transparent flex flex-row gap-7 hover:bg-hero-dark'>
                <FaGooglePlay className='ml-3 mt-6 text-3xl'/>
                <div className='flex flex-col gap-1 pt-3'>
                  <p className='text-sm'>GET IT ON</p>
                  <p className='text-2xl'>Google Play</p>
                </div>
              </div>

              <div className='w-55 h-20 bg-black text-white rounded-md border-2 border-transparent flex flex-row gap-7 hover:bg-hero-dark'>
                <FaAppStore className='ml-3 mt-6 text-3xl'/>
                <div className='flex flex-col gap-1 pt-3'>
                  <p className='text-sm'>DOWNLOAD ON</p>
                  <p className='text-2xl'>Apple Store</p>
                </div>
              </div>
            </div>
          </div>

          <div className='flex justify-center'>
            <img src="src/assets/Illustration.png" alt="crypto-world" className='w-full max-w-120 h-auto md:h-120 md:relative md:bottom-6'/>
          </div>
        </div>

        <div className='px-4 md:pl-25 md:pr-25 flex flex-col lg:flex-row justify-between gap-10 pt-30'>
          <div className='flex flex-col gap-7'>
            <div className='flex flex-col gap-2'>
              <h2 className='text-4xl font-bold'>Our customers love</h2>
              <h2 className='text-4xl font-bold'> what we do</h2>
            </div>
            <p className='font-bold'>Transform your idea into reality with finsweet</p>
            <p className='text-gray-500 dark:text-gray-400'>It is a long established fact that a reader will be distracted by <br /> the readable content of a page when looking at its layout. </p>
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
                <p className='text-blue-600 dark:text-blue-400'>30+</p>
                <p> Customer Reviews</p>
              </div>
          </div>


          <div className='pb-15 w-full md:w-auto'>
            <div className='h-auto md:h-80 w-full md:w-130 bg-white dark:bg-hero-dark text-slate-900 dark:text-white rounded-2xl border border-gray-200 dark:border-transparent flex flex-row gap-10 py-6 md:py-0'>
              <div className='bg-blue-600 w-2 h-auto md:h-80 rounded-l-2xl text-white'></div>
              <p className='md:pt-10 text-lg pr-4'>“Great course I really enjoyed it and the course<br className="hidden lg:block" /> was way easy to learn with very good <br className="hidden lg:block" />explanations of the code, I could easily<br className="hidden lg:block" /> understand and develop applications with the<br className="hidden lg:block" /> knowledge gathered during the course.”</p>
            </div>


            <div className='relative md:bottom-20 md:left-10 mt-6 md:mt-0 flex flex-wrap gap-4 justify-between'>
              <div className='flex flex-row gap-5'>
                <div className='bg-gray-500 w-13 h-13 rounded-full'>
                <img src="src/assets/art.jpg" alt="" className='w-13 h-13 rounded-full' />
                </div>
                <div className='text-slate-900 dark:text-white'>
                  <p className='font-bold'>Johnny Andro</p>
                  <p>Director, Company</p>
                </div>
              </div>
              <img src="src/assets/logo.png" alt="" className='w-40 h-10 md:relative md:right-17'/>
            </div>
          </div>
        </div>

        <CreateAnAccoutSection />

    </div>
  )
}

export default Home