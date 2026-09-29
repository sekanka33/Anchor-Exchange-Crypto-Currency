import { useEffect, useState } from "react";
import { FaEye, FaQrcode } from 'react-icons/fa'
import { Link, useNavigate } from 'react-router-dom'
import { io } from "socket.io-client";
import { API_BASE_URL } from "../api/config";

  const Signin = () => {

  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);

  // QR States
  const [qrCode, setQrCode] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [loadingQR, setLoadingQR] = useState(false);

  // Login States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Error State
  const [error, setError] = useState("");

  useEffect(() => {

    handleGenerateQR();

    const interval = setInterval(() => {
        handleGenerateQR();
    }, 60000);


    return () => clearInterval(interval);

}, []);


  useEffect(()=>{


    return ()=>{

        if(socket){
            socket.disconnect();
        }

    }


  },[socket]);

const handleGenerateQR = async () => {

    setLoadingQR(true);

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/qr/init`
        );

        const data = await response.json();

        if (!response.ok) {
            setError(data.message);
            return;
        }

        setQrCode(data.qrCode);
        setQrToken(data.qr_token);

        connectWebSocket(data.qr_token);

    } catch {

        setError("Unable to generate QR Code.");

    } finally {

        setLoadingQR(false);

    }

};

const connectWebSocket = (qr_token) => {


    if(socket){
        socket.disconnect();
    }


    const newSocket = io(
        API_BASE_URL
    );


    newSocket.on(
        "connect",
        ()=>{


            console.log(
                "Socket connected:",
                newSocket.id
            );


            newSocket.emit(
                "join_qr",
                qr_token
            );


            console.log(
                "Joined QR room:",
                qr_token
            );


        }
    );



    newSocket.on(
        "qr-login-success",
        (data)=>{


            console.log(
                "QR LOGIN SUCCESS",
                data
            );


            localStorage.setItem("token", data.token);
            if (data.user?.id) {
                localStorage.setItem("userId", data.user.id);
            }
            if (data.user?.role) {
                localStorage.setItem("role", data.user.role);
            }


            navigate(
                "/dashboard"
            );


            newSocket.disconnect();

        }
    );


    setSocket(newSocket);

};

const handleLogin = async (e) => {

    e.preventDefault();

    setError("");

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            setError(data.message);
            return;
        }

        localStorage.setItem("token", data.token);
        if (data.user?.id) {
            localStorage.setItem("userId", data.user.id);
        }
        if (data.user?.role) {
            localStorage.setItem("role", data.user.role);
        }

        navigate("/dashboard");

    } catch {

        setError("Server error");

    }

};


  return (
    <div>
      <div className='hidden xl:block pr-20 pl-20 pt-10 h-27 w-full bg-slate-100 dark:bg-dark-void text-slate-900 dark:text-white'>
        <h1 className='text-2xl font-semibold'>Sign-In</h1>
      </div>

      <div className='hidden xl:block relative'>
        <div className='flex justify-center'>
          <div className='flex flex-col items-center'>

            <div className='items-center text-center'>
              <h2 className='text-3xl font-semibold pt-18'>Log In to Anchor Exchange</h2>
              <p className='pt-3'>Welcome back! Log In now to start trading</p>

              <div className='flex gap-6 justify-center pt-5'>
                <div className='border-2 border-blue-500 hover:bg-blue-600 h-8 w-19 text-center rounded-full'>
                  <p>Email</p>
                </div>

                <div className='border-2 border-blue-500 hover:bg-blue-600 h-8 w-19 text-center rounded-full'>
                  <p>Mobile</p>
                </div>
              </div>

            </div>


            <form onSubmit={handleLogin} className='hidden xl:block text-center pt-13'>
              <p className='pr-108'>Email</p>
              <input 
                type="text"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                aria-label="Email" autoComplete="email" placeholder='Please fill in the email form.' 
                className='w-120 h-13 rounded-2xl bg-slate-100 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-900 text-slate-900 dark:text-white pt-1 pl-4 mt-2'
              />
              <p className='pr-101 pt-7'>Password</p>

              <div className='relative w-120 mx-auto mt-2'>
                <input 
                  type="password"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  aria-label="Password" autoComplete="current-password" placeholder='Please enter a password.' 
                  className='w-full h-13 rounded-2xl bg-slate-100 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-900 text-slate-900 dark:text-white pt-1 pl-4 pr-12'
                />
                <FaEye className='absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-200'/>
              </div>

              <div className='flex gap-52 pt-2 justify-center'>
                <label className='flex gap-2 items-center cursor-pointer'>
                  <input type="checkbox" />
                  <span>Remember Me</span>
                </label>
                <Link to="/forgot-password" className='text-red-700 dark:text-red-400 underline'>Forgot Password?</Link>

              </div>
              
              {
              error && (
              <p role="alert" className="text-red-700 dark:text-red-400 mt-3">
                {error}
              </p>
              )
              }

              <button type='submit' className='w-120 h-10 mt-6 bg-blue-600 rounded-3xl text-white'>LogIn</button>
              <p className='mt-4'>Not a member?<Link to="/signup" className='text-blue-700 dark:text-blue-400 ml-2 underline'>Register</Link></p>
            </form>

          </div>
        </div>

        {/* This is a Section that will a users use QR code to Log-In  */}
        <div className='hidden xl:flex flex-col absolute right-42 top-40 items-center'>
          {
            qrCode ? (
                <img
                    src={qrCode}
                    alt="QR Login"
                    className="w-52 h-52 rounded-xl border border-gray-300 bg-white p-2"
                />
            ) : (
                <FaQrcode className="text-9xl text-gray-400" />
            )
          }
          <h2 className='text-2xl font-semibold mt-5'>Login with QR code</h2>
          <p className='text-center mt-2'>Scan this code with your phone <br />to log in instantly.</p>
        </div>

      </div>

      {/* mobile */}
      <div className='xl:hidden pl-7 pt-6 h-20 w-full bg-slate-100 dark:bg-dark-void text-slate-900 dark:text-white'>
        <h1 className='text-xl font-semibold'>Sign-In</h1>
      </div>

      <div className='xl:hidden relative px-4'>
        <div className='flex justify-center'>
          <div className='flex flex-col items-center w-full'>

            <div className='items-center text-center'>
              <h2 className='text-xl font-semibold pt-12'>Log In to Anchor Exchange</h2>
              <p className='pt-3 text-base'>Welcome back! Log In now <br /> to start trading</p>

              <div className='flex gap-6 justify-center pt-5'>
                <div className='border-2 border-blue-500 hover:bg-blue-600 h-7 w-17 text-center rounded-full'>
                  <p className='text-base'>Email</p>
                </div>

                <div className='border-2 border-blue-500 hover:bg-blue-600 h-7 w-17 text-center rounded-full'>
                  <p className='text-base'>Mobile</p>
                </div>
              </div>

            </div>


            <form onSubmit={handleLogin} className='text-center pt-13 pb-10 w-full max-w-95 mx-auto'>
              <p className='text-base'>Email</p>
              <input
                type="text"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                aria-label="Email" autoComplete="email" placeholder='Please fill in the email form.'
                className='w-full h-13 rounded-2xl bg-slate-100 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-900 text-slate-900 dark:text-white pt-1 pl-4 mt-2'
              />
              <p className='pt-7 text-base'>Password</p>

              <div className='relative w-full mx-auto mt-2'>
                <input
                  type="password"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  aria-label="Password" autoComplete="current-password" placeholder='Please enter a password.'
                  className='w-full h-13 rounded-2xl bg-slate-100 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-900 text-slate-900 dark:text-white pt-1 pl-4 pr-12'
                />
                <FaEye className='absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-200'/>
              </div>

              <div className='flex gap-3 flex-wrap pt-2 justify-between'>
                <label className='flex gap-2 items-center cursor-pointer'>
                  <input type="checkbox" />
                  <span className='text-sm'>Remember Me</span>
                </label>
                <Link to="/forgot-password" className='text-red-700 dark:text-red-400 text-sm underline'>Forgot Password?</Link>

              </div>
              <button type='submit' className='w-full h-10 mt-6 bg-blue-600 rounded-3xl text-white'>LogIn</button>
              <p className='mt-4 text-sm'>Not a member?<Link to="/signup" className='text-blue-700 dark:text-blue-400 ml-2 underline'>Register</Link></p>
            </form>

          </div>
        </div>

      </div>
      
    </div>

    
  )
}

export default Signin