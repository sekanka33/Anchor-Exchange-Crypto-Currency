import React from 'react'
import { FaFacebook, FaLinkedin, FaTwitter } from 'react-icons/fa'
import { FaWhatsapp, FaXTwitter } from 'react-icons/fa6'

const Footer = () => {
  return (
    <footer className='w-full h-auto'>
      {/* Top Footer */}
      <div className='hidden md:flex justify-between py-20 px-8 max-w-7xl mx-auto w-full'>
        <div className='flex flex-col gap-4'>
          {/* Logo */}
          <h1 className='text-2xl font-extrabold '>Anchor Exchange</h1>
          <p className='text-1xl font-semibold'>Let's talk! 🤙</p>
          <p>+27 123 456 7890</p>
          <p>Anchor@exchange.com</p>
          <p>Free For all of the World people</p>
        </div>

        {/* Fixed: changed gap-20 to md:gap-20 so it doesn't inflate layout width on mobile background DOM */}
        <div className='hidden md:flex md:gap-20 justify-between'>
          <div className='flex flex-col gap-4'>
            <h2 className='text-1xl font-bold '>PRODUCTS</h2>
            <p className='hover:text-blue-500'>Spot</p>
            <p className='hover:text-blue-500'>Inverse Perpetual</p>
            <p className='hover:text-blue-500'>USDT Perpetual</p>
            <p className='hover:text-blue-500'>Exchange</p>
            <p className='hover:text-blue-500'>Launchpad</p>
            <p className='hover:text-blue-500'>Anchor pay</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-1xl font-bold '>SERVICES</h1>
            <p className='hover:text-blue-500'>Buy Crypto</p>
            <p className='hover:text-blue-500'>Markets</p>
            <p className='hover:text-blue-500'>Trading Fee</p>
            <p className='hover:text-blue-500'>Affiliate Program</p>
            <p className='hover:text-blue-500'>Referral Program</p>
            <p className='hover:text-blue-500'>API</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-1xl font-bold '>SUPPORT</h1>
            <p className='hover:text-blue-500'>Anchor Learn</p>
            <p className='hover:text-blue-500'>Help Center</p>
            <p className='hover:text-blue-500'>User Feedback</p>
            <p className='hover:text-blue-500'>Submit Request</p>
            <p className='hover:text-blue-500'>API Documentation</p>
            <p className='hover:text-blue-500'>Trading Rules</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-1xl font-bold '>ABOUT US</h1>
            <p className='hover:text-blue-500'>About Anchor Exchange</p>
            <p className='hover:text-blue-500'>Authenticity Check</p>
            <p className='hover:text-blue-500'>Careers</p>
            <p className='hover:text-blue-500'>Contacts</p>
            <p className='hover:text-blue-500'>Blog</p>
          </div>
        </div>
      </div>


      <div className='hidden md:block h-20 w-full bg-white border-t border-gray-200 text-gray-600 dark:bg-mist-900 dark:border-transparent dark:text-white transition-colors duration-300'>
        <div className='flex justify-between pl-20 pr-20 pt-6'>
          <div>
            <p>Copyright &copy; {new Date().getFullYear()} Free For all of the World people</p>
          </div>

          <div className='flex gap-5 text-gray-500 dark:text-gray-400'>
            <button className='hover:text-blue-500'><FaFacebook size={20} /> </button>
            <button className='hover:text-blue-500'><FaWhatsapp size={20} /> </button>
            <button className='hover:text-blue-500'><FaLinkedin size={20} /> </button>
            <button className='hover:text-blue-500'><FaXTwitter size={20} /> </button>
          </div>
        </div>
      </div>


      {/* mobile footer */}
      <div className='flex md:hidden flex-col justify-between px-7 py-7 w-full box-border'>
        <div className='flex flex-col gap-2'>
          {/* Logo */}
          <h1 className='text-lg font-extrabold '>Anchor Exchange</h1>
          <p className='text-base font-semibold'>Let's talk! 🤙</p>
          <p className='text-base'>+27 123 456 7890</p>
          <p className='text-base'>Anchor@exchange.com</p>
          <p className='text-base'>Free For all of the World people</p>
        </div>

        <div className='flex flex-col gap-6 justify-between pt-7'>
          <div className='flex flex-col gap-2'>
            <h2 className='text-lg font-bold '>PRODUCTS</h2>
            <p className='text-base'>Spot</p>
            <p className='text-base'>Inverse Perpetual</p>
            <p className='text-base'>USDT Perpetual</p>
            <p className='text-base'>Exchange</p>
            <p className='text-base'>Launchpad</p>
            <p className='text-base'>Anchor pay</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-lg font-bold '>SERVICES</h1>
            <p className='text-base'>Buy Crypto</p>
            <p className='text-base'>Markets</p>
            <p className='text-base'>Trading Fee</p>
            <p className='text-base'>Affiliate Program</p>
            <p className='text-base'>Referral Program</p>
            <p className='text-base'>API</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-lg font-bold '>SUPPORT</h1>
            <p className='text-base'>Anchor Learn</p>
            <p className='text-base'>Help Center</p>
            <p className='text-base'>User Feedback</p>
            <p className=' text-base'>Submit Request</p>
            <p className='text-base'>API Documentation</p>
            <p className='text-base'>Trading Rules</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-lg font-bold '>ABOUT US</h1>
            <p className='text-base'>About Anchor Exchange</p>
            <p className='text-base'>Authenticity Check</p>
            <p className='text-base'>Careers</p>
            <p className='text-base'>Contacts</p>
            <p className='text-base'>Blog</p>
          </div>
        </div>
      </div>

      <div className='md:hidden w-full py-7 px-6 bg-white border-t border-gray-200 text-gray-600 dark:bg-mist-900 dark:border-transparent dark:text-white transition-colors duration-300 box-border'>
        <div className='flex flex-col gap-3 items-center justify-between'>
          <div>
            <p className='text-base'>Copyright &copy; {new Date().getFullYear()} Anchor Exchange</p>
          </div>

          <div className='flex gap-2 text-gray-500 dark:text-gray-400'>
            <button className='text-base'><FaFacebook size={20} /> </button>
            <button className='text-base'><FaWhatsapp size={20} /> </button>
            <button className='text-base'><FaLinkedin size={20} /> </button>
            <button className='text-base'><FaXTwitter size={20} /> </button>
          </div>
        </div>
      </div>

    </footer>
  )
}

export default Footer