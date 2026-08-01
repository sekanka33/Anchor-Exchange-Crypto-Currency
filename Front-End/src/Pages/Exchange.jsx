import React from 'react'
import { FaSearch } from 'react-icons/fa';
import { FiMoon, FiSun } from "react-icons/fi";

const Exchange = () => {
  return (
    <div>
      <div className='flex justify-between bg-hero2-dark w-full h-25 pl-10 pr-10 pt-5'>
        <div className='flex flex-row gap-15'>
          <div className='flex flex-col gap-2'>
            <div className='flex flex-row gap-3 items-center '>
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
        </div>

       

        {/* RIGHT SECTION */}
        <div>
          <div className='bg-hero2-dark h-250 w-148 mt-3 flex-col gap-5 pl-3 pr-3 pt-5'>
            <div>
              <input type="text" placeholder='Search' className='h-10 w-140 bg-input-field text-text-color pl-10 pb-1'/>
              <FaSearch className='relative bottom-7 ml-4' />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Exchange
