import { useState, useEffect, useMemo } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ArrowUpRight,
  Globe,
  Home,
  ShoppingCart,
  BarChart2,
  Repeat,
  Zap,
  Briefcase,
  List,
  Wallet,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  Shield,
  Activity,
  Menu,
  X,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';
import useNotificationSocket from '../hooks/useNotificationSocket';
import CurrencySelect from '../Components/CurrencySelect';
import { authFetch } from '../api/authFetch';
import { useApi } from '../hooks/useApi';
import { Card, CardTitle, PanelMessage, StatCard } from '../Components/DashboardUI';
import BarChart from '../Components/BarChart';
import TradingViewChart from '../Components/TradingViewChart';
import { PAIRS, FEE_RATE, MIN_TRADE_USD, MAX_TRADE_USD } from '../api/tradingPairs';
import { getBinanceTicker, getBinanceOrderBook, getBinanceTrades } from '../api/coingecko';


// TradingView intervals
const TIMEFRAMES = [
  { label: '5m', value: '5' },
  { label: '30m', value: '30' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: 'D', value: 'D' },
  { label: 'W', value: 'W' },
  { label: 'M', value: 'M' },
];


const NAV_MAIN = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Home', to: '/', icon: Home, end: true },
  { name: 'Buy Crypto', to: '/buy-crypto', icon: ShoppingCart },
  { name: 'Market', to: '/markets', icon: BarChart2 },
  { name: 'Exchange', to: '/exchange', icon: Repeat },
  { name: 'Spot', to: '/spot', icon: Zap },
];

const NAV_SECONDARY = [
  { name: 'Assets', to: '/assets', icon: Briefcase },
  { name: 'Orders & Trades', to: '/orderstrades', icon: List },
  { name: 'Wallet', to: '/wallet', icon: Wallet },
];

const ACTIVITY_METRICS = [
  { key: 'volumeUsd', label: 'Trading volume' },
  { key: 'depositsUsd', label: 'Fiat deposits' },
  { key: 'withdrawalsUsd', label: 'Fiat withdrawals' },
];

const formatAmount = (value, digits = 6) =>
  Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });

const formatCount = (value) => Number(value || 0).toLocaleString('en-US');

