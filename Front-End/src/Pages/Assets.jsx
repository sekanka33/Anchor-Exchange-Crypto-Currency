import { Link } from "react-router-dom";
import PageHeader from "../Components/PageHeader";
import { PAIRS } from "../api/tradingPairs";
import { getBinanceTicker } from "../api/coingecko";
import { authFetch } from "../api/authFetch";
import { useApi } from "../hooks/useApi";
import { useCurrency } from "../hooks/useCurrency";

const formatAmount = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });

// Every asset tradable on Anchor Exchange, with its live price and - when
// signed in - the user's own balance. The Wallet page has the full breakdown.
const Assets = () => {
  const { formatMoney } = useCurrency();
  const loggedIn = Boolean(localStorage.getItem("token"));

  const tickers = useApi(async () => {
    const results = await Promise.allSettled(PAIRS.map((p) => getBinanceTicker(p.symbol)));
    const map = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled") map[PAIRS[i].symbol] = r.value;
    });
    if (Object.keys(map).length === 0) throw new Error("Live prices are unavailable right now.");
    return map;
  }, [], { pollMs: 15000 });

  const wallet = useApi(() => authFetch("/api/wallet"), [], { enabled: loggedIn });

  const balanceFor = (asset) => wallet.data?.balances?.find((b) => b.assetSymbol === asset);

  return (
    <div>
      <PageHeader title="Assets" crumbs={[{ label: "Home", to: "/" }, { label: "Assets" }]} />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-14 text-slate-900 dark:text-white">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Supported assets</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Live prices update every 15 seconds.</p>
          </div>

          {loggedIn ? (
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total portfolio value</p>
              <p className="text-2xl font-bold">
                {wallet.loading ? "…" : wallet.error ? "—" : formatMoney(wallet.data?.portfolioValue || 0)}
              </p>
              <Link to="/wallet" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View full wallet →</Link>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Link to="/signin" className="text-blue-600 dark:text-blue-400 underline">Sign in</Link> to see your balances.
            </p>
          )}
        </div>

        {tickers.error && !tickers.data && (
          <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{tickers.error}</p>
        )}
        {loggedIn && wallet.error && (
          <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">Couldn't load your balances: {wallet.error}</p>
        )}

        <div className="relative overflow-x-auto rounded-2xl border border-gray-200 dark:border-line-color bg-white dark:bg-crypto-color">
          <table className="w-full min-w-160 text-sm">
            <thead className="text-left text-gray-600 dark:text-text-color">
              <tr className="border-b border-gray-200 dark:border-line-color">
                <th scope="col" className="px-5 py-4 font-medium">Asset</th>
                <th scope="col" className="px-5 py-4 font-medium text-right">Price</th>
                <th scope="col" className="px-5 py-4 font-medium text-right">24h change</th>
                {loggedIn && <th scope="col" className="px-5 py-4 font-medium text-right">Your balance</th>}
                <th scope="col" className="px-5 py-4 font-medium text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map((pair) => {
                const ticker = tickers.data?.[pair.symbol];
                const change = ticker ? Number(ticker.priceChangePercent) : null;
                const balance = balanceFor(pair.asset);
                return (
                  <tr key={pair.asset} className="border-b last:border-b-0 border-gray-200 dark:border-line-color">
                    <th scope="row" className="px-5 py-4 text-left font-normal">
                      <span className="font-semibold">{pair.asset}</span>{" "}
                      <span className="text-gray-600 dark:text-text-color">{pair.name}</span>
                    </th>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {ticker ? formatMoney(Number(ticker.lastPrice)) : tickers.loading ? "…" : "—"}
                    </td>
                    <td className={`px-5 py-4 text-right tabular-nums ${change === null ? "" : change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {change === null ? (tickers.loading ? "…" : "—") : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                    </td>
                    {loggedIn && (
                      <td className="px-5 py-4 text-right tabular-nums">
                        {wallet.loading ? "…" : wallet.error ? "—" : `${formatAmount(balance?.totalBalance || 0)} ${pair.asset}`}
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link to="/buy-crypto" className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium">Buy</Link>
                        <Link to="/exchange" className="px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:border-blue-500 text-xs font-medium">Trade</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
          Prices are quoted against USDT. USDT itself can be deposited and withdrawn from your <Link to="/wallet" className="text-blue-600 dark:text-blue-400 underline">Wallet</Link>.
        </p>
      </div>
    </div>
  );
};

export default Assets;
