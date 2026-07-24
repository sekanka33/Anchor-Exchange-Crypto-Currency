import React from 'react'
import { Link } from "react-router-dom";

const CreateAnAccoutSection = () => {
  return (
    <div className='w-full h-35 bg-hero-dark pl-25 pr-25 flex justify-between pt-12'>
        <div>
            <p className='text-2xl'>Earn up to $25 worth of crypto</p>
            <p className='text-gray-500'>Discover how specific cryptocurrencies work — and get a bit of each crypto to try out for yourself.</p>
        </div>
        <div>
            <Link to="/signup"><button className='w-40 h-11 bg-white rounded-full text-black font-semibold'>Create Account</button></Link>
        </div>
    </div>
  )
}

export default CreateAnAccoutSection