const formatDay = (isoDay) =>
  new Date(`${isoDay}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const SidebarNav = ({ onNavigate }) => {
  const linkClass = ({ isActive }) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
      isActive
        ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
        : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-hero-dark hover:text-slate-900 dark:hover:text-white'
    }`;

  const renderItems = (items) =>
    items.map(({ name, to, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} onClick={onNavigate} className={linkClass}>
        <Icon size={18} aria-hidden="true" />
        <span>{name}</span>
      </NavLink>
    ));

  return (
    <nav aria-label="Dashboard" className="space-y-1">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-text-color tracking-wider uppercase px-3 mb-2">Main Menu</p>
      {renderItems(NAV_MAIN)}
      <p className="text-[11px] font-semibold text-gray-500 dark:text-text-color tracking-wider uppercase px-3 mt-6 mb-2">Secondary</p>
      {renderItems(NAV_SECONDARY)}
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

// Single-series daily bar chart (one metric at a time, so one axis).
const ActivityChart = ({ daily, metric, formatMoney }) => {
  const total = daily.reduce((sum, d) => sum + d[metric.key], 0);
  return (
    <div>
      {total > 0 && (
        <p className="text-xs text-gray-500 dark:text-text-color mb-3">
          {daily.length}-day total: <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(total)}</span>
        </p>
      )}
      <BarChart
        data={daily.map((d) => ({ key: d.day, label: formatDay(d.day), values: { v: d[metric.key] } }))}
        series={[{ key: 'v', label: metric.label }]}
        formatValue={(v) => formatMoney(v)}
        formatAxis={(v) => formatMoney(v, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })}
        emptyMessage={`No ${metric.label.toLowerCase()} in the last ${daily.length || 30} days.`}
        caption={`${metric.label} per day`}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function Dashboard() {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { currency, formatMoney } = useCurrency();
  const role = localStorage.getItem('role');

  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [pairMenuOpen, setPairMenuOpen] = useState(false);
  const [pairSearch, setPairSearch] = useState('');
  const [timeframe, setTimeframe] = useState('60');
  const [ordersTab, setOrdersTab] = useState('HISTORY');
  const [activityMetric, setActivityMetric] = useState(ACTIVITY_METRICS[0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Trade form
  const [tradeType, setTradeType] = useState('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tradeMessage, setTradeMessage] = useState(null); // { kind: 'success' | 'error', text }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    navigate('/signin');
  };

  /* ---------------- Data ---------------- */

  const profile = useApi(() => authFetch('/api/users/profile').then((d) => d.user), []);
  const wallet = useApi(() => authFetch('/api/wallet'), []);
  const stats = useApi(() => authFetch('/api/users/stats'), []);
  const adminStats = useApi(() => authFetch('/api/admin/stats'), [], { enabled: role === 'admin' });

  const orders = useApi(() => {
    const params = new URLSearchParams({ limit: '5' });
    if (ordersTab === 'OPEN') params.set('status', 'OPEN');
    if (ordersTab === 'CLOSED') params.set('status', 'COMPLETED');
    return authFetch(`/api/orders?${params.toString()}`).then((d) => d.orders || []);
  }, [ordersTab]);

  // Live market data for every tradable pair (cached server-side).
  const tickers = useApi(async () => {
    const results = await Promise.allSettled(PAIRS.map((p) => getBinanceTicker(p.symbol)));
    const map = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') map[PAIRS[i].symbol] = r.value;
    });
    if (Object.keys(map).length === 0) throw new Error('Market data unavailable');
    return map;
  }, [], { pollMs: 15000 });

  const orderBook = useApi(() => getBinanceOrderBook(selectedPair.symbol, 10), [selectedPair.symbol], { pollMs: 5000 });
  const trades = useApi(
    () => getBinanceTrades(selectedPair.symbol, 12).then((list) => [...list].reverse()),
    [selectedPair.symbol],
    { pollMs: 5000 }
  );

  useEffect(() => {
    authFetch('/api/notifications?limit=1')
      .then((d) => setUnreadCount(d.unreadCount || 0))
      .catch(() => {});
  }, []);

  // Real-time badge bump when the backend creates a notification.
  useNotificationSocket(() => setUnreadCount((c) => c + 1));

  const ticker = tickers.data?.[selectedPair.symbol];
  const lastPrice = ticker ? Number(ticker.lastPrice) : null;
  const changePct = ticker ? Number(ticker.priceChangePercent) : null;

  /* ---------------- Trade form ---------------- */

  const assetBalance = useMemo(
    () => wallet.data?.balances?.find((b) => b.assetSymbol === selectedPair.asset)?.availableBalance ?? 0,
    [wallet.data, selectedPair.asset]
  );

  const numericAmount = Number(tradeAmount) || 0;
  // Buy: amount is USD to spend. Sell: amount is crypto to sell.
  const estimate = lastPrice
    ? tradeType === 'buy'
      ? numericAmount / lastPrice
      : numericAmount * lastPrice * (1 - FEE_RATE)
    : 0;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setTradeMessage(null);

    if (numericAmount <= 0) {
      setTradeMessage({ kind: 'error', text: 'Enter an amount greater than zero.' });
      return;
    }

    setSubmitting(true);
    try {
      const body =
        tradeType === 'buy'
          ? { asset: selectedPair.asset, amountUsd: numericAmount, paymentMethod: 'card' }
          : { asset: selectedPair.asset, amount: numericAmount };
      const data = await authFetch(`/api/orders/${tradeType}`, { method: 'POST', body: JSON.stringify(body) });

      setTradeMessage({
        kind: 'success',
        text: `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${formatAmount(data.order.amount, 8)} ${selectedPair.asset} at ${formatMoney(data.order.price)}.`,
      });
      setTradeAmount('');
      wallet.reload();
      orders.reload();
      stats.reload();
    } catch (err) {
      setTradeMessage({ kind: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const selectPair = (pair) => {
    setSelectedPair(pair);
    setPairMenuOpen(false);
    setTradeAmount('');
    setTradeMessage(null);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = pairSearch.trim().toUpperCase();
    if (!q) return;
    const match = PAIRS.find((p) => p.asset === q || p.symbol === q || p.name.toUpperCase().startsWith(q));
    if (match) {
      selectPair(match);
      setPairSearch('');
    } else {
      navigate('/markets');
    }
  };

  /* ---------------- Derived view data ---------------- */

  const heldBalances = (wallet.data?.balances || []).filter((b) => b.totalBalance > 0);
  const daily = stats.data?.daily || [];
  const s = stats.data;

  const initials = profile.data
    ? `${profile.data.fullname?.[0] || ''}${profile.data.surname?.[0] || ''}`.toUpperCase() || profile.data.email?.[0]?.toUpperCase()
    : '';
  const displayName = profile.data
    ? [profile.data.fullname, profile.data.surname].filter(Boolean).join(' ') || profile.data.email
    : '';

  const statusBadge = (status) => {
    if (status === 'COMPLETED') {
      return (
        <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
          <CheckCircle size={14} aria-hidden="true" /> Completed
        </span>
      );
    }
    if (status === 'OPEN') {
      return (
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <Clock size={14} aria-hidden="true" /> Open
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <XCircle size={14} aria-hidden="true" /> {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );
  };

  const maxBookQty = useMemo(() => {
    const rows = [...(orderBook.data?.bids || []), ...(orderBook.data?.asks || [])];
    return Math.max(...rows.map(([, qty]) => Number(qty)), 0);
  }, [orderBook.data]);

  const renderBookRows = (rows, side) =>
    rows.map(([price, qty]) => (
      <div key={`${side}-${price}`} className="relative grid grid-cols-3 text-xs font-mono py-0.5 tabular-nums">
        <span
          className={`absolute inset-y-0 right-0 ${side === 'ask' ? 'bg-red-500/10' : 'bg-green-500/10'}`}
          style={{ width: `${maxBookQty ? (Number(qty) / maxBookQty) * 100 : 0}%` }}
          aria-hidden="true"
        />
        <span className={`relative font-bold ${side === 'ask' ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
          {formatMoney(price)}
        </span>
        <span className="relative text-right text-gray-700 dark:text-gray-300">{formatAmount(qty, 5)}</span>
        <span className="relative text-right text-gray-500 dark:text-text-color">{formatMoney(Number(price) * Number(qty))}</span>
      </div>
    ));

  /* ---------------- Render ---------------- */

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-hero-dark text-slate-900 dark:text-gray-100">
      <h1 className="sr-only">Dashboard</h1>

      {/* MOBILE NAV OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex">
          <div className="w-64 p-5 flex flex-col justify-between border-r bg-white dark:bg-dark-void border-gray-200 dark:border-line-color overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-8">
                <Link to="/" className="text-lg font-bold tracking-wide text-slate-900 dark:text-white hover:text-blue-500">
                  Anchor Exchange
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-500 hover:text-slate-900 dark:hover:text-white"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              <SidebarNav onNavigate={() => setMobileMenuOpen(false)} />
            </div>

            <button
              onClick={handleLogout}
              className="mt-6 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
          <button className="flex-1" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col justify-between border-r p-5 shrink-0 sticky top-0 h-screen bg-white dark:bg-dark-void border-gray-200 dark:border-line-color">
          <div>
            <div className="mb-8 px-2">
              <Link to="/" className="text-lg font-bold tracking-wide text-slate-900 dark:text-white hover:text-blue-500">
                Anchor Exchange
              </Link>
            </div>
            <SidebarNav />
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-line-color">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* MAIN DISPLAY BODY */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 border-b px-4 lg:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 bg-white dark:bg-crypto-color border-gray-200 dark:border-line-color">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg bg-gray-100 dark:bg-input-field text-gray-700 dark:text-gray-300"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              {/* Pair search */}
              <form onSubmit={handleSearch} className="relative hidden md:block w-72" role="search">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  placeholder="Search a coin (e.g. ETH) and press Enter"
                  aria-label="Search a coin"
                  className="w-full rounded-xl pl-9 pr-4 py-1.5 text-xs border focus:outline-none focus:border-blue-500 bg-gray-100 dark:bg-input-field border-gray-300 dark:border-line-color text-slate-900 dark:text-gray-100 placeholder-gray-500"
                />
              </form>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl px-2.5 py-1 text-xs border bg-gray-100 dark:bg-input-field border-gray-300 dark:border-line-color">
                <Globe size={14} className="mr-1.5 text-gray-400" aria-hidden="true" />
                <CurrencySelect className="text-xs" />
              </div>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl border transition bg-gray-100 dark:bg-input-field border-gray-300 dark:border-line-color text-gray-700 dark:text-gray-300 hover:text-blue-500"
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <Link
                to="/notifications"
                className="relative p-2 rounded-xl border transition bg-gray-100 dark:bg-input-field border-gray-300 dark:border-line-color text-gray-700 dark:text-gray-300 hover:text-blue-500"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link to="/profile-setting" className="flex items-center gap-2 pl-2 border-l border-gray-300 dark:border-line-color">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                  {initials || '·'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold leading-none">
                    {profile.loading ? 'Loading…' : displayName || 'Account'}
                  </p>
                  {profile.data && (
                    <p className={`text-[10px] mt-0.5 flex items-center ${profile.data.is_verified ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      <Shield size={10} className="mr-0.5" aria-hidden="true" />
                      {profile.data.is_verified ? 'Verified' : 'Unverified'}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          </header>

          {/* Ticker Bar */}
          <section
            aria-label="Selected market"
            className="border-b px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-crypto-color border-gray-200 dark:border-line-color"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setPairMenuOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={pairMenuOpen}
                  className="flex items-center gap-2 border rounded-xl px-3 py-1.5 transition bg-gray-100 dark:bg-input-field border-gray-300 dark:border-line-color hover:border-blue-500"
                >
                  <span className="font-bold text-sm tracking-wide">{selectedPair.asset}/{currency}</span>
                  <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
                </button>

                {pairMenuOpen && (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full mt-1 w-56 border rounded-xl shadow-2xl p-1 z-30 bg-white dark:bg-hero-dark border-gray-200 dark:border-line-color"
                  >
                    {PAIRS.map((pair) => {
                      const t = tickers.data?.[pair.symbol];
                      const up = t && Number(t.priceChangePercent) >= 0;
                      return (
                        <li key={pair.symbol}>
                          <button
                            role="option"
                            aria-selected={pair.symbol === selectedPair.symbol}
                            onClick={() => selectPair(pair)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition hover:bg-gray-100 dark:hover:bg-input-field"
                          >
                            <span className="font-bold">{pair.asset}/{currency}</span>
                            <span className={t ? (up ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-gray-500'}>
                              {t ? formatMoney(t.lastPrice) : '—'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black tracking-tight tabular-nums">
                  {lastPrice !== null ? formatMoney(lastPrice) : tickers.loading ? '…' : '—'}
                </span>
                {changePct !== null && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      changePct >= 0
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    }`}
                  >
                    {changePct >= 0 ? <TrendingUp size={12} className="mr-1" aria-hidden="true" /> : <TrendingDown size={12} className="mr-1" aria-hidden="true" />}
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {tickers.error && !ticker ? (
              <span role="alert" className="text-xs text-red-600 dark:text-red-400">Live market data unavailable.</span>
            ) : (
              <div className="flex items-center gap-6 text-xs overflow-x-auto pb-1 sm:pb-0">
                {[
                  ['24h High', ticker && formatMoney(ticker.highPrice)],
                  ['24h Low', ticker && formatMoney(ticker.lowPrice)],
                  ['24h Volume', ticker && `${formatAmount(ticker.volume, 2)} ${selectedPair.asset}`],
                  ['24h Turnover', ticker && formatMoney(ticker.quoteVolume, { notation: 'compact' })],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="block text-[10px] text-gray-500 dark:text-text-color uppercase tracking-wider">{label}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{value || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="p-4 lg:p-6 space-y-6">
            {/* ACCOUNT METRICS */}
            {stats.error && !s && (
              <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>Couldn't load your account statistics: {stats.error}</span>
                <button type="button" onClick={stats.reload} className="text-blue-500 hover:underline font-semibold">
                  Try again
                </button>
              </div>
            )}
            <section aria-label="Account summary" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard
                  label="Portfolio value"
                  loading={wallet.loading}
                  value={wallet.data ? formatMoney(wallet.data.portfolioValue) : '—'}
                  detail={wallet.data ? `${heldBalances.length} asset${heldBalances.length === 1 ? '' : 's'} held` : wallet.error}
                />
                <StatCard
                  label="Trading volume"
                  loading={stats.loading}
                  value={s ? formatMoney(s.orders.volumeUsd) : '—'}
                  detail={s && `${formatCount(s.orders.completed)} completed order${s.orders.completed === 1 ? '' : 's'}`}
                />
                <StatCard
                  label="Orders"
                  loading={stats.loading}
                  value={s ? formatCount(s.orders.total) : '—'}
                  detail={s && `${formatCount(s.orders.buy)} buy · ${formatCount(s.orders.sell)} sell`}
                />
                <StatCard
                  label="Fiat deposits"
                  loading={stats.loading}
                  value={s ? formatMoney(s.deposits.fiatTotalUsd) : '—'}
                  detail={s && `${formatCount(s.deposits.completed)} completed · ${formatCount(s.deposits.pending)} pending`}
                />
                <StatCard
                  label="Fiat withdrawals"
                  loading={stats.loading}
                  value={s ? formatMoney(s.withdrawals.fiatTotalUsd) : '—'}
                  detail={s && `${formatCount(s.withdrawals.completed)} completed · ${formatCount(s.withdrawals.pending)} pending`}
                />
                <StatCard
                  label="Fees paid"
                  loading={stats.loading}
                  value={s ? formatMoney(s.orders.feesUsd) : '—'}
                  detail={s && `${formatCount(s.transactions.total)} transaction${s.transactions.total === 1 ? '' : 's'}`}
                />
              </section>

            {/* PLATFORM METRICS (admins only, from the existing admin stats endpoint) */}
            {role === 'admin' && (
              <Card>
                <CardTitle
                  action={
                    <Link to="/admin" className="text-xs text-blue-500 hover:underline flex items-center">
                      Admin panel <ArrowUpRight size={12} className="ml-0.5" aria-hidden="true" />
                    </Link>
                  }
                >
                  Platform overview
                </CardTitle>
                {adminStats.loading ? (
                  <PanelMessage kind="loading">Loading platform statistics…</PanelMessage>
                ) : adminStats.error ? (
                  <PanelMessage kind="error" onRetry={adminStats.reload}>{adminStats.error}</PanelMessage>
                ) : adminStats.data && (
                  <dl className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    {[
                      ['Total users', formatCount(adminStats.data.users.total), `${formatCount(adminStats.data.users.newLast7Days)} new this week`],
                      ['Transactions', formatCount(adminStats.data.transactions.total), null],
                      ['Orders', formatCount(adminStats.data.orders.total), `${formatCount(adminStats.data.orders.buy)} buy · ${formatCount(adminStats.data.orders.sell)} sell`],
                      ['Fiat deposits', formatMoney(adminStats.data.deposits.fiatCompletedTotalUsd), `${formatCount(adminStats.data.deposits.pending)} pending`],
                      ['Fiat withdrawals', formatMoney(adminStats.data.withdrawals.fiatCompletedTotalUsd), `${formatCount(adminStats.data.withdrawals.pendingConfirmation)} awaiting confirmation`],
                    ].map(([label, value, detail]) => (
                      <div key={label}>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-color">{label}</dt>
                        <dd className="text-lg font-bold tabular-nums">{value}</dd>
                        {detail && <dd className="text-xs text-gray-500 dark:text-text-color">{detail}</dd>}
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
            )}

            {/* TOP ROW: CHART + ORDERS (LEFT) & TRADE PANEL + BALANCES (RIGHT) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6 min-w-0">
                {/* Price chart (TradingView, live Binance candles) */}
                <Card>
                  <div className="flex items-center justify-between border-b pb-3 mb-4 border-gray-200 dark:border-line-color">
                    <div className="flex items-center gap-1 overflow-x-auto" role="group" aria-label="Chart timeframe">
                      {TIMEFRAMES.map((tf) => (
                        <button
                          key={tf.value}
                          onClick={() => setTimeframe(tf.value)}
                          aria-pressed={timeframe === tf.value}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                            timeframe === tf.value
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-field'
                          }`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                    <span className="hidden sm:block text-xs text-gray-500 dark:text-text-color">{selectedPair.symbol} · Binance</span>
                  </div>
                  <TradingViewChart symbol={selectedPair.symbol} interval={timeframe} />
                </Card>

                {/* 30-day account activity */}
                <Card>
                  <CardTitle
                    action={
                      <div className="flex gap-1" role="group" aria-label="Activity metric">
                        {ACTIVITY_METRICS.map((m) => (
                          <button
                            key={m.key}
                            onClick={() => setActivityMetric(m)}
                            aria-pressed={activityMetric.key === m.key}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              activityMetric.key === m.key
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-field'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    }
                  >
                    Your activity · last 30 days
                  </CardTitle>
                  {stats.loading ? (
                    <PanelMessage kind="loading">Loading activity…</PanelMessage>
                  ) : stats.error && !s ? (
                    <PanelMessage kind="error" onRetry={stats.reload}>{stats.error}</PanelMessage>
                  ) : (
                    <ActivityChart daily={daily} metric={activityMetric} formatMoney={formatMoney} />
                  )}
                </Card>

                {/* Orders */}
                <Card>
                  <div className="flex items-center justify-between border-b pb-3 mb-4 border-gray-200 dark:border-line-color">
                    <div className="flex gap-4" role="tablist" aria-label="Orders">
                      {[
                        ['HISTORY', 'Order History'],
                        ['OPEN', 'Open Orders'],
                        ['CLOSED', 'Closed Orders'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          role="tab"
                          aria-selected={ordersTab === value}
                          onClick={() => setOrdersTab(value)}
                          className={`text-xs font-bold pb-1 transition relative ${
                            ordersTab === value ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                          }`}
                        >
                          {label}
                          {ordersTab === value && <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                        </button>
                      ))}
                    </div>
                    <Link to="/orderstrades" className="text-xs text-blue-500 hover:underline flex items-center">
                      View all <ArrowUpRight size={12} className="ml-0.5" aria-hidden="true" />
                    </Link>
                  </div>

                  {orders.loading ? (
                    <PanelMessage kind="loading">Loading orders…</PanelMessage>
                  ) : orders.error ? (
                    <PanelMessage kind="error" onRetry={orders.reload}>{orders.error}</PanelMessage>
                  ) : !orders.data?.length ? (
                    <PanelMessage>
                      No orders here yet. <Link to="/buy-crypto" className="text-blue-500 hover:underline">Buy crypto</Link> or use the trade panel to place one.
                    </PanelMessage>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-line-color text-gray-500 dark:text-text-color">
                            <th className="pb-3 font-semibold">Date & Time</th>
                            <th className="pb-3 font-semibold">Pair</th>
                            <th className="pb-3 font-semibold">Side</th>
                            <th className="pb-3 font-semibold">Price</th>
                            <th className="pb-3 font-semibold">Status</th>
                            <th className="pb-3 font-semibold text-right">Amount</th>
                            <th className="pb-3 font-semibold text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-line-color">
                          {orders.data.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-hero-dark transition">
                              <td className="py-3 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </td>
                              <td className="py-3 pr-3 font-bold">{order.pair.split('/')[0]}/{currency}</td>
                              <td className="py-3 pr-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    order.side === 'BUY'
                                      ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
                                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                  }`}
                                >
                                  {order.side === 'BUY' ? 'Buy' : 'Sell'}
                                </span>
                              </td>
                              <td className="py-3 pr-3 font-mono tabular-nums">{formatMoney(order.price)}</td>
                              <td className="py-3 pr-3">{statusBadge(order.status)}</td>
                              <td className="py-3 pr-3 text-right tabular-nums">
                                {formatAmount(order.amount, 8)} {order.pair.split('/')[0]}
                              </td>
                              <td className="py-3 text-right font-semibold tabular-nums">{formatMoney(order.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>

              {/* Right column */}
              <div className="lg:col-span-4 space-y-6">
                {/* Market order panel (real orders via /api/orders/buy|sell) */}
                <Card className="p-5">
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl mb-4 bg-gray-100 dark:bg-input-field" role="group" aria-label="Order side">
                    {['buy', 'sell'].map((side) => (
                      <button
                        key={side}
                        onClick={() => { setTradeType(side); setTradeAmount(''); setTradeMessage(null); }}
                        aria-pressed={tradeType === side}
                        className={`py-2 rounded-lg text-xs font-bold transition ${
                          tradeType === side
                            ? side === 'buy' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {side === 'buy' ? 'Buy' : 'Sell'}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-text-color mb-4">
                    Market order · executes at the live price · {FEE_RATE * 100}% fee
                  </p>

                  <form onSubmit={handlePlaceOrder} className="space-y-4">
                    <div>
                      <label htmlFor="trade-amount" className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                        <span>{tradeType === 'buy' ? 'You pay (card)' : 'You sell'}</span>
                        {tradeType === 'sell' && (
                          <span>Available: {formatAmount(assetBalance, 8)} {selectedPair.asset}</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          id="trade-amount"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(e.target.value)}
                          placeholder={tradeType === 'buy' ? `${MIN_TRADE_USD} – ${MAX_TRADE_USD.toLocaleString()}` : '0.00'}
                          className="w-full border rounded-xl pl-3 pr-14 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 bg-gray-50 dark:bg-input-field border-gray-300 dark:border-line-color"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                          {tradeType === 'buy' ? 'USD' : selectedPair.asset}
                        </span>
                      </div>
                      {tradeType === 'buy' && numericAmount > 0 && currency !== 'USD' && (
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-text-color">≈ {formatMoney(numericAmount)}</p>
                      )}
                    </div>

                    {tradeType === 'sell' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {[25, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            disabled={assetBalance <= 0}
                            onClick={() => setTradeAmount(String(Number(((assetBalance * pct) / 100).toFixed(8))))}
                            className="py-1 text-[11px] font-semibold rounded-lg border transition disabled:opacity-40 bg-gray-100 dark:bg-input-field border-gray-300 dark:border-line-color text-gray-600 dark:text-gray-400 hover:border-blue-500"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    )}

                    <div>
                      <p className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                        <span>You receive (est.)</span>
                        <span>{tradeType === 'buy' ? selectedPair.asset : currency}</span>
                      </p>
                      <div className="w-full border rounded-xl px-3 py-2 text-sm font-bold tabular-nums bg-gray-50 dark:bg-input-field border-gray-300 dark:border-line-color">
                        {!lastPrice
                          ? '—'
                          : tradeType === 'buy'
                            ? `${formatAmount(estimate, 8)} ${selectedPair.asset}`
                            : formatMoney(estimate)}
                      </div>
                    </div>

                    {tradeMessage && (
                      <div
                        role={tradeMessage.kind === 'error' ? 'alert' : 'status'}
                        className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                          tradeMessage.kind === 'success'
                            ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {tradeMessage.kind === 'success' ? <Check size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                        <span>{tradeMessage.text}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !lastPrice}
                      className={`w-full py-3 rounded-xl font-extrabold text-sm tracking-wide text-white transition disabled:opacity-50 ${
                        tradeType === 'buy' ? 'bg-green-700 hover:bg-green-800' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {submitting ? 'Placing order…' : `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${selectedPair.asset}`}
                    </button>
                  </form>
                </Card>

                {/* Balances */}
                <Card className="p-5">
                  <CardTitle
                    action={
                      <Link to="/wallet" className="text-xs text-blue-500 hover:underline flex items-center">
                        Manage <ArrowUpRight size={12} className="ml-0.5" aria-hidden="true" />
                      </Link>
                    }
                  >
                    Your Balances
                  </CardTitle>

                  {wallet.loading ? (
                    <PanelMessage kind="loading">Loading balances…</PanelMessage>
                  ) : wallet.error && !wallet.data ? (
                    <PanelMessage kind="error" onRetry={wallet.reload}>{wallet.error}</PanelMessage>
                  ) : heldBalances.length === 0 ? (
                    <PanelMessage>
                      Your wallet is empty. <Link to="/deposit" className="text-blue-500 hover:underline">Deposit funds</Link> to get started.
                    </PanelMessage>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {[...heldBalances].sort((a, b) => b.usdValue - a.usdValue).map((b) => {
                          const t = tickers.data?.[`${b.assetSymbol}USDT`];
                          const pct = t ? Number(t.priceChangePercent) : null;
                          return (
                            <li key={b.assetSymbol} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-input-field">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="text-xs font-bold">{b.assetSymbol}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-text-color tabular-nums">
                                    {formatAmount(b.totalBalance, 8)}
                                    {b.lockedBalance > 0 && ` (${formatAmount(b.lockedBalance, 8)} locked)`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold tabular-nums">{formatMoney(b.usdValue)}</p>
                                {pct !== null && (
                                  <p className={`text-[10px] font-semibold ${pct >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}% 24h
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </Card>
              </div>
            </div>

            {/* BOTTOM ROW: ORDER BOOK & RECENT TRADES (live Binance data) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardTitle action={<span className="text-[10px] text-gray-500 dark:text-text-color">{selectedPair.symbol} · Binance</span>}>
                  Order Book
                </CardTitle>
                {orderBook.loading ? (
                  <PanelMessage kind="loading">Loading order book…</PanelMessage>
                ) : orderBook.error && !orderBook.data ? (
                  <PanelMessage kind="error" onRetry={orderBook.reload}>Order book unavailable. {orderBook.error}</PanelMessage>
                ) : orderBook.data && (
                  <>
                    <div className="grid grid-cols-3 text-[11px] font-semibold text-gray-500 dark:text-text-color mb-2 border-b pb-1 border-gray-200 dark:border-line-color">
                      <span>Price ({currency})</span>
                      <span className="text-right">Amount ({selectedPair.asset})</span>
                      <span className="text-right">Total</span>
                    </div>
                    <div className="space-y-0.5 mb-2">
                      {renderBookRows([...(orderBook.data.asks || [])].slice(0, 6).reverse(), 'ask')}
                    </div>
                    {orderBook.data.asks?.[0] && orderBook.data.bids?.[0] && (
                      <div className="py-2 px-3 my-2 rounded-xl flex items-center justify-between border bg-gray-50 dark:bg-input-field border-gray-200 dark:border-line-color">
                        <span className="font-extrabold text-sm font-mono tabular-nums">{lastPrice !== null ? formatMoney(lastPrice) : '—'}</span>
                        <span className="text-[10px] text-gray-500 dark:text-text-color">
                          Spread {formatMoney(Number(orderBook.data.asks[0][0]) - Number(orderBook.data.bids[0][0]))}
                        </span>
                      </div>
                    )}
                    <div className="space-y-0.5">{renderBookRows((orderBook.data.bids || []).slice(0, 6), 'bid')}</div>
                  </>
                )}
              </Card>

              <Card>
                <CardTitle
                  action={
                    <span className="flex items-center text-[10px] text-green-700 dark:text-green-400 font-semibold">
                      <Activity size={12} className="mr-1" aria-hidden="true" /> Live · every 5s
                    </span>
                  }
                >
                  Recent Trades
                </CardTitle>
                {trades.loading ? (
                  <PanelMessage kind="loading">Loading trades…</PanelMessage>
                ) : trades.error && !trades.data ? (
                  <PanelMessage kind="error" onRetry={trades.reload}>Recent trades unavailable. {trades.error}</PanelMessage>
                ) : !trades.data?.length ? (
                  <PanelMessage>No recent trades.</PanelMessage>
                ) : (
                  <>
                    <div className="grid grid-cols-3 text-[11px] font-semibold text-gray-500 dark:text-text-color mb-2 border-b pb-1 border-gray-200 dark:border-line-color">
                      <span>Price ({currency})</span>
                      <span className="text-right">Amount ({selectedPair.asset})</span>
                      <span className="text-right">Time</span>
                    </div>
                    <div className="space-y-1">
                      {trades.data.map((trade) => (
                        <div key={trade.id} className="grid grid-cols-3 text-xs font-mono py-1 tabular-nums">
                          {/* isBuyerMaker = the taker sold */}
                          <span className={`font-bold ${trade.isBuyerMaker ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                            {formatMoney(trade.price)}
                          </span>
                          <span className="text-right text-gray-700 dark:text-gray-300">{formatAmount(trade.qty, 5)}</span>
                          <span className="text-right text-gray-500 dark:text-text-color">
                            {new Date(trade.time).toLocaleTimeString('en-GB')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;