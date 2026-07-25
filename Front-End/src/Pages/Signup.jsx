import React, { useState } from 'react'
import { FaEye, FaEyeSlash } from "react-icons/fa";
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


  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  const [passwordMatch, setPasswordMatch] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  function checkPasswordMatch(confirmPassword, password){

    if(event.target.name === "confirmPassword"){
    setPasswordMatch(
        formData.password === event.target.value
    );
}

  }

  const handleChange = (event) => {

    const {name, value} = event.target;

    setFormData({
      ...formData,
      [name]: value
    });


    if(name === "password"){
      checkPassword(value);
    }


    if(name === "confirmPassword"){
      setPasswordMatch(formData.password === value);
    }


    setError("");
    setMessage("");
  };

  function validateForm(){

    if(formData.email.trim() === ""){
      return "Email is required";
    }


    if(!validateEmail(formData.email)){
      return "Please enter a valid email";
    }

    if(formData.fullName.trim() === ""){
      return "Full name is required";
    }


    if(!validateName(formData.fullName)){
      return "Full name can only contain letters";
    }

    if(formData.surname.trim() === ""){
      return "Surname is required";
    }


    if(!validateName(formData.surname)){
      return "Surname can only contain letters";
    }

    if(formData.country.trim() === ""){
      return "Country is required";
    }

    if(formData.phoneNumber.trim() === ""){
      return "Phone number is required";
    }

    if(!validatePhoneNumber(formData.phoneNumber)){
      return "Please enter a valid phone number";
    }


    return null;
  }

  const handleSubmit = async (event) => {

    event.preventDefault();
    
    const userData = {
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      surname: formData.surname,
      country: formData.country,
      phoneNumber: formData.phoneNumber
    };


    const validationError = validateForm();


    if(validationError){

        setError(validationError);

        return;
    }


    console.log("Register button clicked");


    const isValid = passwordValidator(formData.password);


    if (!isValid) {
      setError("Password needs 8+ characters, uppercase, lowercase, number and special character.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);


    try {
        const response = await fetch("http://localhost:5000/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              fullName: formData.fullName,
              surname: formData.surname,
              country: formData.country,
              phoneNumber: formData.phoneNumber
            })
        });


        const data = await response.json();

        if(!response.ok){
          setError(data.message);
          return;
        }

      setMessage(data.message);

      setFormData({
      email:"",
      password:"",
      confirmPassword:"",
      fullName:"",
      surname:"",
      country:"",
      phoneNumber:""
      });

      setPasswordStrength({
      length:false,
      uppercase:false,
      lowercase:false,
      number:false,
      special:false
      });

      setPasswordMatch(false);

    } catch (error) {
        setError("Something went wrong. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  function passwordValidator(password) {

    if(password === null || password.trim() === ""){
        return false;
    }

    if(password.length < 8){
        return false;
    } 

      const containsUppercase = /[A-Z]/.test(password);
      const containsLowercase = /[a-z]/.test(password);
      const containsNumber = /[0-9]/.test(password);
      const containsSpecialChar = /[^A-Za-z0-9]/.test(password)

      return (containsUppercase && containsLowercase && containsNumber && containsSpecialChar);
    
  }


  function checkPassword(password){

    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    });

  }

  function validateEmail(email){

    const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(email);

  } 

  function validatePhoneNumber(phone){

    const phonePattern = /^\+?[0-9\s]{10,20}$/;

    return phonePattern.test(phone);

  }


  function validateName(name){

    const namePattern = /^[A-Za-z\s]+$/;

    return namePattern.test(name);

  }

  function authenticateEmail(){
    console.log("Sending OTP...");
  }
  

  
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
              <button type='button' onClick={authenticateEmail} className='absolute left-120 h-13 w-40 bg-blue-500 hover:bg-blue-400 rounded-e-2xl font-medium'>Authenticate</button>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Password</h2>
            <div className='relative flex items-center w-161'>
              <input name="password" type={showPassword ? "text" : "password"} required value={formData.password} onChange={handleChange} placeholder='Please enter a password.' className='h-13 w-full bg-gray-900 rounded-2xl text-white focus:outline-none pl-3 pr-10'/>
              {
              showPassword 
              ? 
              <FaEyeSlash 
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowPassword(false)}
              />
              :
              <FaEye 
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowPassword(true)}
              />
              }
            </div>

            <div className="text-sm mt-2 flex flex-wrap gap-5 pb-5">

              <p className={passwordStrength.length ? "text-green-500" : "text-gray-500"}>
              ✓ Minimum 8 characters
              </p>

              <p className={passwordStrength.uppercase ? "text-green-500" : "text-gray-500"}>
              ✓ Uppercase letter
              </p>

              <p className={passwordStrength.lowercase ? "text-green-500" : "text-gray-500"}>
              ✓ Lowercase letter
              </p>

              <p className={passwordStrength.number ? "text-green-500" : "text-gray-500"}>
              ✓ Number
              </p>

              <p className={passwordStrength.special ? "text-green-500" : "text-gray-500"}>
              ✓ Special character
              </p>

            </div>
            

            <div className='relative flex items-center w-161'>
              <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required value={formData.confirmPassword} onChange={handleChange} placeholder='Please re-enter your password.' className='h-13 w-full bg-gray-900 rounded-2xl text-white focus:outline-none pl-3 pr-10'/>
              {
              showConfirmPassword 
              ?
              <FaEyeSlash
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowConfirmPassword(false)}
              />
              :
              <FaEye
              className="absolute right-3 cursor-pointer"
              onClick={() => setShowConfirmPassword(true)}
              />
              }
            </div>

            {formData.confirmPassword && (
              <p className={passwordMatch ? "text-green-500 text-sm" : "text-red-500 text-sm"}>
                  {passwordMatch 
                      ? "✓ Passwords match" 
                      : "✗ Passwords do not match"
                  }
              </p>
              )}
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Full Names</h2>
            <div className='items-center w-161'>
              <input name="fullName" type="text" required value={formData.fullName} onChange={handleChange} placeholder='Please enter full names.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Surname</h2>
            <div className='items-center w-161'>
              <input name="surname" type="text" required value={formData.surname} onChange={handleChange} placeholder='Please enter your surname.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Country</h2>
            <div className='items-center w-161'>
              <input name="country" type="text" required value={formData.country} onChange={handleChange} placeholder='e.g South Africa.' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            <h2>Phone Number</h2>
            <div className='items-center w-161'>
              <input name="phoneNumber" type="text" required value={formData.phoneNumber} onChange={handleChange} placeholder='e.g +27 712 345 6789' className='h-13 w-full bg-gray-900 rounded-2xl pl-3 text-white focus:outline-none'/>
            </div>
          </div>
          
            {error && (
              <p className="text-red-500 text-base mt-1">
                {error}
              </p>
            )}

            {message && (
              <p className="text-green-500 text-base mt-1">
                {message}
              </p>
            )}

          <button type="submit" className='h-13 w-160 mt-3 bg-blue-600 rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed' disabled={loading}>{loading ? "Registering..." : "Register"}</button>
          <p className='pl-50'>Already have an account? <Link to="/signin" className='text-blue-500'>Log In</Link></p>
        </form>
      </div>
    </div>
  )
}

export default Signup