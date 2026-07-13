import React from 'react'
import { FaEye, FaQrcode } from 'react-icons/fa'
import { Link } from 'react-router-dom'

const Signup = () => {
  return (
    <div>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Register</h1>
      </div>

      <div className='flex justify-center'>
        <div className='flex flex-col justify-between items-center'>
          <div>
            <h1 className='text-3xl font-semibold pt-19'>Register to Anchor Exchange</h1>
            <p className='pt-3 text-center'>Register in advance and enjoy the event benefits</p>
            <div className='flex gap-6 justify-center pt-5'>
              <div className='border-2 h-8 w-19 text-center rounded-full'>
                <p>Email</p>
              </div>

              <div className='border-2 h-8 w-19 text-center rounded-full'>
                <p>Mobile</p>
              </div>
            </div>
          </div>
        </div>
      </div> 

      <form className='flex gap-5 flex-col pl-115 pt-7'>
        <div className='flex flex-col gap-3'>
          <h2>Email</h2>
          <div className='relative flex items-center w-130'>
            <input type='text' placeholder='Please fill in the email form.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 pr-44 text-white focus:outline-none' />
            <button type='button' className='absolute left-120 h-13 w-40 bg-blue-500 hover:bg-blue-400 rounded-e-2xl font-medium'>Authenticate</button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default Signup