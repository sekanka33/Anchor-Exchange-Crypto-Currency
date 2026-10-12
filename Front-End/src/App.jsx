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
const Signin = lazy(() => import('./Pages/Signin'))
const Notifications = lazy(() => import('./Pages/Notifications'))
import { ThemeProvider } from './Components/ThemeProvider'
import { CurrencyProvider } from './Components/CurrencyProvider'
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
const About = lazy(() => import('./Pages/About'))
const Careers = lazy(() => import('./Pages/Careers'))
const NotFound = lazy(() => import('./Pages/NotFound'))
import ProtectedRoute, { CustomerRoute, GuestRoute } from './Components/ProtectedRoute'
import { AuthProvider } from './Components/AuthProvider'
import { useAuth } from './hooks/useAuth'

const PAGE_TITLES = {
  '/': 'Home',
  '/markets': 'Markets',
  '/exchange': 'Exchange',
  '/spot': 'Spot',
  '/bitusdt': 'BIT/USDT',
  '/assets': 'Assets',
  '/about': 'About',
  '/careers': 'Careers',
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

const AppShell = () => {

  const location = useLocation();
  const auth = useAuth();

  // The customer navbar and footer are hidden on the two pages with their
  // own full-screen layout, for administrators everywhere (they only use the
  // admin app), and while a stored session is still being verified (so no
  // one sees chrome that their role might not get).
  const hasOwnLayout = location.pathname === "/dashboard" || location.pathname === "/admin";
  const sessionPending = auth.status === "loading" || auth.status === "error";
  const showSiteChrome = !hasOwnLayout && !sessionPending && auth.user?.role !== "admin";
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  // Every navigation starts at the top (footer links would otherwise land
  // mid-page, even when they point at the current page); #hash links are
  // scrolled by the page that owns the anchor.
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.key, location.hash]);

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
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      {/* Full-height column: main grows to fill the space between navbar and
          footer, so short pages keep the footer at the bottom of the viewport. */}
      <div className="flex min-h-dvh flex-col">
      {
        showSiteChrome && (
          <header className="sticky top-0 z-40">
            <Navbar />
          </header>
        )
      }
      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Suspense fallback={<p role="status" className="p-8 text-center">Loading…</p>}>
        <Routes>

          {/* CUSTOMER APP, open to visitors. Admins are sent to /admin.
              /withdrawals/confirm is the emailed confirmation link, which
              works without being signed in. */}
          <Route path="/" element={<CustomerRoute><Home /></CustomerRoute>} />
          <Route path="/markets" element={<CustomerRoute><Markets /></CustomerRoute>} />
          <Route path="/exchange" element={<CustomerRoute><Exchange /></CustomerRoute>} />
          <Route path="/spot" element={<CustomerRoute><Spot /></CustomerRoute>} />
          <Route path="/bitusdt" element={<CustomerRoute><Bitusdt /></CustomerRoute>} />
          <Route path="/assets" element={<CustomerRoute><Assets /></CustomerRoute>} />
          <Route path="/overview" element={<CustomerRoute><Overview /></CustomerRoute>} />
          <Route path="/buy-crypto" element={<CustomerRoute><BuyCrypto /></CustomerRoute>} />
          <Route path="/contact" element={<CustomerRoute><Contact /></CustomerRoute>} />
          <Route path="/blog" element={<CustomerRoute><Blog /></CustomerRoute>} />
          <Route path="/faq" element={<CustomerRoute><HelpCenter /></CustomerRoute>} />
          <Route path="/about" element={<CustomerRoute><About /></CustomerRoute>} />
          <Route path="/careers" element={<CustomerRoute><Careers /></CustomerRoute>} />
          <Route path="/withdrawals/confirm" element={<CustomerRoute><WithdrawalConfirm /></CustomerRoute>} />

          {/* SIGN IN / SIGN UP: one login page for every role; GuestRoute
              sends a signed-in session to the right app. */}
          <Route path="/signin" element={<GuestRoute><Signin /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />

          {/* ACCOUNT LINKS (emailed/QR), usable in any state */}
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/qr-auth" element={<QRAuth />} />

          {/* CUSTOMER APP, signed-in users only */}
          <Route path="/dashboard" element={<ProtectedRoute role="user"><Dashboard /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute role="user"><Wallet /></ProtectedRoute>} />
          <Route path="/orderstrades" element={<ProtectedRoute role="user"><OrdersTrades /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute role="user"><Notifications /></ProtectedRoute>} />
          <Route path="/sell-crypto" element={<ProtectedRoute role="user"><SellCrypto /></ProtectedRoute>} />
          <Route path="/deposit" element={<ProtectedRoute role="user"><DepositFiat /></ProtectedRoute>} />
          <Route path="/deposit/crypto" element={<ProtectedRoute role="user"><CryptoDeposit /></ProtectedRoute>} />
          <Route path="/withdraw" element={<ProtectedRoute role="user"><FiatWithdraw /></ProtectedRoute>} />
          <Route path="/withdraw/crypto" element={<ProtectedRoute role="user"><CryptoWithdraw /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute role="user"><TransactionHistory /></ProtectedRoute>} />
          <Route path="/profile-setting" element={<ProtectedRoute role="user"><ProfileAndSetting /></ProtectedRoute>} />

          {/* ADMIN APP, administrators only */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

          <Route path="*" element={<CustomerRoute><NotFound /></CustomerRoute>} />

        </Routes>
        </Suspense>
      </main>
      {
        showSiteChrome && <Footer />
      }
      </div>
    </>
  )
}

const App = () => (
  <ThemeProvider>
  <CurrencyProvider>
  <AuthProvider>
    <AppShell />
  </AuthProvider>
  </CurrencyProvider>
  </ThemeProvider>
)

export default App
