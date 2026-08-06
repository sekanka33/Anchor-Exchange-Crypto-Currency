import React from 'react'
import CreateAnAccoutSection from '../Components/CreateAnAccoutSection'

const Contact = () => {
  return (
    <div>
      <div className='pr-20 pl-20 pt-10 h-27 w-full bg-mist-900'>
        <h1 className='text-2xl font-semibold'>Contact</h1>
      </div>

      <div className='flex justify-center pt-20'>
        <div className='flex justify-center flex-col gap-4 items-center'>
            <h1 className='text-3xl font-medium'>Leave a message for us</h1>
            <p className='text-text-color'>Get in touch with Rockie</p>
        </div>
      </div>
        
        <div className='flex justify-center pt-10'>
            <form action="" className='flex flex-col gap-5'>
                <div className='flex flex-col gap-3'>
                    <p>Your Name</p>
                    <input type="text" placeholder='Enter your name' className='w-120 h-10 bg-input-field rounded-lg pl-2' />
                </div>

                <div className='flex flex-col gap-3'>
                    <p>Email</p>
                    <input type="text" placeholder='Enter mail' className='w-120 h-10 bg-input-field rounded-lg pl-2' />
                </div>

                <div className='flex flex-col gap-3'>
                    <p>Subject</p>
                    <select name="" id="" class='bg-input-field border-input-field rounded-sm h-10 pl-1 outline-none focus:outline-none focus:right-0'>
                        <option value="">Deposit</option>
                        <option value="">Withdrawals</option>
                        <option value="">Stacking</option>
                        <option value="">NFT</option>
                        <option value="">KYC</option>
                    </select>
                </div>

                <div className='flex flex-col gap-3'>
                    <p>Message</p>
                    <input type="text" placeholder='Enter your message' className='w-120 h-30 bg-input-field rounded-lg pl-2 pb-20' />
                </div>

                <button type='submit' className='bg-blue-500 rounded-full h-10 mt-5 mb-25'>Send message</button>
            </form>
        </div>

        <CreateAnAccoutSection />
    </div>
  )
}

export default Contact
