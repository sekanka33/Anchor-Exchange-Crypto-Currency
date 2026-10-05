import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaStar, FaRegStar, FaChevronDown, FaExternalLinkAlt } from 'react-icons/fa';
import { useCurrency } from '../hooks/useCurrency';
import { useApi } from '../hooks/useApi';
import { authFetch } from '../api/authFetch';
import { getBinanceTicker, getBinanceOrderBook, getBinanceTrades, getCoinDetail } from '../api/coingecko';
import { PAIRS, FEE_RATE, MIN_TRADE_USD, MAX_TRADE_USD } from '../api/tradingPairs';
import TradingViewChart from './TradingViewChart';

const TIMEFRAMES = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: 'D', value: 'D' },
  { label: 'W', value: 'W' },
  { label: 'M', value: 'M' },
];

const BOTTOM_TABS = ['OPEN ORDERS', 'ORDER HISTORY', 'TRADE HISTORY', 'FUNDS'];
const FAVORITES_KEY = 'exchangeFavorites';

const readFavorites = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(saved) ? saved : ['BTCUSDT', 'ETHUSDT'];
  } catch {
    return ['BTCUSDT', 'ETHUSDT'];
  }
};

const formatAmount = (value, digits = 6) =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const up = 'text-green-700 dark:text-green-400';
const down = 'text-red-600 dark:text-red-400';
const muted = 'text-gray-500 dark:text-text-color';

const Panel = ({ className = '', children }) => (
  <div className={`bg-white dark:bg-crypto-color border border-gray-200 dark:border-line-color rounded-lg p-3 ${className}`}>{children}</div>
);

// Loading / error / empty line used inside each panel.
const Status = ({ state, empty, children }) => {
  if (state.loading) return <p role="status" className={`py-6 text-center ${muted}`}>Loading…</p>;
  if (state.error && !state.data) {
    return (
      <p role="alert" className={`py-6 text-center ${down}`}>
        Unable to load this data.{' '}
        <button type="button" onClick={state.reload} className="text-blue-500 hover:underline font-semibold">Try again</button>
      </p>
    );
  }
  if (empty) return <p role="status" className={`py-6 text-center ${muted}`}>{empty}</p>;
  return children;
};

/**
 * Full trading view (live chart, order book, trades, markets, market order
 * form and the user's orders/funds). Rendered by both /exchange and /spot.
 */
