import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { getCoinPrice } from "../api/coingecko";
import { API_BASE_URL } from "../api/config";

const cryptocurrencies = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    icon: "₿",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    icon: "Ξ",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    icon: "₿",
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    icon: "S",
  },
  {
    id: "tether",
    symbol: "USDT",
    name: "Tether",
    icon: "₮",
  },
];

const SellCrypto = () => {
  const [selectedCoin, setSelectedCoin] = useState(
    cryptocurrencies[0]
  );

  const [amount, setAmount] = useState("0.001");

  const [price, setPrice] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [step, setStep] = useState(1);

  const [showDropdown, setShowDropdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [orderError, setOrderError] = useState("");

  const feePercentage = 0.01;

  const fetchPrice = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getCoinPrice(selectedCoin.id);

      const currentPrice = data[selectedCoin.id]?.usd;

      if (!currentPrice) {
        throw new Error("Price unavailable");
      }

      setPrice(currentPrice);
    } catch (err) {
      console.error(err);
      setError("Unable to load the current crypto price.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();

    const interval = setInterval(() => {
      fetchPrice();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCoin]);

  const cryptoAmount = Number(amount) || 0;

  const grossUSD = cryptoAmount * (price || 0);

  const fee = grossUSD * feePercentage;

  const receiveUSD = grossUSD - fee;

  const handleContinue = (e) => {
    e.preventDefault();

    if (!amount || cryptoAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!price) {
      setError("Crypto price is not available yet.");
      return;
    }

    setError("");
    setStep(2);
  };

  const formatUSD = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  /*
   * Submit the sale to the backend — the backend recalculates price, fee,
   * and validates the available balance from scratch.
   */
  const handleConfirmSale = async () => {
    if (submitting) return;

    setSubmitting(true);
    setOrderError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE_URL}/api/orders/sell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset: selectedCoin.symbol,
          amount: cryptoAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOrderError(data.message || "Unable to complete sale.");
        return;
      }

      setOrderResult(data);
      setStep(4);
    } catch {
      setOrderError("Unable to connect to Anchor Exchange server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>

      <PageHeader title="Sell Crypto" crumbs={[{ label: "Home", to: "/" }, { label: "Sell Crypto" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* MAIN */}
        <div className="text-slate-900 dark:text-white font-sans w-full">

          <StepIndicator steps={["Select currency", "Important Notes", "Payment Details"]} currentStep={step} />

          {/* STEP 1 */}
          {step === 1 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-1">
                Sell Crypto
              </h2>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">

                {loading ? (
                  "Loading current price..."
                ) : price ? (
                  `Reference Price: ${formatUSD(price)} / ${selectedCoin.symbol}`
                ) : (
                  "Price unavailable"
                )}

              </p>

              {error && (
                <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleContinue}>

                <div className="flex items-end gap-3 mb-6">

                  {/* CRYPTO */}
                  <div className="flex-1">

                    <label htmlFor="sell-amount" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Sell
                    </label>

                    <div className="flex items-center bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3">

                      <input
                        id="sell-amount"
                        type="number"
                        min="0"
                        step="0.00000001"
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value)
                        }
                        className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowDropdown(!showDropdown)
                        }
                        className="flex items-center gap-2 ml-2"
                      >

                        <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">
                          {selectedCoin.icon}
                        </span>

                        {selectedCoin.symbol}

                        <span className="text-gray-500 dark:text-gray-400">
                          ▼
                        </span>

                      </button>

                    </div>

                    {showDropdown && (
                      <div className="absolute mt-2 bg-white dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden z-50">

                        {cryptocurrencies.map((coin) => (
                          <button
                            key={coin.id}
                            type="button"
                            onClick={() => {
                              setSelectedCoin(coin);
                              setShowDropdown(false);
                            }}
                            className="w-full px-5 py-3 text-left hover:bg-blue-500/20"
                          >
                            {coin.icon} {coin.symbol}
                          </button>
                        ))}

                      </div>
                    )}

                  </div>

                  <div className="bg-blue-600 p-3 rounded-full text-white">
                    <img src="/src/assets/Group 564.png" alt="Exchange icon" />
                  </div>

                  {/* USD */}
                  <div className="flex-1">

                    <label htmlFor="sell-receive-amount" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Receive
                    </label>

                    <div className="flex items-center bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3">

                      <input
                        id="sell-receive-amount"
                        type="text"
                        readOnly
                        value={
                          price
                            ? formatUSD(grossUSD)
                            : "$0.00"
                        }
                        className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                      />

                      <span className="text-sm font-semibold">
                        USD
                      </span>

                    </div>

                  </div>

                </div>

                {/* BREAKDOWN */}
                <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-4 space-y-3 mb-6">

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Market value
                    </span>

                    <span>
                      {formatUSD(grossUSD)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Selling fee (1%)
                    </span>

                    <span>
                      -{formatUSD(fee)}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold">
                    <span>
                      You receive
                    </span>

                    <span>
                      {formatUSD(receiveUSD)}
                    </span>
                  </div>

                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                  Market price provided by CoinGecko.
                  The final execution price may change.
                </p>

                <div className="flex justify-end">

                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-600 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full"
                  >
                    Continue
                  </button>

                </div>

              </form>

            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50">

              <h2 className="text-2xl font-bold mb-4">
                Confirm Sale
              </h2>

              <div className="space-y-4">

                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Selling
                  </span>

                  <span>
                    {amount} {selectedCoin.symbol}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Market value
                  </span>

                  <span>
                    {formatUSD(grossUSD)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Fee
                  </span>

                  <span>
                    -{formatUSD(fee)}
                  </span>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between font-bold">
                  <span>
                    You receive
                  </span>

                  <span>
                    {formatUSD(receiveUSD)}
                  </span>
                </div>

              </div>

              <div className="flex justify-between mt-8">

                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700"
                >
                  Back
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="bg-blue-600 px-8 py-2.5 rounded-full text-white"
                >
                  Continue
                </button>

              </div>

            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50">

              <h2 className="text-2xl font-bold mb-4">
                Payment Details
              </h2>

              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Choose where you want to receive your
                funds.
              </p>

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white p-5 rounded-xl">

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Amount to receive
                </p>

                <p className="text-2xl font-bold mt-2">
                  {formatUSD(receiveUSD)}
                </p>

              </div>

              {orderError && (
                <div role="alert" className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {orderError}
                </div>
              )}

              <div className="flex justify-between mt-8">

                <button
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  onClick={handleConfirmSale}
                  disabled={submitting}
                  className="bg-blue-600 px-8 py-2.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {submitting ? "Processing..." : "Confirm Sale"}
                </button>

              </div>

            </div>
          )}

          {/* STEP 4 — CONFIRMATION */}
          {step === 4 && orderResult && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 text-center">

              <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                ✓
              </div>

              <h2 className="text-2xl font-bold mb-4">Sale completed</h2>

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">You sold</span>
                  <span className="font-semibold">
                    {orderResult.order.amount} {selectedCoin.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Price</span>
                  <span>{formatUSD(orderResult.order.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Fee</span>
                  <span>-{formatUSD(orderResult.order.fee)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold text-sm">
                  <span>You received</span>
                  <span>{formatUSD(orderResult.transaction.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Reference</span>
                  <span>{orderResult.transaction.reference}</span>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-8">
                <Link
                  to="/wallet"
                  className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold"
                >
                  View Wallet
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOrderResult(null);
                    setAmount("0.001");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white"
                >
                  Sell again
                </button>
              </div>

            </div>
          )}

        </div>
      </div>

      <CreateAnAccoutSection />

    </div>
  );
};

export default SellCrypto;