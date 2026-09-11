import React from 'react'
import { FaCamera } from 'react-icons/fa'
import { Link } from 'react-router-dom'

const ProfileAndSetting = () => {
  return (
    <div>
      <div className="pr-20 pl-20 pt-10 h-27 w-full bg-mist-900">
        <h1 className="text-2xl font-semibold">
          User Profile
        </h1>
      </div>

      <div className='flex flex-row gap-15 pt-25 pr-20 pl-20'>
        {/* side navbar */}
        <div>
            <div className="flex flex-col items-center">
                <div className="relative">
                    <div className="w-30 h-30 rounded-full bg-image-color"></div>

                    <div className="w-8 h-8 rounded-full bg-blue-500 flex justify-center items-center absolute bottom-1 left-22">
                        <FaCamera />
                    </div>
                </div>
            </div>

            <div className="text-center pr-1 pl-1 pt-5">
                <p className="font-bold">Thapelo Amos Sekanka</p>
                <p className="text-text-color">thsekanka@gmail.com</p>
            </div>

            <div className="flex flex-col gap-7 pt-10">

            {/* Current page */}
            <div className="w-full h-12 bg-blue-500 rounded-lg flex flex-row gap-3 items-center px-4">
                <img src="/src/assets/Group.png" alt="" />
                <Link>
                    <p className="font-bold">User Profile</p>
                </Link>
            </div>

            <div className="flex flex-row gap-3 items-center">
                <img src="/src/assets/refrel.png" alt="" />
                <Link>
                    <p className="font-bold">Referrals</p>
                </Link>
            </div>

            <div className="flex flex-row gap-3 items-center">
                <img src="/src/assets/api.png" alt="" />
                <Link>
                    <p className="font-bold">API keys</p>
                </Link>
            </div>

            <div className="flex flex-row gap-3 items-center">
                <img src="/src/assets/history.png" alt="" />
                <Link>
                    <p className="font-bold">Login history</p>
                </Link>
            </div>

            <div className="flex flex-row gap-3 items-center">
                <img src="/src/assets/2FA.png" alt="" />
                <Link>
                    <p className="font-bold">2FA</p>
                </Link>
            </div>

            <div className="flex flex-row gap-3 items-center">
                <img src="/src/assets/password.png" alt="" />
                <Link>
                    <p className="font-bold">Change password</p>
                </Link>
            </div>

        </div>
        </div>

        <div className="h-140 w-0 border-r-2 border-line-color"></div>

        {/* main content */}
        <div>

        </div>
      </div>
    </div>
  )
}

export default ProfileAndSetting
