import { lazy, Suspense, useEffect, useRef } from 'react'
import Navbar from './Components/Navbar'
import Footer from './Components/Footer'
const Assets = lazy(() => import('./Pages/Assets'))
const Blog = lazy(() => import('./Pages/Blog'))
const HelpCenter = lazy(() => import('./Pages/HelpCenter'))
const BuyCrypto = lazy(() => import('./Pages/BuyCrypto'))
const Exchange = lazy(() => import('./Pages/Exchange'))
const Home = lazy(() => import('./Pages/Home'))
const Markets = lazy(() => import('./Pages/Markets'))
const OrdersTrades = lazy(() => import('./Pages/OrdersTrades'))
const Spot = lazy(() => import('./Pages/Spot'))
const Wallet = lazy(() => import('./Pages/Wallet'))
import { Route, Routes, useLocation } from 'react-router-dom'
const Bitusdt = lazy(() => import('./Pages/Bitusdt'))
const Pages = lazy(() => import('./Pages/Pages'))
const Signin = lazy(() => import('./Pages/Signin'))
const Enusd = lazy(() => import('./Pages/Enusd'))
const Notifications = lazy(() => import('./Pages/Notifications'))
import { ThemeProvider } from './Components/ThemeProvider'
const Signup = lazy(() => import('./Pages/Signup'))
const Dashboard = lazy(() => import('./Pages/Dashboard'))
const QRAuth = lazy(() => import('./Pages/QRAuth'))
const Contact = lazy(() => import('./Pages/Contact'))
const Overview = lazy(() => import('./Pages/Overview'))
const SellCrypto = lazy(() => import('./Pages/SellCrypto'))
const DepositFiat = lazy(() => import('./Pages/DepositFiat'))
const CryptoDeposit = lazy(() => import('./Pages/CryptoDeposit'))
const CryptoWithdraw = lazy(() => import('./Pages/CryptoWithdraw'))
const FiatWithdraw = lazy(() => import('./Pages/FiatWithdraw'))
const WithdrawalConfirm = lazy(() => import('./Pages/WithdrawalConfirm'))
const TransactionHistory = lazy(() => import('./Pages/TransactionHistory'))
const AdminDashboard = lazy(() => import('./Pages/AdminDashboard'))
const ProfileAndSetting = lazy(() => import('./Pages/ProfileAndSetting'))
const Forgot = lazy(() => import('./Pages/Forgot'))
const ResetPassword = lazy(() => import('./Pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./Pages/VerifyEmail'))
import ProtectedRoute from './Components/ProtectedRoute'

const PAGE_TITLES = {
  '/': 'Home',
  '/markets': 'Markets',
  '/exchange': 'Exchange',
  '/signin': 'Sign In',
  '/signup': 'Create Account',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  '/verify-email': 'Verify Email',
  '/qr-auth': 'QR Sign In',
  '/contact': 'Contact',
  '/blog': 'Blog',
  '/faq': 'FAQ',
  '/overview': 'Overview',
  '/buy-crypto': 'Buy Crypto',
  '/sell-crypto': 'Sell Crypto',
  '/wallet': 'Wallet',
  '/dashboard': 'Dashboard',
  '/orderstrades': 'Orders & Trades',
  '/notifications': 'Notifications',
  '/deposit': 'Deposit Fiat',
  '/deposit/crypto': 'Deposit Crypto',
  '/withdraw': 'Withdraw Fiat',
  '/withdraw/crypto': 'Withdraw Crypto',
  '/withdrawals/confirm': 'Confirm Withdrawal',
  '/transactions': 'Transaction History',
  '/admin': 'Admin',
  '/profile-setting': 'Profile & Settings',
}

const App = () => {

  const location = useLocation();

  const isDashboard = location.pathname === "/dashboard";
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const page = PAGE_TITLES[location.pathname];
    document.title = page ? `${page} | Anchor Exchange` : 'Anchor Exchange';
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <ThemeProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      {
        !isDashboard && (
          <header>
            <Navbar />
          </header>
        )
      }
      <main id="main-content" ref={mainRef} tabIndex={-1} className="outline-none">
        <Suspense fallback={<p role="status" className="p-8 text-center">Loading…</p>}>
        <Routes>

          {/* PUBLIC */}
          <Route path="/" element={<Home />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/spot" element={<Spot />} />
          <Route path="/bitusdt" element={<Bitusdt />} />
          <Route path="/pages" element={<Pages />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/enusd" element={<Enusd />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/buy-crypto" element={<BuyCrypto />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/faq" element={<HelpCenter />} />

          {/* AUTH */}
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/qr-auth" element={<QRAuth />} />

          {/* PROTECTED */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />

          <Route
            path="/orderstrades"
            element={
              <ProtectedRoute>
                <OrdersTrades />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sell-crypto"
            element={
              <ProtectedRoute>
                <SellCrypto />
              </ProtectedRoute>
            }
          />

          <Route
            path="/deposit"
            element={
              <ProtectedRoute>
                <DepositFiat />
              </ProtectedRoute>
            }
          />

          <Route
            path="/deposit/crypto"
            element={
              <ProtectedRoute>
                <CryptoDeposit />
              </ProtectedRoute>
            }
          />

          <Route
            path="/withdraw"
            element={
              <ProtectedRoute>
                <FiatWithdraw />
              </ProtectedRoute>
            }
          />

          <Route
            path="/withdraw/crypto"
            element={
              <ProtectedRoute>
                <CryptoWithdraw />
              </ProtectedRoute>
            }
          />

          <Route
            path="/withdrawals/confirm"
            element={
              <ProtectedRoute>
                <WithdrawalConfirm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <TransactionHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile-setting"
            element={
              <ProtectedRoute>
                <ProfileAndSetting />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

        </Routes>
        </Suspense>
      </main>
      {
        !isDashboard && <Footer />
      }
    </ThemeProvider>
  )
}

export default App
