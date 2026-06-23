import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'

const Navbar = () => {
  return (
    <nav className='flex justify-between bg-black w-auto h-11 text-white pr-15 pl-15 items-center'>
        <div className='flex justify-between items-center'>
            <div>
                <Link to="/" className='text-2xl pb-1'>Anchor Exchange</Link>
            </div>
        

            <div className='pl-4 items-center'>
                <Link to="/">Home</Link>
                <Link to="buyCrypto" className='pl-3'>Buy Crypto</Link>
                <Link to="markets" className='pl-3'>Markets</Link>
                <Link to="exchange" className='pl-3'>Exchange</Link>
                <Link to="spot" className='pl-3'>Spot</Link>
                {/* <Link to="pages">Pages</Link> */}
            </div>
        </div>

        <div>
            <Link to="assets">Assets</Link>
            <Link to="orderTrades" className='pl-3'>Order & Trades</Link>
            <Link to="/" className='pl-3'>EN/USD</Link>
            <Link to="/" className='pl-3'>Home</Link>
            <Link to="/" className='pl-3'>Home</Link>
            <button className='border-2 border-white rounded-full pl-3 items-center'><Link to="/">Wallets</Link></button>
            <Link to="/" className='pl-3'>Sign-In</Link> 
        </div>
    </nav>
  )
}

export default Navbar
