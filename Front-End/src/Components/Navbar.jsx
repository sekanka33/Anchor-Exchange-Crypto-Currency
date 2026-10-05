import { Link, NavLink } from 'react-router-dom'
import { FiMoon, FiSun, FiBell, FiMenu, FiX } from "react-icons/fi";
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import CurrencySelect from "./CurrencySelect";
import { FaUserCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  // Active page link is blue-500; `idle` is the colour used otherwise.
  const navClass = (base, idle) => ({ isActive }) =>
    `${base} ${isActive ? "text-blue-500" : idle}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();

  const [profileOpen, setProfileOpen] = useState(false);
  
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return (
    <nav className="relative flex justify-between items-center bg-white dark:bg-[#0d0e12] w-full h-14 text-slate-900 dark:text-white px-6 text-sm font-medium border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
      {/* Left Section: Logo & Main Navigation */}
      <div className="flex items-center h-full space-x-1">
        
        {/* Logo */}
        <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center space-x-2 px-4 h-full hover:opacity-90">
          <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-white hover:text-blue-500">Anchor Exchange</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden xl:flex items-center h-full text-slate-600 dark:text-gray-300">
          <NavLink to="/" end className={navClass("px-4 h-full flex items-center space-x-1 hover:text-blue-500", "text-slate-900 dark:text-white")}>
            <span>Home</span>
          </NavLink>
          
          <NavLink to="/buy-crypto" className={navClass("px-4 h-full flex items-center transition-colors hover:text-blue-500", "")}>
            Buy Crypto
          </NavLink>
           
          <NavLink to="/markets" className={navClass("px-4 h-full flex items-center transition-colors hover:text-blue-500", "")}>
            Markets
          </NavLink>
          
          <NavLink to="/exchange" className={navClass("px-4 h-full flex items-center transition-colors hover:text-blue-500", "")}>
            Exchange
          </NavLink>
          
          <NavLink to="/spot" className={navClass("px-4 h-full flex items-center transition-colors hover:text-blue-500", "")}>
            Spot
          </NavLink>

          <NavLink to="/bitusdt" className={navClass("px-4 h-full flex items-center hover:text-blue-500 transition-colors space-x-1 text-xs", "")}>
            <span>BITUSDT</span>
            <span className="text-blue-500 text-[8px]">💧</span>
          </NavLink>

          <NavLink to="/pages" className={navClass("px-4 h-full flex items-center transition-colors space-x-1 hover:text-blue-500", "")}>
            <span>Pages</span>
            <span className="text-[10px]">▼</span>
          </NavLink>
        </div>
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="hidden xl:flex items-center space-x-2 text-slate-600 dark:text-gray-300">
        <NavLink to="/assets" className={navClass("px-2 h-full flex items-center space-x-1 hover:text-blue-500", "text-slate-900 dark:text-white")}>
          <span>Assets</span>
          <span className="text-[10px]">▼</span>
        </NavLink>
        
        <NavLink to="/orderstrades" className={navClass("px-2 h-full flex items-center space-x-1 hover:text-blue-500", "text-slate-900 dark:text-white")}>
          <span>Orders & Trades</span>
        </NavLink>
        
        <CurrencySelect className="px-1 h-8" />

        {/* Theme/Notification Icons */}
        <button 
          onClick={toggleTheme} 
          className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl p-1 rounded-full transition-colors"
          aria-label="Toggle theme layout"
        >
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>
        
        <Link to="/notifications" aria-label="Notifications">
          <button className="text-slate-600 dark:text-gray-300 hover:text-blue-500 text-xl relative" aria-label="Notifications" tabIndex={-1}>
            <FiBell />
          </button>
        </Link>

        {/* Wallet Button */}
        <Link 
          to="/wallet" 
          className="border border-gray-300 dark:border-gray-600 rounded-full px-4 py-1 text-xs text-slate-900 dark:text-white hover:bg-blue-600 hover:text-white transition-colors"
        >
          Wallet
        </Link>

        {
          token ? (

            <div className="relative">

              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                <FaUserCircle
                  className="text-3xl cursor-pointer hover:text-blue-500"
                />
              </button>


              {
                profileOpen && (

                  <div className="
                    absolute 
                    right-0 
                    mt-3 
                    w-56 
                    bg-white 
                    dark:bg-[#0d0e12]
                    border
                    border-gray-200
                    dark:border-gray-700
                    rounded-xl
                    shadow-lg
                    p-4
                    z-50
                  ">


                    <h2 className="
                      text-lg 
                      font-semibold
                      mb-3
                    ">
                      Account Overview
                    </h2>


                    <Link 
                      to="/profile-setting"
                      className="
                      block 
                      py-2
                      hover:text-blue-500
                      "
                    >
                      1. Profile and Setting
                    </Link>


                    <Link 
                      to="/dashboard"
                      className="
                      block 
                      py-2
                      hover:text-blue-500
                      "
                    >
                      2. Dashboard
                    </Link>


                    <Link
                      to="/transactions"
                      className="
                      block
                      py-2
                      hover:text-blue-500
                      "
                    >
                      3. Transaction History
                    </Link>


                    {role === "admin" && (
                      <Link
                        to="/admin"
                        className="
                        block
                        py-2
                        text-indigo-400
                        hover:text-indigo-300
                        "
                      >
                        4. Admin Panel
                      </Link>
                    )}


                    <button
                      onClick={()=>{
                        localStorage.removeItem("token");
                        localStorage.removeItem("userId");
                        localStorage.removeItem("role");
                        window.location.href="/signin";
                      }}
                      className="
                      block
                      py-2
                      text-red-500
                      hover:text-red-700
                      "
                    >
                      {role === "admin" ? "5." : "4."} Log out
                    </button>


                  </div>

                )
              }


            </div>


          ) : (

            <Link to="/signin" className="border border-gray-300 dark:border-gray-600 rounded-full px-4 py-1 text-xs text-slate-900 dark:text-white hover:bg-blue-600 hover:text-white transition-colors">
              Sign In
            </Link>

          )
        }
      </div>

      <div className='xl:hidden'>
        <button onClick={() => setMenuOpen(!menuOpen)} className='xl:hidden text-2xl text-slate-900 dark:text-white'
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="absolute top-14 left-0 w-full bg-white dark:bg-[#0d0e12] flex flex-col p-6 gap-4 border-b border-gray-200 dark:border-gray-800 z-50 text-slate-600 dark:text-gray-300">
          <NavLink to="/" end onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            Home
          </NavLink>
          
          <NavLink to="/buy-crypto" onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            Buy Crypto
          </NavLink>
          
          <NavLink to="/markets" onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            Markets
          </NavLink>
          
          <NavLink to="/exchange" onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            Exchange
          </NavLink>
          
          <NavLink to="/spot" onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            Spot
          </NavLink>

          <NavLink to="/bitusdt" onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            BITUSDT
          </NavLink>

          <NavLink to="/pages" onClick={() => setMenuOpen(false)} className={navClass("transition-colors py-1", "hover:text-slate-900 dark:hover:text-white")}>
            Pages ▼
          </NavLink>
          
          <label className="flex items-center justify-between py-1">
            <span>Currency</span>
            <CurrencySelect />
          </label>

          <Link to="/signin" onClick={() => setMenuOpen(false)} className="text-center border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 text-xs hover:bg-blue-600 hover:text-white transition-colors mt-2 text-slate-900 dark:text-white">
            Sign-In
          </Link>
        </div>
      )}
    </nav>
  )
}

export default Navbar