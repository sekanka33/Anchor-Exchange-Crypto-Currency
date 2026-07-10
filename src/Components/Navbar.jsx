import React from 'react'
import { Link } from 'react-router-dom'
import { FiMoon, FiBell, FiMenu, FiX } from "react-icons/fi";
import { useState } from 'react';

const Navbar = () => {

  const [menuOpen, setMenuOpen] = useState(false);
  

  return (
    <nav className="flex justify-between items-center bg-[#0d0e12] w-full h-14 text-white px-6 text-sm font-medium border-b border-gray-800">
      {/* Left Section: Logo & Main Navigation */}
      <div className="flex items-center h-full space-x-1">
        
        {/* Logo */}
        <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center space-x-2 px-4 h-full hover:opacity-90">
          {/* Hexagon/Crypto Icon Placeholder */}
          <span className="text-lg font-bold tracking-wide text-white hover:text-blue-500">Anchor Exchange</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center h-full text-gray-300">
          {/* Active/Highlighted Tab */}
          <Link to="/" className="text-white px-4 h-full flex items-center space-x-1  hover:text-blue-500">
            <span>Home</span>
          </Link>
          
          <Link to="/buy-crypto" className="px-4 h-full flex items-center transition-colors  hover:text-blue-500">
            Buy Crypto
          </Link>
           
          <Link to="/markets" className="px-4 h-full flex items-center transition-colors  hover:text-blue-500">
            Markets
          </Link>
          
          <Link to="/exchange" className="px-4 h-full flex items-center transition-colors  hover:text-blue-500">
            Exchange
          </Link>
          
          <Link to="/spot" className="px-4 h-full flex items-center  transition-colors  hover:text-blue-500">
            Spot
          </Link>

          <Link to="/bitusdt" className="px-4 h-full flex items-center  hover:text-blue-500 transition-colors space-x-1 text-xs">
            <span>BITUSDT</span>
            <span className="text-blue-500 text-[8px]">💧</span>
          </Link>

          <Link to="/pages" className="px-4 h-full flex items-center  transition-colors space-x-1  hover:text-blue-500">
            <span>Pages</span>
            <span className="text-[10px]">▼</span>
          </Link>
        </div>
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="hidden md:flex items-center space-x-2 text-gray-300">
        <Link to="/assets" className="text-white px-2 h-full flex items-center space-x-1  hover:text-blue-500">
            <span>Assests</span>
            <span className="text-[10px]">▼</span>
          </Link>
        
        <Link to="/orderstrades" className="text-white px-2 h-full flex items-center space-x-1 hover:text-blue-500">
            <span>Orders & Trades</span>
          </Link>
        
        <Link to="/enusd" className="text-white px-2 h-full flex items-center space-x-1  hover:text-blue-500">
            <span>EN/USD</span>
            <span className="text-[10px]">▼</span>
          </Link>

        {/* Theme/Notification Icons */}
        <button className="text-gray-300 hover:text-blue-500 text-xl">
            <FiMoon />
        </button>
        <button className="text-gray-300 hover:text-blue-500 text-xl relative">
        <FiBell />
      </button>

        {/* Wallet Button */}
        <Link 
          to="/wallet" 
          className="border border-gray-600 rounded-full px-4 py-1 text-xs hover:bg-blue-500 transition-colors"
        >
          Wallet
        </Link>

        <Link to="/signin" className="border border-gray-600 rounded-full px-4 py-1 text-xs hover:bg-blue-500 transition-colors">Sign-In</Link>

        
      </div>


      <div className='md:hidden'>
        <button onClick={() => setMenuOpen(!menuOpen)} className='md:hidden text-2xl'
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {menuOpen && (
            <div className="absolute top-14 left-0 w-full bg-[#0d0e12] flex flex-col p-6 gap-4 border-b border-gray-800 z-50 text-gray-300">
              <Link to="/" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                Home
              </Link>
              
              <Link to="/buy-crypto" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                Buy Crypto
              </Link>
              
              <Link to="/markets" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                Markets
              </Link>
              
              <Link to="/exchange" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                Exchange
              </Link>
              
              <Link to="/spot" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                Spot
              </Link>

              <Link to="/bitusdt" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                BITUSDT
              </Link>

              <Link to="/pages" onClick={() => setMenuOpen(false)} className="hover:text-white transition-colors py-1">
                Pages ▼
              </Link>
            </div>
        )}
    </nav>

  )
}

export default Navbar
