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
import Bitusdt from './Pages/Bitusdt'
import Pages from './Pages/Pages'
import Signin from './Pages/Signin'
import Enusd from './Pages/Enusd'
import Notifications from './Pages/Notifications'
import { ThemeProvider } from './Components/ThemeProvider'
import Signup from './Pages/Signup'


const App = () => {

  return (
    <ThemeProvider>
      <header>
        <Navbar />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path='/buy-Crypto' element={<BuyCrypto />} />
          <Route path='/markets' element={<Markets />} />
          <Route path='/exchange' element={<Exchange />} />
          <Route path='/spot' element={<Spot />} />
          <Route path='/bitusdt' element={<Bitusdt />} />
          <Route path='/pages' element={<Pages />} />
          <Route path='/assets' element={<Assets />} />
          <Route path='/orderstrades' element={<OrdersTrades />} />
          <Route path='/enusd' element={<Enusd />} />
          <Route path='/notifications' element={<Notifications />} />
          <Route path='/wallet' element={<Wallet />} />
          <Route path='/signin' element={<Signin />} />
          <Route path='/signup' element={<Signup />} />
        </Routes>
      </main>
      <Footer />
    </ThemeProvider>
  )
}

export default App
