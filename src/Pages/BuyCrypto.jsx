import React from 'react'
import CreateAnAccoutSection from '../Components/CreateAnAccoutSection'
import { FaRecycle } from 'react-icons/fa6'

const BuyCrypto = () => {
  return (
    <div>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Buy Crypto</h1>
      </div>

      <div className='flex flex-row gap-50 pt-20 pb-20 pr-30 pl-30'>
        <div className='flex flex-col justify-center gap-7 pb-50'>
          <div className='hover:w-50 hover:h-10 hover:bg-blue-500 hover:rounded-full hover:pl-4 hover:pt-2'><p>Overview</p></div>
          <div className='hover:w-50 hover:h-10 hover:bg-blue-500 hover:rounded-full hover:pl-4 hover:pt-2'><p>Buy Crypto</p></div>
          <div className='hover:w-50 hover:h-10 hover:bg-blue-500 hover:rounded-full hover:pl-4 hover:pt-2'><p>Sell Crypto</p></div>
        </div>

        <div className='h-100 w-0 border-r-2 border-hero-dark'></div>

        <div>
          <div className='flex flex-row gap-5'>
            <div className='flex flex-row gap-2 items-center'>
              <div className='h-4 w-4 bg-white rounded-full flex items-center justify-center'><div className='h-2 w-2 bg-green-400 rounded-full'></div></div>
              <div className='flex flex-row gap-7'>
                <p>Select currency</p>
                <p>- - - - - - - - -</p>
              </div>
            </div>

            <div className='flex flex-row gap-2 items-center'>
              <div className='h-4 w-4 bg-white rounded-full flex items-center justify-center'><div className='h-2 w-2 bg-green-400 rounded-full'></div></div>
              <div className='flex flex-row gap-7'>
                <p>Important Notes</p>
                <p>- - - - - - - - -</p>
              </div>
            </div>


            <div className='flex flex-row gap-2 items-center'>
              <div className='h-4 w-4 bg-white rounded-full flex items-center justify-center'><div className='h-2 w-2 bg-green-400 rounded-full'></div></div>
              <div className='flex flex-row gap-7'>
                <p>Payment Details</p>
              </div>
            </div>
          </div>


          <div className='bg-hero-dark w-170 rounded-2xl h-90 mt-10'>
            <p className='text-3xl'>Select Currency</p>
            {/* The prices will added using api */}
            <p className='text-gray-500'>Current Price: </p> 
            <form className='flex flex-row gap-5'>
              <div>
                <p>Pay</p>
                <div>
                  <input type="text" className='w-70 h-15 rounded-2xl bg-black'/>
                  <select name="currency-prices" id="price" className='bg-black relative right-20'>
                    <option value="">USDC</option>
                    <option value="">USDT</option>
                    <option value="">BIT</option>
                    <option value="">BNB</option>
                  </select>
                </div>
              </div>

              <div>
                
              </div>

              <div>
                <p>Pay</p>
                <div>
                  <input type="text" className='w-70 h-15 rounded-2xl bg-black'/>
                  <select name="currency-prices" id="price" className='bg-black relative right-20'>
                    <option value=""></option>
                    <option value=""></option>
                    <option value=""></option>
                    <option value=""></option>
                  </select>
                </div>
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
