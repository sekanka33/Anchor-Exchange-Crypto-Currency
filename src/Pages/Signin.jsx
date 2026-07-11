import React from 'react'
import { FaEye } from 'react-icons/fa'

const Signin = () => {
  return (
    <div>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Sign-In</h1>
      </div>

      <div className='items-center text-center'>
        <h1 className='text-3xl font-semibold pt-25'>Log In to Anchor Exchange</h1>
        <p className='pt-3'>Welcome back! Log In now to start trading</p>
        <div className='flex gap-6 justify-center pt-7'>
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
        <div>
          <input type="text" placeholder='Please enter a password.' className='w-120 h-13 rounded-2xl bg-gray-900 border-2 border-gray-900 pt-1 pl-4 mt-2' />
          <FaEye />
        </div>
        
        <div className='flex gap-25 text-center'>
          <div className='flex gap-2'>
            <input type="checkbox" />
            <p>Remember Me</p>
          </div>
          <p className='text-red-600'>Forgot Password?</p>
        </div>
      </form>
    </div>
  )
}

export default Signin
