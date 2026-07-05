import React from 'react'
import { Link } from 'react-router-dom'
import { FiMoon, FiBell } from "react-icons/fi";
import { useState, useEffect } from 'react';


const Navbar = () => {
  return (
    <nav className="flex justify-between items-center bg-[#0d0e12] w-full h-14 text-white px-6 text-sm font-medium border-b border-gray-800">
      {/* Left Section: Logo & Main Navigation */}
      <div className="flex items-center h-full space-x-1">
        
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 px-4 h-full hover:opacity-90">
          {/* Hexagon/Crypto Icon Placeholder */}
          <span className="text-lg font-bold tracking-wide text-white">Anchor Exchange</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center h-full text-gray-300">
          {/* Active/Highlighted Tab */}
          <Link to="/" className="text-white px-4 h-full flex items-center space-x-1 font-semibold  hover:bg-blue-500">
            <span>Home</span>
            <span className="text-[10px]">▼</span>
          </Link>
          
          <Link to="/buy-crypto" className="px-4 h-full flex items-center hover:text-white transition-colors  hover:bg-blue-500">
            Buy Crypto
          </Link>
          
          <Link to="/markets" className="px-4 h-full flex items-center hover:text-white transition-colors  hover:bg-blue-500">
            Markets
          </Link>
          
          <Link to="/exchange" className="px-4 h-full flex items-center hover:text-white transition-colors  hover:bg-blue-500">
            Exchange
          </Link>
          
          <Link to="/spot" className="px-4 h-full flex items-center hover:text-white transition-colors  hover:bg-blue-500">
            Spot
          </Link>

          <Link to="/bitusdt" className="px-4 h-full flex items-center hover:text-white  hover:bg-blue-500 transition-colors space-x-1 text-xs">
            <span>BITUSDT</span>
            <span className="text-blue-500 text-[8px]">💧</span>
          </Link>

          <Link to="/pages" className="px-4 h-full flex items-center hover:text-white transition-colors space-x-1  hover:bg-blue-500">
            <span>Pages</span>
            <span className="text-[10px]">▼</span>
          </Link>
        </div>
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="flex items-center space-x-2 text-gray-300">
        <Link to="/" className="text-white px-2 h-full flex items-center space-x-1 font-semibold  hover:bg-blue-500">
            <span>Assests</span>
            <span className="text-[10px]">▼</span>
          </Link>
        
        <Link to="/" className="text-white px-2 h-full flex items-center space-x-1 font-semibold  hover:bg-blue-500">
            <span>Orders & Trades</span>
            <span className="text-[10px]">▼</span>
          </Link>
        
        <Link to="/" className="text-white px-2 h-full flex items-center space-x-1 font-semibold  hover:bg-blue-500">
            <span>EN/USD</span>
            <span className="text-[10px]">▼</span>
          </Link>

        {/* Theme/Notification Icons */}
        <button className="text-gray-300 hover:text-white hover:bg-blue-500 text-xl">
            <FiMoon />
        </button>
        <button className="text-gray-300 hover:text-white hover:bg-blue-500 text-xl relative">
        <FiBell />
      </button>

        {/* Wallet Button */}
        <Link 
          to="/wallet" 
          className="border border-gray-600 rounded-full px-4 py-1 text-xs hover:bg-blue-500 transition-colors"
        >
          Wallet
        </Link>

        <Link to="/wallet" className="border border-gray-600 rounded-full px-4 py-1 text-xs hover:bg-blue-500 transition-colors">Sign-In</Link>

        
      </div>
    </nav>



    // Mobile screen size 320px to 480px.




    // Tablet Screen size 481px to 768px




    // Tablet Landscape / Laptops screen size 769px to 1024px



    // Desktop Screens size 1025px to 1200px



    // Large / Widescreen screen size 1201px and up
  )
}

export default Navbar
