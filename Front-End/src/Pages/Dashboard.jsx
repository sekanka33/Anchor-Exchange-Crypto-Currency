import React from 'react'
import { FaArrowCircleDown, FaArrowDown, FaChevronDown, FaPlus, FaSearch } from 'react-icons/fa'
import { FiMoon, FiSun, FiBell, FiMenu, FiX } from "react-icons/fi";
import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme';

const Dashboard = () => {

  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="flex">

      {/* Side NavBar */}
      <div className="w-70 h-screen border-2 border-dark-void pl-8 pt-5">

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
              <img src="src/assets/trade.png" alt="Home" className="w-6 h-6" />
              <Link className="text-lg font-medium">Home</Link>
            </div>

            <div className="flex flex-row gap-5 items-center hover:bg-blue-500 hover:w-50 hover:h-10 rounded-full">
              <img src="src/assets/trade.png" alt="Buy Crypto" className="w-6 h-6" />
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
      </div>

      {/* Right Side */}
      <div className="flex-1">

        {/* Top Navbar */}
        <div className="h-20 bg-white dark:bg-[#0d0e12] border-b border-dark-void flex items-center justify-end px-8 ">
          <div className='flex flex-row gap-8'>
            <div>
              <input type="text" placeholder='Search anything' className='w-55 h-11 bg-hero-dark rounded-full pl-10 mt-5'/>
              <FaSearch className='relative bottom-7 left-3'/>
            </div>
            <Link className='mt-7'>EN/USD</Link>
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

        <div className='bg-crypto-color h-35 w-300 rounded-2xl mt-7 ml-7 flex items-center pr-10 pl-10 flex-row gap-17'>
          <div className='flex flex-row gap-3 items-center'>
            <h1 className='text-2xl font-medium'>BTC/USD</h1> 
            <FaChevronDown className='text-2xl'/>
          </div>

          <div className='w-0.5 h-10 bg-line-color'></div>

          <div className='flex flex-col gap-2'>
            <p className='text-gray-500'>Last Prices</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>0.058505</p> 
              <p className='text-lg text-red-600'>$390.68</p>
            </div>
          </div>

          <div className='flex flex-col gap-2'>
              <p className='text-gray-500'>24h Change</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg text-green-500'>0.001447 </p> 
              <div>
              <div className='w-15 h-7 bg-green-500 rounded-full'><p className='text-base text-white pt-0.5 pl-2'>3.24%</p></div>
              </div>
            </div>
          </div>

          <div >
            <p className='text-gray-500'>24h High</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>0.060069</p> 
            </div>
          </div>

          <div>
            <p className='text-gray-500'>24h Low</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>0.056864</p> 
            </div>
          </div>
          

          <div>
            <p className='text-gray-500'>24h Volume</p>
            <div className='flex flex-row gap-3'>
              <p className='text-lg'>8,532.12 BTC</p> 
            </div>
          </div>
        </div>

        <div className='flex justify-between pr-10 pl-10 pt-5'>
          {/* left Section */}
          <div>
            <div className='flex flex-row gap-10'>
              <div className='flex justify-between w-200 h-20 bg-crypto-color items-center pl-8 pr-8 rounded-t-2xl'>
                <div>
                  <p className='text-lg font-bold'>Trading market</p>
                </div>
                <div className='flex flex-row gap-3'>
                  <p className='hover:text-blue-500'>5M</p>
                  <p className='hover:text-blue-500'>30M</p>
                  <p className='hover:text-blue-500'>1H</p>
                  <p className='hover:text-blue-500'>4H</p>
                  <p className='hover:text-blue-500'>D</p>
                  <p className='hover:text-blue-500'>W</p>
                  <p className='hover:text-blue-500'>M</p>
                  <p className='hover:text-blue-500'>Y</p>
                </div>
              </div>
            </div>
            
            {/* This is where we are going to display the chart */}
            <div className='w-200 h-115 bg-crypto-color mt-1 rounded-b-2xl'>

            </div>

            {/* This is the section for order and history */}
            <div className='w-200 h-90 bg-crypto-color mt-5 rounded-2xl'>
              <div>
                <p>Order history</p>
                <p>Open Orders</p>
                <p>Open Orders</p>
              </div>

              <div>
                <input type="text" className='w-50 h-10 bg-crypto-color'/>
              </div>
            </div>
          </div>

          

          {/* Right Section */}
          <div>
            <div className='w-87 h-117 bg-crypto-color rounded-2xl flex flex-col gap-5 pt-7'>
              <div className='flex justify-center flex-row gap-27'>
                <p className='text-2xl'>Buy</p>
                <p className='text-2xl'>Sell</p>
              </div>

              <div>
                <hr className='ml-10 mr-44'/>
                <hr className='ml-44 mr-10'/>
              </div>

              <div className='flex flex-row gap-5 justify-center pt-2 text-gray-500'>
                <p className='text-sm'>Limit</p>
                <p className='text-sm'>Market</p>
                <p className='text-sm'>Stop limit</p>
                <p className='text-sm'>Stop market</p>
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
                    <p>BTC</p>
                  </div>
                </div>

                <div className='flex justify-center gap-2'>
                  <p className='text-sm pt-1'>1 BTC ≈ 38,677.94 USD</p>
                  <div className='w-7 h-7 rounded-full bg-input-field flex items-center pl-1'><img src="src/assets/repeat.png" alt="exchange" className='w-5 h-5'/></div>
                </div>

                <button className='w-75 h-10 bg-blue-500 rounded-full'>Buy</button>
              </div>
            </div>

            <div>
              <div className='w-87 h-108 bg-crypto-color rounded-2xl'>
                <div className='flex justify-center flex-col gap-2 pt-7 mt-7 pl-10 pr-10 items-center'>
                  <p className='text-gray-500 pl-4'>Your Balance</p>
                  <p className='text-2xl font-medium'>$132,832.89</p>
                </div>

                <div className='flex flex-row gap-3 items-center w-75 h-10 border-white border-2 rounded-4xl justify-center ml-6 mt-5 hover:bg-blue-500 hover:border-blue-500'>
                  <FaPlus />
                  <button>Top up balance</button>
                </div>

                <div className='flex justify-between pl-6 pr-3 pt-7 items-center'>
                  <p>Your assets</p>
                  <div className='flex items-center'>
                    <input type="text" className='w-35 h-8 bg-input-field rounded-2xl'/>
                    <FaSearch className='relative right-33'/>
                  </div>
                </div>
              </div>

              
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Dashboard