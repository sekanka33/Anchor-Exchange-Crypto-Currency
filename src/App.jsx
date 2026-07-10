import React, { useState } from 'react'
import Navbar from './Components/Navbar'
import Footer from './Components/Footer'
import About from './Pages/About'
import Assets from './Pages/Assets'
import Blog from './Pages/Blog'
import BuyCrypto from './Pages/BuyCrypto'
import Careers from './Pages/Careers'
import Exchange from './Pages/Exchange'
import HelpCenter from './Pages/HelpCenter'
import Home from './Pages/Home'
import Markets from './Pages/Markets'
import OrdersTrades from './Pages/OrdersTrades'
import Spot from './Pages/Spot'
import Wallet from './Pages/Wallet'
import { Route, Routes } from 'react-router-dom'


const App = () => {

  const [darkAndWhiteMode, setDarkAndWhiteMode] = useState(false);

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
      <Footer />
    </>
  )
}

export default App
