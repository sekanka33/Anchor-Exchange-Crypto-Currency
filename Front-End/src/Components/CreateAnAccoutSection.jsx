import { Link } from "react-router-dom";

const CreateAnAccoutSection = () => {
  return (
    <div className='w-full h-auto md:h-35 bg-hero-dark text-white px-4 md:pl-25 md:pr-25 flex flex-col md:flex-row md:justify-between gap-4 py-8 md:pt-12 md:py-0'>
        <div>
            <p className='text-2xl'>Earn up to $25 worth of crypto</p>
            <p className='text-gray-400'>Discover how specific cryptocurrencies work — and get a bit of each crypto to try out for yourself.</p>
        </div>
        <div className='flex-shrink-0'>
            <Link to="/signup"><button className='w-40 h-11 bg-white rounded-full text-black font-semibold'>Create Account</button></Link>
        </div>
    </div>
  )
}

export default CreateAnAccoutSection
