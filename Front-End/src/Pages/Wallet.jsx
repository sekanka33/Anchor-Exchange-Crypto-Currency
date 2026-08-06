import React from 'react'
import { FaArrowDown, FaSearch } from 'react-icons/fa'

const Wallet = () => {
  return (
    <div className='pb-20'>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Wallet</h1>
      </div>

      <div className='flex flex-row gap-20 pt-30 pl-40'>
        <div>
          <div className='flex flex-col gap-5'>
            <div className='flex items-center bg-blue-500 h-10 w-50 rounded-full pl-4'>
              <p>Overview</p>
            </div>
            <p className='pl-4'>Buy Crypto</p>
            <p className='pl-4'>Sell Crypto</p>
          </div>
        </div>

        <div className='border-r text-line-color w-0 h-210'></div>

        {/* RIGHT SECTION */}
        <div>

          <div className='bg-hero2-dark w-220 h-50 flex justify-between pl-10 pr-10 pt-5 rounded-2xl border-line-color border-2'>
            <div className='flex flex-col gap-3'>
              <p className='text-3xl font-bold'>Overview</p>
              <p className='text-text-color text-sm'>Total Balance </p>
              <div className='flex flex-row gap-3 items-center'>
                <p className='text-2xl'>0.79253864</p>
                <div className='w-8 h-6 bg-green-500 flex items-center justify-center rounded-full'><p className='text-sm pb-0.5'>btc</p></div>
              </div>
              <p className='text-text-color'>$12,068.83</p>
            </div>

            <div>
              <div className='flex flex-row gap-4 pt-10'>
                <div>
                  <input type="text" placeholder='Search' className='w-70 h-11 bg-input-field pl-10 rounded-2xl'/>
                  <FaSearch className='relative bottom-7 left-3' />
                </div>

                <div>
                  <input type="text" className='w-20 h-11 bg-input-field rounded-2xl'/>
                  <div className='flex flex-row gap-3 items-center relative bottom-8 left-3'>
                    <p>USD</p>
                    <FaArrowDown />
                  </div>
                </div>
              </div>

              <button className='bg-blue-500 h-10 w-95 rounded-full hover:bg-blue-400'>Show balance</button>
            </div>
          </div>


          <div className='bg-hero2-dark w-220 h-150  pl-10 pr-10 mt-9 rounded-2xl border-line-color border-2'>
            <div className='flex flex-row gap-20 pt-10'>
              <p>#</p>
              <p>Asset</p>
              <p>Earn</p>
              <p>On Order</p>
              <p>Available Balance</p>
              <p>Total Balance</p>
            </div>

            <hr className='text-line-color w-200 h-0 mt-4' />
            
            {/* Here im going to display coins that the user is holding */}
            <div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Wallet
