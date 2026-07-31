import React from 'react'
import CreateAnAccoutSection from '../Components/CreateAnAccoutSection'
import { FaRecycle } from 'react-icons/fa6'


const BuyCrypto = () => {
  return (
    <div>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Buy Crypto</h1>
      </div>

      <div className='flex flex-row gap-30 pt-20 pb-20 pr-30 pl-30'>
        <div className='flex flex-col justify-center gap-7 pb-50'>
          <div className='w-50 h-10 flex items-center px-4 rounded-full transition-colors hover:bg-blue-500 cursor-pointer'>
            <p>Overview</p>
          </div>
          <div className='w-50 h-10 flex items-center px-4 rounded-full transition-colors hover:bg-blue-500 cursor-pointer'>
            <p>Buy Crypto</p>
          </div>
          <div className='w-50 h-10 flex items-center px-4 rounded-full transition-colors hover:bg-blue-500 cursor-pointer'>
            <p>Sell Crypto</p>
          </div>
        </div>
        <div className='h-100 w-0 border-r-2 border-hero-dark'></div>

        <div className='text-white font-sans'>
        
        <div className='flex items-center gap-4 text-sm font-semibold mb-8 justify-center'>
          
          <div className='flex items-center gap-2'>
            <div className='w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center p-0.5'>
              <div className='w-full h-full bg-green-500 rounded-full'></div>
            </div>
            <span>Select currency</span>
          </div>

          <div className='text-gray-600 tracking-widest'>--------</div>

          
          <div className='flex items-center gap-2 text-gray-400'>
            <div className='w-3 h-3 rounded-full bg-white'></div>
            <span>Important Notes</span>
          </div>

          <div className='text-gray-600 tracking-widest'>--------</div>

          
          <div className='flex items-center gap-2 text-gray-400'>
            <div className='w-3 h-3 rounded-full bg-white'></div>
            <span>Payment Details</span>
          </div>
        </div>

        
        <div className='bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-800/50 shadow-xl'>
          <h2 className='text-2xl font-bold mb-1'>Select Currency</h2>
          <p className='text-xs text-gray-400 mb-6'>
            Reference Price: 1,450,939,280.43 VND/BTC
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <div className='flex items-end gap-3 mb-6 relative'>
              {/* Pay Field */}
              <div className='flex-1'>
                <label className='block text-base font-semibold text-gray-300 mb-2'>
                  Pay
                </label>
                <div className='flex items-center bg-input-field border border-blue-500 rounded-xl px-4 py-3'>
                  <input
                    type='text'
                    defaultValue='5,1456322'
                    className='w-full bg-transparent outline-none text-white text-sm font-medium'
                  />
                  <div className='flex items-center gap-1.5 bg-transparent text-xs font-semibold text-white cursor-pointer ml-2'>
                    <span className='w-4 h-4 rounded-full bg-yellow-500 text-black font-bold text-[10px] flex items-center justify-center'>
                      ₮
                    </span>
                    <span>BNB</span>
                    <span className='text-[10px] text-gray-400'>▼</span>
                  </div>
                </div>
              </div>

              {/* Swap Button Icon */}
              <button
                type='button'
                className='bg-blue-500 hover:bg-blue-400 p-2.5 rounded-full text-white transition-colors self-center mt-6 shrink-0'
              >
                <img src="src/assets/Group 564.png" alt="exchange-icon" />
              </button>

              {/* Receive Field */}
              <div className='flex-1'>
                <label className='block text-base font-semibold text-gray-300 mb-2'>
                  Receive
                </label>
                <div className='flex items-center bg-[#21242d] border border-transparent focus-within:border-blue-500 rounded-xl px-4 py-3'>
                  <input
                    type='text'
                    defaultValue='0.00207026'
                    className='w-full bg-transparent outline-none text-white text-sm font-medium'
                  />
                  <div className='flex items-center gap-1.5 bg-transparent text-xs font-semibold text-white cursor-pointer ml-2'>
                    <span className='w-4 h-4 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center'>
                      ₿
                    </span>
                    <span>BTC</span>
                    <span className='text-[10px] text-gray-400'>▼</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className='flex justify-end'>
              <button
                type='submit'
                className='bg-blue-500 hover:bg-blue-400 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full transition-colors'
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  )
}

export default BuyCrypto
