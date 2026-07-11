import React from 'react'
import { FaFacebook, FaLinkedin, FaTwitter } from 'react-icons/fa'
import { FaWhatsapp, FaXTwitter } from 'react-icons/fa6'

const Footer = () => {
  return (
    <footer className='w-full h-75'>
      {/* Top Footer */}
      <div className='flex justify-between py-20 px-22'>
        <div className='flex flex-col gap-4'>
          {/* Logo */}
          <h1 className='text-2xl font-extrabold '>Anchor Exchange</h1>
          <p className='text-1xl font-semibold'>Let's talk! 🤙</p>
          <p>+27 123 456 7890</p>
          <p>Anchor@exchange.com</p>
          <p>Free For all of the World people</p>
        </div>

        <div className='flex gap-20 justify-between'>
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

      {/* Bottom Footer */}
      <div className='h-20 w-full bg-mist-900'>
        <div className='flex justify-between pl-20 pr-20 pt-6'>
          <div>
            <p>Copyright &copy; {new Date().getFullYear()} Free For all of the World people</p>
          </div>

          <div className='flex gap-5 '>
            <button className='hover:text-blue-500'><FaFacebook/> </button>
            <button className='hover:text-blue-500'><FaWhatsapp /> </button>
            <button className='hover:text-blue-500'><FaLinkedin /> </button>
            <button className='hover:text-blue-500'><FaXTwitter /> </button>
          </div>
        </div>
      </div>

    </footer>
  )
}

export default Footer
