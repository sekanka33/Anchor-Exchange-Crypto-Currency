import React, { useState } from 'react'
import { FaEye, FaQrcode } from 'react-icons/fa'
import { Link } from 'react-router-dom'


const Signup = () => {

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    surname: "",
    country: "",
    phoneNumber: ""
  });

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    console.log(formData);
  };

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
          </div>
        </div>
      </div> 

      <div className='flex justify-center items-center'>
        <form onSubmit={handleSubmit} className='flex gap-5 flex-col pt-7'>
          <div className='flex flex-col gap-3'>
            <h2>Email</h2>
            <div className='relative flex items-center w-130'>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder='Please fill in the email form.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 pr-44 text-white focus:outline-none' />
              <button type='button' className='absolute left-120 h-13 w-40 bg-blue-500 hover:bg-blue-400 rounded-e-2xl font-medium'>Authenticate</button>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Password</h2>
            <div className='relative flex items-center w-161'>
              <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder='Please enter a password.' className='h-13 w-full bg-gray-900 rounded-2xl text-white focus:outline-none pl-3'/>
              <FaEye className='absolute right-3'/>
            </div>

            <div className='relative flex items-center w-161'>
              <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder='Please re-enter your password.' className='h-13 w-full bg-gray-900 rounded-2xl text-white focus:outline-none pl-3'/>
              <FaEye className='absolute right-3'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Full Names</h2>
            <div className='items-center w-161'>
              <input name="fullName" type="text" value={formData.fullName} onChange={handleChange} placeholder='Please enter full names.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Surname</h2>
            <div className='items-center w-161'>
              <input name="surname" type="text" value={formData.surname} onChange={handleChange} placeholder='Please enter your surname.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Country</h2>
            <div className='items-center w-161'>
              <input name="country" type="text" value={formData.country} onChange={handleChange} placeholder='e.g South Africa.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Phone Number</h2>
            <div className='items-center w-161'>
              <input name="phoneNumber" type="text" value={formData.phoneNumber} onChange={handleChange} placeholder='e.g +27 712 345 6789' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <button type='Submit' className='h-13 w-160 mt-3 bg-blue-600 rounded-full'>Register</button>
          <p className='pl-50'>Already have an account? <Link to="/signin" className='text-blue-500'>Log In</Link></p>
        </form>
      </div>
    </div>
  )
}

export default Signup