const TradingTerminal = ({ title }) => {
  const { currency, formatMoney } = useCurrency();
  const loggedIn = Boolean(localStorage.getItem('token'));

  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [pairMenuOpen, setPairMenuOpen] = useState(false);
  const [timeframe, setTimeframe] = useState('15');
  const [bookView, setBookView] = useState('GENERAL');
  const [bottomTab, setBottomTab] = useState('OPEN ORDERS');
  const [pairSearch, setPairSearch] = useState('');
  const [pairTab, setPairTab] = useState('ALL');
  const [favorites, setFavorites] = useState(readFavorites);

  // Order form
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  /* ---------------- Live market data ---------------- */

  const tickers = useApi(async () => {
    const results = await Promise.allSettled(PAIRS.map((p) => getBinanceTicker(p.symbol)));
    const map = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') map[PAIRS[i].symbol] = r.value;
    });
    if (Object.keys(map).length === 0) throw new Error('Market data unavailable');
    return map;
  }, [], { pollMs: 15000 });

  const coin = useApi(() => getCoinDetail(selectedPair.coingeckoId), [selectedPair.coingeckoId], { pollMs: 60000 });
  const orderBook = useApi(() => getBinanceOrderBook(selectedPair.symbol, 20), [selectedPair.symbol], { pollMs: 5000 });
  const trades = useApi(
    () => getBinanceTrades(selectedPair.symbol, 20).then((list) => [...list].reverse()),
    [selectedPair.symbol],
    { pollMs: 5000 }
  );

  /* ---------------- Account data (signed-in only) ---------------- */

  const wallet = useApi(() => authFetch('/api/wallet'), [], { enabled: loggedIn });
  const bottom = useApi(() => {
    if (bottomTab === 'OPEN ORDERS') return authFetch('/api/orders?status=OPEN&limit=10').then((d) => d.orders);
    if (bottomTab === 'ORDER HISTORY') return authFetch('/api/orders?limit=10').then((d) => d.orders);
    if (bottomTab === 'TRADE HISTORY') return authFetch('/api/transactions?type=BUY,SELL&limit=10').then((d) => d.transactions);
    return Promise.resolve(null); // FUNDS reads the wallet
  }, [bottomTab], { enabled: loggedIn });

  const ticker = tickers.data?.[selectedPair.symbol];
  const lastPrice = ticker ? Number(ticker.lastPrice) : null;
  const changePct = ticker ? Number(ticker.priceChangePercent) : null;
  const md = coin.data?.market_data;

  /* ---------------- Order book ---------------- */

  const book = useMemo(() => {
    if (!orderBook.data) return null;
    const asks = orderBook.data.asks.slice(0, 9).map(([p, q]) => ({ price: Number(p), qty: Number(q) }));
    const bids = orderBook.data.bids.slice(0, 9).map(([p, q]) => ({ price: Number(p), qty: Number(q) }));
    // Cumulative view: running totals outward from the spread.
    let run = 0;
    asks.forEach((r) => { run += r.qty; r.cum = run; });
    run = 0;
    bids.forEach((r) => { run += r.qty; r.cum = run; });
    const sizeKey = bookView === 'CUMULATIVE' ? 'cum' : 'qty';
    const max = Math.max(...asks.map((r) => r[sizeKey]), ...bids.map((r) => r[sizeKey]), 0);
    const askTotal = asks.reduce((s, r) => s + r.qty, 0);
    const bidTotal = bids.reduce((s, r) => s + r.qty, 0);
    return {
      asks: [...asks].reverse(),
      bids,
      sizeKey,
      max,
      askTotal,
      bidTotal,
      spread: asks[0] && bids[0] ? asks[0].price - bids[0].price : null,
    };
  }, [orderBook.data, bookView]);

  const bookRow = (r, isAsk) => (
    <div key={`${isAsk ? 'a' : 'b'}-${r.price}`} className="relative grid grid-cols-3 items-center h-5 font-mono tabular-nums">
      <span
        className={`absolute right-0 inset-y-0 ${isAsk ? 'bg-red-500/10' : 'bg-green-500/10'}`}
        style={{ width: `${book.max ? (r[book.sizeKey] / book.max) * 100 : 0}%` }}
        aria-hidden="true"
      />
      <span className={`relative font-semibold ${isAsk ? down : up}`}>{formatMoney(r.price)}</span>
      <span className="relative text-right">{formatAmount(r[book.sizeKey], 5)}</span>
      <span className={`relative text-right ${muted}`}>{formatMoney(r.price * r[book.sizeKey], { notation: 'compact' })}</span>
    </div>
  );

  /* ---------------- Pairs list ---------------- */

  const toggleFavorite = (symbol) => {
    setFavorites((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };

  const visiblePairs = PAIRS.filter((p) => {
    const q = pairSearch.trim().toUpperCase();
    if (q && !p.asset.includes(q) && !p.name.toUpperCase().includes(q)) return false;
    return pairTab === 'ALL' || favorites.includes(p.symbol);
  });

  const selectPair = (pair) => {
    setSelectedPair(pair);
    setPairMenuOpen(false);
    setAmount('');
    setMessage(null);
  };

  /* ---------------- Market order (real, via /api/orders) ---------------- */

  const assetBalance = wallet.data?.balances?.find((b) => b.assetSymbol === selectedPair.asset)?.availableBalance ?? 0;
  const usdBalance = wallet.data?.balances?.find((b) => b.assetSymbol === 'USD')?.availableBalance ?? 0;
  const numericAmount = Number(amount) || 0;
  const estimate = lastPrice ? (side === 'buy' ? numericAmount / lastPrice : numericAmount * lastPrice * (1 - FEE_RATE)) : 0;

  const placeOrder = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (numericAmount <= 0) {
      setMessage({ ok: false, text: 'Enter an amount greater than zero.' });
      return;
    }
    setSubmitting(true);
    try {
      const body = side === 'buy'
        ? { asset: selectedPair.asset, amountUsd: numericAmount, paymentMethod: 'card' }
        : { asset: selectedPair.asset, amount: numericAmount };
      const data = await authFetch(`/api/orders/${side}`, { method: 'POST', body: JSON.stringify(body) });
      setMessage({ ok: true, text: `${side === 'buy' ? 'Bought' : 'Sold'} ${formatAmount(data.order.amount, 8)} ${selectedPair.asset} at ${formatMoney(data.order.price)}.` });
      setAmount('');
      wallet.reload();
      bottom.reload();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Render ---------------- */

  const tabClass = (active) =>
    `transition-colors ${active ? 'text-blue-500 font-bold border-b-2 border-blue-500' : `${muted} hover:text-slate-900 dark:hover:text-white`}`;

  return (
    <div className="bg-slate-50 dark:bg-hero-dark text-slate-900 dark:text-gray-200 text-sm font-sans min-h-screen">
      <h1 className="sr-only">{title} — {selectedPair.asset}/{currency}</h1>

      {/* TOP MARKET HEADER BAR */}
      <div className="flex items-center bg-white dark:bg-crypto-color border-b border-gray-200 dark:border-line-color px-4 py-2 overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPairMenuOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={pairMenuOpen}
              className="flex items-center gap-2 text-left"
            >
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{selectedPair.asset.slice(0, 1)}</span>
              <span>
                <span className="flex items-center gap-1 font-bold text-base">
                  {selectedPair.asset}/{currency} <FaChevronDown className={`text-xs ${muted}`} aria-hidden="true" />
                </span>
                <span className={`block text-xs ${muted}`}>{selectedPair.name}</span>
              </span>
            </button>
          </div>

          <div className="h-8 w-px bg-gray-200 dark:bg-line-color" />

          {tickers.error && !ticker ? (
            <span role="alert" className={down}>Live market data unavailable.</span>
          ) : (
            [
              ['Last price', lastPrice !== null ? formatMoney(lastPrice) : '…', changePct !== null ? (changePct >= 0 ? up : down) : ''],
              ['24H Change', changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '…', changePct !== null ? (changePct >= 0 ? up : down) : ''],
              ['24H High', ticker ? formatMoney(ticker.highPrice) : '…', ''],
              ['24H Low', ticker ? formatMoney(ticker.lowPrice) : '…', ''],
              [`24H Turnover`, ticker ? formatMoney(ticker.quoteVolume, { notation: 'compact' }) : '…', ''],
              [`24H Volume (${selectedPair.asset})`, ticker ? formatAmount(ticker.volume, 2) : '…', ''],
            ].map(([label, value, cls]) => (
              <div key={label}>
                <div className={`text-xs ${muted}`}>{label}</div>
                <div className={`font-semibold tabular-nums ${label === 'Last price' ? 'text-base' : ''} ${cls}`}>{value}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {pairMenuOpen && (
        <div className="relative z-30 px-4">
          <ul role="listbox" className="absolute left-4 top-1 w-60 bg-white dark:bg-crypto-color border border-gray-200 dark:border-line-color rounded-lg shadow-2xl p-1">
            {PAIRS.map((p) => {
              const t = tickers.data?.[p.symbol];
              return (
                <li key={p.symbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={p.symbol === selectedPair.symbol}
                    onClick={() => selectPair(p)}
                    className="w-full flex justify-between px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-input-field"
                  >
                    <span className="font-bold">{p.asset}/{currency}</span>
                    <span className={t ? (Number(t.priceChangePercent) >= 0 ? up : down) : muted}>{t ? formatMoney(t.lastPrice) : '—'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* MAIN LAYOUT GRID */}
      <div className="p-2 space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">

          {/* LEFT & CENTER COLUMN */}
          <div className="lg:col-span-9 space-y-2 min-w-0">

            {/* CHART (live Binance candles) */}
            <Panel className="p-2">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-line-color pb-2 text-[13px]">
                <div className="flex items-center gap-4">
                  <span className="font-bold tracking-wider">CHART</span>
                  <div className="flex items-center gap-3" role="group" aria-label="Chart timeframe">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.value}
                        type="button"
                        onClick={() => setTimeframe(tf.value)}
                        aria-pressed={timeframe === tf.value}
                        className={`pb-0.5 ${tabClass(timeframe === tf.value)}`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>
                <span className={`hidden sm:block ${muted}`}>{selectedPair.symbol} · Binance</span>
              </div>
              <TradingViewChart symbol={selectedPair.symbol} interval={timeframe} className="w-full h-96 mt-2" />
            </Panel>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">

              {/* ORDER BOOK + MARKET STATS */}
              <Panel className="md:col-span-7 p-2">
                <div className="grid grid-cols-2 text-center font-semibold border-b border-gray-200 dark:border-line-color mb-2" role="tablist" aria-label="Order book view">
                  {[['GENERAL', 'ORDER BOOK'], ['CUMULATIVE', 'CUMULATIVE DEPTH']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={bookView === value}
                      onClick={() => setBookView(value)}
                      className={`py-2 text-[13px] ${tabClass(bookView === value)}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 sm:border-r border-gray-200 dark:border-line-color sm:pr-2 text-[13px]">
                    <Status state={orderBook} empty={book && !book.asks.length && !book.bids.length ? 'No orders on the book.' : null}>
                      {book && (
                        <>
                          <div className={`grid grid-cols-3 text-xs ${muted} pb-1`}>
                            <span>Price ({currency})</span>
                            <span className="text-right">{bookView === 'CUMULATIVE' ? 'Cumulative' : 'Amount'} ({selectedPair.asset})</span>
                            <span className="text-right">Total</span>
                          </div>
                          <div className="space-y-0.5">{book.asks.map((r) => bookRow(r, true))}</div>
                          <div className="flex justify-between items-center px-2 py-1 my-1 rounded bg-gray-50 dark:bg-input-field">
                            <span className={`font-mono font-bold text-base ${changePct !== null && changePct < 0 ? down : up}`}>
                              {lastPrice !== null ? formatMoney(lastPrice) : '—'}
                            </span>
                            <span className={`text-xs ${muted}`}>Spread {book.spread !== null ? formatMoney(book.spread) : '—'}</span>
                          </div>
                          <div className="space-y-0.5">{book.bids.map((r) => bookRow(r, false))}</div>
                          <div className="flex justify-between pt-2 mt-1 font-mono font-bold border-t border-gray-200 dark:border-line-color">
                            <span className={up}>{formatAmount(book.bidTotal, 3)}</span>
                            <span className={`text-xs font-normal ${muted}`}>Bid vs ask quantity ({selectedPair.asset}, top 9)</span>
                            <span className={down}>{formatAmount(book.askTotal, 3)}</span>
                          </div>
                        </>
                      )}
                    </Status>
                  </div>

                  {/* Market stats (CoinGecko) */}
                  <div className="space-y-2 text-xs">
                    <Status state={coin}>
                      {md && (
                        <>
                          <div>
                            <div className={muted}>24h Trading volume</div>
                            <div className="font-mono font-bold text-sm">{formatMoney(md.total_volume?.usd, { notation: 'compact' })}</div>
                          </div>
                          <div>
                            <div className={muted}>Market cap</div>
                            <div className="font-mono font-bold text-sm">{formatMoney(md.market_cap?.usd, { notation: 'compact' })}</div>
                            {coin.data.market_cap_rank && <div className={`text-[11px] ${muted}`}>Rank #{coin.data.market_cap_rank}</div>}
                          </div>
                          <div>
                            <div className={muted}>All-time high</div>
                            <div className={`font-mono font-bold text-sm ${up}`}>{formatMoney(md.ath?.usd)}</div>
                            {md.ath_date?.usd && <div className={`text-[11px] ${muted}`}>({new Date(md.ath_date.usd).toLocaleDateString()})</div>}
                          </div>
                          <div>
                            <div className={muted}>All-time low</div>
                            <div className={`font-mono font-bold text-sm ${down}`}>{formatMoney(md.atl?.usd, { maximumFractionDigits: 6 })}</div>
                            {md.atl_date?.usd && <div className={`text-[11px] ${muted}`}>({new Date(md.atl_date.usd).toLocaleDateString()})</div>}
                          </div>
                          <div className="pt-1 border-t border-gray-200 dark:border-line-color space-y-1">
                            {[
                              ['7d change', md.price_change_percentage_7d],
                              ['30d change', md.price_change_percentage_30d],
                              ['1y change', md.price_change_percentage_1y],
                            ].map(([label, v]) => (
                              <div key={label} className="flex justify-between">
                                <span className={muted}>{label}</span>
                                <span className={`font-mono ${v >= 0 ? up : down}`}>{v === undefined || v === null ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </Status>
                  </div>
                </div>
              </Panel>

              {/* ORDER ENTRY + RECENT TRADES */}
              <div className="md:col-span-5 space-y-2">
                <Panel className="space-y-3">
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-gray-100 dark:bg-input-field" role="group" aria-label="Order side">
                    {['buy', 'sell'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setSide(s); setAmount(''); setMessage(null); }}
                        aria-pressed={side === s}
                        className={`py-1.5 rounded font-bold ${side === s ? (s === 'buy' ? 'bg-green-700 text-white' : 'bg-red-600 text-white') : muted}`}
                      >
                        {s === 'buy' ? 'Buy' : 'Sell'} {selectedPair.asset}
                      </button>
                    ))}
                  </div>
                  <p className={muted}>Market order · executes at the live price · {FEE_RATE * 100}% fee</p>

                  {!loggedIn ? (
                    <p className="py-4 text-center">
                      <Link to="/signin" className="text-blue-500 font-semibold hover:underline">Sign in</Link> or{' '}
                      <Link to="/signup" className="text-blue-500 font-semibold hover:underline">create an account</Link> to trade.
                    </p>
                  ) : (
                    <form onSubmit={placeOrder} className="space-y-3">
                      <div>
                        <label htmlFor="exchange-amount" className={`flex justify-between mb-1 ${muted}`}>
                          <span>{side === 'buy' ? 'You pay (card)' : 'You sell'}</span>
                          <span>
                            Available:{' '}
                            {side === 'buy' ? formatMoney(usdBalance) : `${formatAmount(assetBalance, 8)} ${selectedPair.asset}`}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            id="exchange-amount"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={side === 'buy' ? `${MIN_TRADE_USD} – ${MAX_TRADE_USD.toLocaleString()}` : '0.00'}
                            className="w-full bg-gray-50 dark:bg-input-field border border-gray-300 dark:border-line-color px-3 py-2 pr-14 rounded focus:outline-none focus:border-blue-500"
                          />
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${muted}`}>{side === 'buy' ? 'USD' : selectedPair.asset}</span>
                        </div>
                        {side === 'buy' && numericAmount > 0 && currency !== 'USD' && (
                          <p className={`mt-1 text-xs ${muted}`}>≈ {formatMoney(numericAmount)}</p>
                        )}
                      </div>

                      {side === 'sell' && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {[25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              disabled={assetBalance <= 0}
                              onClick={() => setAmount(String(Number(((assetBalance * pct) / 100).toFixed(8))))}
                              className="py-1 rounded border border-gray-300 dark:border-line-color hover:border-blue-500 disabled:opacity-40"
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className={muted}>You receive (est.)</span>
                        <span className="font-mono font-semibold">
                          {!lastPrice ? '—' : side === 'buy' ? `${formatAmount(estimate, 8)} ${selectedPair.asset}` : formatMoney(estimate)}
                        </span>
                      </div>

                      {message && (
                        <p role={message.ok ? 'status' : 'alert'} className={`p-2 rounded border ${message.ok ? `bg-green-500/10 border-green-500/30 ${up}` : `bg-red-500/10 border-red-500/30 ${down}`}`}>
                          {message.text}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || !lastPrice}
                        className={`w-full py-2 rounded font-bold text-white disabled:opacity-50 ${side === 'buy' ? 'bg-green-700 hover:bg-green-800' : 'bg-red-600 hover:bg-red-700'}`}
                      >
                        {submitting ? 'Placing order…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedPair.asset}`}
                      </button>
                    </form>
                  )}
                </Panel>

                {/* RECENT TRADES (live Binance) */}
                <Panel className="p-2 space-y-2">
                  <div className="font-bold border-b border-gray-200 dark:border-line-color pb-1">RECENT TRADES</div>
                  <Status state={trades} empty={trades.data && !trades.data.length ? 'No recent trades.' : null}>
                    <div className={`grid grid-cols-3 text-xs ${muted} px-1`}>
                      <span>Price ({currency})</span>
                      <span className="text-right">Quantity ({selectedPair.asset})</span>
                      <span className="text-right">Time</span>
                    </div>
                    <div className="space-y-1 h-55 overflow-y-auto font-mono text-xs tabular-nums">
                      {trades.data?.map((t) => (
                        <div key={t.id} className="grid grid-cols-3 items-center px-1">
                          {/* isBuyerMaker = the taker sold */}
                          <span className={`font-medium ${t.isBuyerMaker ? down : up}`}>{formatMoney(t.price)}</span>
                          <span className="text-right">{formatAmount(t.qty, 6)}</span>
                          <span className={`text-right ${muted}`}>{new Date(t.time).toLocaleTimeString('en-GB')}</span>
                        </div>
                      ))}
                    </div>
                  </Status>
                </Panel>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-3 space-y-2">

            {/* MARKETS */}
            <Panel className="space-y-3">
              <div className="relative">
                <input
                  type="search"
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search markets"
                  className="w-full bg-gray-50 dark:bg-input-field border border-gray-300 dark:border-line-color pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-blue-500"
                />
                <FaSearch className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${muted}`} aria-hidden="true" />
              </div>

              <div className="flex items-center gap-4 text-[13px] border-b border-gray-200 dark:border-line-color" role="tablist" aria-label="Markets">
                {[['FAVORITES', 'Favorites'], ['ALL', `${currency} markets`]].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={pairTab === value}
                    onClick={() => setPairTab(value)}
                    className={`flex items-center gap-1 pb-1 ${tabClass(pairTab === value)}`}
                  >
                    {value === 'FAVORITES' && <FaStar className="text-amber-500" aria-hidden="true" />} {label}
                  </button>
                ))}
              </div>

              <div className={`grid grid-cols-[1.2fr_1fr_0.8fr_1fr] text-xs ${muted} pb-1 border-b border-gray-200 dark:border-line-color`}>
                <span>Pair</span>
                <span className="text-right">Price</span>
                <span className="text-right">24h</span>
                <span className="text-right">Turnover</span>
              </div>

              <Status state={tickers} empty={visiblePairs.length === 0 ? (pairTab === 'FAVORITES' ? 'No favorites yet — tap a star.' : 'No matching markets.') : null}>
                <div className="space-y-1 max-h-96 overflow-y-auto text-[13px]">
                  {visiblePairs.map((p) => {
                    const t = tickers.data?.[p.symbol];
                    const pct = t ? Number(t.priceChangePercent) : null;
                    const fav = favorites.includes(p.symbol);
                    return (
                      <div
                        key={p.symbol}
                        className={`grid grid-cols-[1.2fr_1fr_0.8fr_1fr] items-center p-1 rounded font-mono hover:bg-gray-50 dark:hover:bg-input-field ${p.symbol === selectedPair.symbol ? 'bg-blue-500/10' : ''}`}
                      >
                        <div className="flex items-center gap-1 font-sans">
                          <button type="button" onClick={() => toggleFavorite(p.symbol)} aria-label={fav ? `Remove ${p.asset} from favorites` : `Add ${p.asset} to favorites`} aria-pressed={fav}>
                            {fav ? <FaStar className="text-amber-500 text-xs" /> : <FaRegStar className={`text-xs ${muted}`} />}
                          </button>
                          <button type="button" onClick={() => selectPair(p)} className="font-semibold hover:text-blue-500">
                            {p.asset}<span className={muted}>/{currency}</span>
                          </button>
                        </div>
                        <div className="text-right">{t ? formatMoney(t.lastPrice, { maximumFractionDigits: 4 }) : '—'}</div>
                        <div className={`text-right ${pct === null ? muted : pct >= 0 ? up : down}`}>{pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}</div>
                        <div className={`text-right text-xs ${muted}`}>{t ? formatMoney(t.quoteVolume, { notation: 'compact' }) : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </Status>
            </Panel>

            {/* ASSETS */}
            <Panel className="space-y-3">
              <div className="flex justify-between items-center font-bold">
                <span>Assets</span>
                <Link to="/wallet" className="text-blue-500 text-xs flex items-center gap-1 hover:underline">
                  <FaExternalLinkAlt className="text-[11px]" aria-hidden="true" /> Wallet
                </Link>
              </div>
              {!loggedIn ? (
                <p className={muted}><Link to="/signin" className="text-blue-500 hover:underline">Sign in</Link> to see your balances.</p>
              ) : (
                <Status state={wallet}>
                  <div className="space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className={muted}>Available {selectedPair.asset}</span>
                      <span className="font-mono font-semibold">{formatAmount(assetBalance, 8)} {selectedPair.asset}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={muted}>Available USD</span>
                      <span className="font-mono font-semibold">{formatMoney(usdBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={muted}>Portfolio value</span>
                      <span className="font-mono font-semibold">{formatMoney(wallet.data?.portfolioValue || 0)}</span>
                    </div>
                  </div>
                </Status>
              )}
              <div className="grid grid-cols-3 gap-2 text-center font-semibold">
                <Link to="/deposit" className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded">Deposit</Link>
                <Link to="/buy-crypto" className="bg-gray-100 dark:bg-input-field hover:bg-gray-200 dark:hover:bg-line-color py-1.5 rounded">Buy</Link>
                <Link to="/sell-crypto" className="bg-gray-100 dark:bg-input-field hover:bg-gray-200 dark:hover:bg-line-color py-1.5 rounded">Sell</Link>
              </div>
            </Panel>

            {/* MARKET DETAILS (CoinGecko) */}
            <Panel className="space-y-2 text-[13px]">
              <div className="font-bold text-sm border-b border-gray-200 dark:border-line-color pb-1">Market Details · {selectedPair.name}</div>
              <Status state={coin}>
                {md && [
                  ['Current price', formatMoney(md.current_price?.usd)],
                  ['Circulating supply', `${formatAmount(md.circulating_supply, 0)} ${selectedPair.asset}`],
                  ['Total supply', md.total_supply ? `${formatAmount(md.total_supply, 0)} ${selectedPair.asset}` : '—'],
                  ['Max supply', md.max_supply ? `${formatAmount(md.max_supply, 0)} ${selectedPair.asset}` : 'Unlimited'],
                  ['Fully diluted value', md.fully_diluted_valuation?.usd ? formatMoney(md.fully_diluted_valuation.usd, { notation: 'compact' }) : '—'],
                  ['Last updated', md.last_updated ? new Date(md.last_updated).toLocaleTimeString() : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className={muted}>{label}</span>
                    <span className="font-mono text-right">{value}</span>
                  </div>
                ))}
              </Status>
            </Panel>
          </div>
        </div>

        {/* BOTTOM — ORDERS, TRADES & FUNDS (signed-in user's real records) */}
        <Panel className="space-y-3">
          <div className="flex gap-6 border-b border-gray-200 dark:border-line-color text-sm font-bold overflow-x-auto" role="tablist" aria-label="Your activity">
            {BOTTOM_TABS.map((tab) => (
              <button key={tab} type="button" role="tab" aria-selected={bottomTab === tab} onClick={() => setBottomTab(tab)} className={`pb-2 whitespace-nowrap ${tabClass(bottomTab === tab)}`}>
                {tab}
              </button>
            ))}
          </div>

          {!loggedIn ? (
            <p className={`py-6 text-center ${muted}`}>
              <Link to="/signin" className="text-blue-500 hover:underline">Sign in</Link> to see your orders, trades and funds.
            </p>
          ) : bottomTab === 'FUNDS' ? (
            <Status state={wallet} empty={wallet.data && !wallet.data.balances.some((b) => b.totalBalance > 0) ? 'Your wallet is empty.' : null}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className={`border-b border-gray-200 dark:border-line-color ${muted}`}>
                      <th className="py-2 px-2 font-normal">Asset</th>
                      <th className="py-2 px-2 font-normal text-right">Available</th>
                      <th className="py-2 px-2 font-normal text-right">Locked</th>
                      <th className="py-2 px-2 font-normal text-right">Total</th>
                      <th className="py-2 px-2 font-normal text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-line-color font-mono">
                    {wallet.data?.balances.filter((b) => b.totalBalance > 0).map((b) => (
                      <tr key={b.assetSymbol}>
                        <td className="py-1.5 px-2 font-sans font-semibold">{b.assetSymbol}</td>
                        <td className="py-1.5 px-2 text-right">{formatAmount(b.availableBalance, 8)}</td>
                        <td className="py-1.5 px-2 text-right">{formatAmount(b.lockedBalance, 8)}</td>
                        <td className="py-1.5 px-2 text-right">{formatAmount(b.totalBalance, 8)}</td>
                        <td className="py-1.5 px-2 text-right">{formatMoney(b.usdValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Status>
          ) : (
            <Status
              state={bottom}
              empty={bottom.data && bottom.data.length === 0 ? (bottomTab === 'OPEN ORDERS' ? 'No open orders — market orders fill immediately.' : 'No records yet.') : null}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className={`border-b border-gray-200 dark:border-line-color ${muted}`}>
                      <th className="py-2 px-2 font-normal">Date</th>
                      <th className="py-2 px-2 font-normal">{bottomTab === 'TRADE HISTORY' ? 'Asset' : 'Pair'}</th>
                      <th className="py-2 px-2 font-normal">{bottomTab === 'TRADE HISTORY' ? 'Type' : 'Side'}</th>
                      {bottomTab !== 'TRADE HISTORY' && <th className="py-2 px-2 font-normal">Price</th>}
                      <th className="py-2 px-2 font-normal text-right">Amount</th>
                      <th className="py-2 px-2 font-normal text-right">Fee</th>
                      <th className="py-2 px-2 font-normal text-right">Total</th>
                      <th className="py-2 px-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-line-color font-mono">
                    {bottom.data?.map((r) => {
                      const isTrade = bottomTab === 'TRADE HISTORY';
                      const kind = isTrade ? r.type : r.side;
                      const asset = isTrade ? r.asset : r.pair.split('/')[0];
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-input-field">
                          <td className={`py-1.5 px-2 whitespace-nowrap ${muted}`}>{formatDate(r.created_at)}</td>
                          <td className="py-1.5 px-2 font-sans font-semibold">{isTrade ? asset : `${asset}/${currency}`}</td>
                          <td className={`py-1.5 px-2 ${kind === 'BUY' ? up : down}`}>{kind === 'BUY' ? 'Buy' : 'Sell'}</td>
                          {!isTrade && <td className="py-1.5 px-2">{formatMoney(r.price)}</td>}
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatAmount(r.amount, 8)} {asset}</td>
                          <td className="py-1.5 px-2 text-right">{formatMoney(r.fee)}</td>
                          <td className="py-1.5 px-2 text-right">{formatMoney(r.total)}</td>
                          <td className="py-1.5 px-2 font-sans">{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pt-2 text-right">
                <Link to="/orderstrades" className="text-blue-500 hover:underline">View all orders & trades →</Link>
              </div>
            </Status>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default TradingTerminal;
