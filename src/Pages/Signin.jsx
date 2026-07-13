import React from 'react'
import { FaEye, FaQrcode } from 'react-icons/fa'
import { Link } from 'react-router-dom'

const Signin = () => {
  return (
    <div>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Sign-In</h1>
      </div>

      <div className='flex justify-between items-center'>
        <div className='pl-135'>
      <div className='items-center text-center'>
        <h1 className='text-3xl font-semibold pt-18'>Log In to Anchor Exchange</h1>
        <p className='pt-3'>Welcome back! Log In now to start trading</p>
        <div className='flex gap-6 justify-center pt-5'>
          <div className='border-2 h-8 w-19 text-center rounded-full'>
            <p>Email</p>
          </div>

          <div className='border-2 h-8 w-19 text-center rounded-full'>
            <p>Mobile</p>
          </div>
        </div>
        
      </div>
      <form className='text-center pt-13'>
        <h2 className='pr-108'>Email</h2>
        <input type="text" placeholder='Please fill in the email form.' className='w-120 h-13 rounded-2xl bg-gray-900 border-2 border-gray-900 pt-1 pl-4 mt-2' />
        
        <h2 className='pr-101 pt-7'>Password</h2>
        <div className='relative w-120 mx-auto mt-2'>
          <input 
            type="password" 
            placeholder='Please enter a password.' 
            className='w-full h-13 rounded-2xl bg-gray-900 border-2 border-gray-900 pt-1 pl-4 pr-12' 
          />
          <FaEye className='absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-200' />
        </div>
        
        <div className='flex gap-52 pt-2 justify-center'>
          <div className='flex gap-2'>
            <input type="checkbox" />
            <p>Remember Me</p>
          </div>
          <p className='text-red-600'>Forgot Password?</p>
        </div>
        <button type='submit' className='w-120 h-10 mt-6 bg-blue-500 rounded-3xl'>LogIn</button>
        <p className='mt-4'>Not a member?<Link to="/signup" className='text-blue-500 ml-2'>Register</Link></p>
      </form>
      </div>
      <div className='pr-45'>
        <div className='flex justify-end'>
          <FaQrcode className='text-9xl' />
        </div>
        <p className='text-2xl'>Login with QR code</p>
        <p className='text-center'>Scan this code with your phone <br/> to log in instantly.</p>
      </div>
      </div>


      

    </div>
  )
}

export default Signin