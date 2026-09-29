import { useEffect, useState } from 'react'
import { FaEye, FaEyeSlash, FaSearch } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import PageHeader from '../Components/PageHeader'
import MoneyFlowSidebar from '../Components/MoneyFlowSidebar'
import { API_BASE_URL } from '../api/config'

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const formatCurrency = (value) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const formatAmount = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 8 });

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hideBalances, setHideBalances] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const [walletRes, txRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/wallet`, { headers: authHeaders() }),
          fetch(`${API_BASE_URL}/api/wallet/transactions?limit=10`, { headers: authHeaders() }),
        ]);

        const walletData = await walletRes.json();
        const txData = await txRes.json();

        if (!walletRes.ok) {
          setError(walletData.message || "Unable to load wallet.");
          return;
        }

        setWallet(walletData);
        setTransactions(txData.transactions || []);
      } catch {
        setError("Unable to connect to Anchor Exchange server.");
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, []);

  const balances = (wallet?.balances || []).filter((b) =>
    b.assetSymbol.toLowerCase().includes(search.toLowerCase())
  );

  const hasAnyBalance = (wallet?.balances || []).some((b) => b.totalBalance > 0);

  return (
    <div className='pb-20'>
      <PageHeader title="Wallet" crumbs={[{ label: "Home", to: "/" }, { label: "Wallet" }]} />

      <div className='flex flex-col md:flex-row gap-6 md:gap-20 pt-6 md:pt-30 px-4 md:pl-40 md:pr-4'>
        <MoneyFlowSidebar />

        <div className='hidden md:block border-r border-gray-200 dark:border-line-color w-0 h-210'></div>

        {/* RIGHT SECTION */}
        <div className='min-w-0 flex-1'>

          {loading && <p className='text-slate-500 dark:text-gray-400'>Loading wallet...</p>}
          {!loading && error && <p className='text-red-500'>{error}</p>}

          {!loading && !error && wallet && (
            <>
              <div className='bg-white dark:bg-hero2-dark text-slate-900 dark:text-white w-full max-w-220 min-h-50 flex flex-col lg:flex-row justify-between gap-4 pl-10 pr-10 pt-5 pb-5 rounded-2xl border-gray-200 dark:border-line-color border-2'>
                <div className='flex flex-col gap-3'>
                  <p className='text-3xl font-bold'>Overview</p>
                  <p className='text-gray-500 dark:text-text-color text-sm'>Total Portfolio Value</p>
                  <div className='flex flex-row gap-3 items-center'>
                    <p className='text-2xl'>
                      {hideBalances ? "••••••" : formatCurrency(wallet.portfolioValue)}
                    </p>
                    <button onClick={() => setHideBalances((v) => !v)} className='text-gray-500 dark:text-text-color' aria-label={hideBalances ? "Show balances" : "Hide balances"}>
                      {hideBalances ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div className='flex flex-col justify-center'>
                  <div className='relative'>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search asset" placeholder='Search asset'
                      className='w-full lg:w-70 h-11 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white pl-10 rounded-2xl'
                    />
                    <FaSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-text-color' />
                  </div>
                </div>
              </div>


              <div className='bg-white dark:bg-hero2-dark text-slate-900 dark:text-white w-full max-w-220 min-h-40 pl-10 pr-10 mt-9 pb-5 rounded-2xl border-gray-200 dark:border-line-color border-2 overflow-x-auto'>
                <div className='flex flex-row gap-20 pt-10 text-gray-500 dark:text-text-color w-max min-w-full'>
                  <p className='w-30'>Asset</p>
                  <p className='w-40'>Available</p>
                  <p className='w-30'>Locked</p>
                  <p className='w-30'>Total</p>
                  <p className='w-30'>Value (USD)</p>
                </div>

                <hr className='text-gray-200 dark:text-line-color w-200 h-0 mt-4' />

                {!hasAnyBalance && (
                  <div className='flex flex-col items-center justify-center py-14 text-gray-500 dark:text-text-color gap-3'>
                    <p>You have no assets yet.</p>
                    <div className='flex gap-3'>
                      <Link to="/buy-crypto" className='bg-blue-600 h-9 px-5 rounded-full flex items-center text-white'>
                        Buy Crypto
                      </Link>
                    </div>
                  </div>
                )}

                {hasAnyBalance && balances.length === 0 && (
                  <p className='text-gray-500 dark:text-text-color py-6'>No assets match "{search}".</p>
                )}

                {hasAnyBalance &&
                  balances.map((b) => (
                    <div key={b.assetSymbol} className='flex flex-row gap-20 py-3 items-center border-b border-gray-200 dark:border-line-color/40 w-max min-w-full'>
                      <p className='w-30 font-semibold'>{b.assetSymbol}</p>
                      <p className='w-40'>{hideBalances ? "••••••" : formatAmount(b.availableBalance)}</p>
                      <p className='w-30'>{hideBalances ? "••••••" : formatAmount(b.lockedBalance)}</p>
                      <p className='w-30'>{hideBalances ? "••••••" : formatAmount(b.totalBalance)}</p>
                      <p className='w-30'>{hideBalances ? "••••••" : formatCurrency(b.usdValue)}</p>
                    </div>
                  ))}
              </div>

              <div className='bg-white dark:bg-hero2-dark text-slate-900 dark:text-white w-full max-w-220 min-h-30 pl-10 pr-10 mt-9 pb-5 rounded-2xl border-gray-200 dark:border-line-color border-2 overflow-x-auto'>
                <p className='text-xl font-bold pt-5 pb-3'>Recent Wallet Activity</p>
                <hr className='text-gray-200 dark:text-line-color w-200 h-0 mb-2' />

                {transactions.length === 0 ? (
                  <p className='text-gray-500 dark:text-text-color py-6'>No transactions yet.</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className='flex flex-row gap-10 py-2 items-center border-b border-gray-200 dark:border-line-color/40 text-sm w-max min-w-full'>
                      <p className='w-25'>{tx.type}</p>
                      <p className='w-20'>{tx.asset}</p>
                      <p className='w-30'>{Number(tx.amount).toLocaleString()}</p>
                      <p className='w-25'>{tx.status}</p>
                      <p className='w-40 text-gray-500 dark:text-text-color'>{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Wallet
