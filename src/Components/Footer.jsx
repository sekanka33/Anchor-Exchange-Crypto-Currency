import React from 'react'
import { FaFacebook, FaLinkedin, FaTwitter } from 'react-icons/fa'
import { FaWhatsapp, FaXTwitter } from 'react-icons/fa6'

const Footer = () => {
  return (
    <footer className='py-20 px-22 w-full h-75'>
      {/* Top Footer */}
      <div className='flex justify-between'>
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
            <p>Spot</p>
            <p>Inverse Perpetual</p>
            <p>USDT Perpetual</p>
            <p>Exchange</p>
            <p>Launchpad</p>
            <p>Anchor pay</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-1xl font-bold '>SERVICES</h1>
            <p>Buy Crypto</p>
            <p>Markets</p>
            <p>Trading Fee</p>
            <p>Affiliate Program</p>
            <p>Referral Program</p>
            <p>API</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-1xl font-bold '>SUPPORT</h1>
            <p>Anchor Learn</p>
            <p>Help Center</p>
            <p>User Feedback</p>
            <p>Submit Request</p>
            <p>API Documentation</p>
            <p>Trading Rules</p>
          </div>

          <div className='flex flex-col gap-4'>
            <h1 className='text-1xl font-bold '>ABOUT US</h1>
            <p>About Anchor Exchange</p>
            <p>Authenticity Check</p>
            <p>Careers</p>
            <p>Contacts</p>
            <p>Blog</p>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className='flex justify-between pt-10 h-10 w-full bg-whiet'>
        <div>
          <p>Copyright &copy; {new Date().getFullYear()} Free For all of the World people</p>
        </div>

        <div className='flex gap-5'>
          <button><FaFacebook/> </button>
          <button><FaWhatsapp /> </button>
          <button><FaLinkedin /> </button>
          <button><FaXTwitter /> </button>
        </div>
      </div>

    </footer>
  )
}

export default Footer
