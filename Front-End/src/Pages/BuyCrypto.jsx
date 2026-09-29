import { useEffect, useState } from "react";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { getCoinPrice } from "../api/coingecko";
import { Link } from "react-router-dom";
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

const BuyCrypto = () => {
  const [selectedCoin, setSelectedCoin] = useState(
    cryptocurrencies[0]
  );

  const [amount, setAmount] = useState("100");

  const [price, setPrice] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [step, setStep] = useState(1);

  const [showCoinDropdown, setShowCoinDropdown] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("card");

  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [orderError, setOrderError] = useState("");

  const exchangeFeePercentage = 0.01;

  /*
   * Fetch current CoinGecko price
   */
  const fetchPrice = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getCoinPrice(selectedCoin.id);

      const currentPrice = data[selectedCoin.id]?.usd;

      if (!currentPrice) {
        throw new Error("Price not available");
      }

      setPrice(currentPrice);
    } catch (err) {
      console.error(err);
      setError("Unable to load the current crypto price.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * Get price whenever the selected coin changes
   */
  useEffect(() => {
    fetchPrice();

    // Refresh price every 30 seconds
    const interval = setInterval(() => {
      fetchPrice();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCoin]);

  /*
   * Convert USD -> crypto
   */
  const numericAmount = Number(amount) || 0;

  const fee = numericAmount * exchangeFeePercentage;

  const total = numericAmount + fee;

  const cryptoAmount =
    price && numericAmount > 0
      ? numericAmount / price
      : 0;

  /*
   * Change cryptocurrency
   */
  const handleCoinChange = (coin) => {
    setSelectedCoin(coin);
    setShowCoinDropdown(false);
  };

  /*
   * Validate before continuing
   */
  const handleContinue = (e) => {
    e.preventDefault();

    if (!amount || numericAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (numericAmount < 10) {
      setError("Minimum purchase amount is $10.");
      return;
    }

    if (numericAmount > 10000) {
      setError("Maximum purchase amount is $10,000.");
      return;
    }

    if (!price) {
      setError("Crypto price is not available yet.");
      return;
    }

    setError("");

    setStep(2);
  };

  /*
   * Go back
   */
  const handleBack = () => {
    setStep((currentStep) => currentStep - 1);
  };

  /*
   * Format USD
   */
  const formatUSD = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  /*
   * Format crypto
   */
  const formatCrypto = (value) => {
    return Number(value).toFixed(8);
  };

  /*
   * Submit the purchase to the backend — the backend recalculates price/fee
   * from scratch and is the source of truth; these numbers are for UX only.
   */
  const handlePay = async () => {
    if (submitting) return;

    setSubmitting(true);
    setOrderError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE_URL}/api/orders/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset: selectedCoin.symbol,
          amountUsd: numericAmount,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOrderError(data.message || "Unable to complete purchase.");
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
      <PageHeader title="Buy Crypto" crumbs={[{ label: "Home", to: "/" }, { label: "Buy Crypto" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* MAIN CONTENT */}
        <div className="text-slate-900 dark:text-white font-sans w-full">

          <StepIndicator steps={["Select currency", "Important Notes", "Payment Details"]} currentStep={step} />

          {/* ========================= */}
          {/* STEP 1 */}
          {/* ========================= */}

          {step === 1 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-1">
                Select Currency
              </h2>

              {/* LIVE PRICE */}
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-6">

                <span>
                  Reference Price:
                </span>

                {loading ? (
                  <span>
                    Loading...
                  </span>
                ) : price ? (
                  <span className="text-slate-900 dark:text-white font-semibold">
                    {formatUSD(price)} /{" "}
                    {selectedCoin.symbol}
                  </span>
                ) : (
                  <span>
                    Price unavailable
                  </span>
                )}

              </div>

              {/* ERROR */}
              {error && (
                <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleContinue}>

                <div className="flex items-end gap-3 mb-6 relative">

                  {/* PAY */}
                  <div className="flex-1">

                    <label htmlFor="buy-pay-amount" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Pay
                    </label>

                    <div className="flex items-center bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3">

                      <input
                        id="buy-pay-amount"
                        type="number"
                        min="10"
                        max="10000"
                        step="0.01"
                        value={amount}
                        onChange={(e) =>
                          setAmount(e.target.value)
                        }
                        className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm font-medium"
                        placeholder="0.00"
                      />

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white ml-2">

                        <span className="w-4 h-4 rounded-full bg-green-500 text-black font-bold text-[10px] flex items-center justify-center">
                          $
                        </span>

                        <span>USD</span>

                      </div>

                    </div>

                  </div>

                  {/* SWAP ICON */}
                  <div className="bg-blue-600 p-3 rounded-full text-white">
                    <img src="/src/assets/Group 564.png" alt="Exchange icon" />
                  </div>

                  {/* RECEIVE */}
                  <div className="flex-1">

                    <label htmlFor="buy-receive-amount" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Receive
                    </label>

                    <div className="relative">

                      <div className="flex items-center bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-transparent rounded-xl px-4 py-3">

                        <input
                          id="buy-receive-amount"
                          type="text"
                          value={
                            cryptoAmount
                              ? formatCrypto(cryptoAmount)
                              : "0.00000000"
                          }
                          readOnly
                          className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm font-medium"
                        />

                        {/* COIN SELECTOR */}
                        <button
                          type="button"
                          onClick={() =>
                            setShowCoinDropdown(
                              !showCoinDropdown
                            )
                          }
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer ml-2"
                        >

                          <span className="w-4 h-4 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">
                            {selectedCoin.icon}
                          </span>

                          <span>
                            {selectedCoin.symbol}
                          </span>

                          <span className="text-[10px] text-gray-600 dark:text-gray-400">
                            ▼
                          </span>

                        </button>

                      </div>

                      {/* DROPDOWN */}
                      {showCoinDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">

                          {cryptocurrencies.map((coin) => (
                            <button
                              key={coin.id}
                              type="button"
                              onClick={() =>
                                handleCoinChange(coin)
                              }
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-500/20 transition-colors text-left"
                            >

                              <span className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center">
                                {coin.icon}
                              </span>

                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {coin.symbol}
                                </p>

                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {coin.name}
                                </p>
                              </div>

                            </button>
                          ))}

                        </div>
                      )}

                    </div>

                  </div>

                </div>

                {/* BREAKDOWN */}
                <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-4 mb-6 space-y-3">

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Crypto price
                    </span>

                    <span>
                      {price
                        ? formatUSD(price)
                        : "--"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Exchange fee (1%)
                    </span>

                    <span>
                      {formatUSD(fee)}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold">
                    <span>
                      Total
                    </span>

                    <span>
                      {formatUSD(total)}
                    </span>
                  </div>

                </div>

                {/* PRICE REFRESH */}
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-5">
                  Market price provided by CoinGecko.
                  Price may change before your order is
                  confirmed.
                </p>

                {/* CONTINUE */}
                <div className="flex justify-end">

                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-600 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full transition-colors"
                  >
                    Continue
                  </button>

                </div>

              </form>

            </div>
          )}

          {/* ========================= */}
          {/* STEP 2 */}
          {/* ========================= */}

          {step === 2 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-2">
                Important Notes
              </h2>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Please review your purchase before
                continuing.
              </p>

              <div className="space-y-4">

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    You pay
                  </span>

                  <span className="font-semibold">
                    {formatUSD(numericAmount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    You receive
                  </span>

                  <span className="font-semibold">
                    {formatCrypto(cryptoAmount)}{" "}
                    {selectedCoin.symbol}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Exchange fee
                  </span>

                  <span>
                    {formatUSD(fee)}
                  </span>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between">
                  <span className="font-semibold">
                    Total
                  </span>

                  <span className="font-bold">
                    {formatUSD(total)}
                  </span>
                </div>

              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-6">

                <p className="text-sm text-yellow-400">
                  Cryptocurrency prices are volatile.
                  The final execution price may differ
                  from the reference price shown above.
                </p>

              </div>

              <div className="flex justify-between mt-8">

                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white"
                >
                  Continue
                </button>

              </div>

            </div>
          )}

          {/* ========================= */}
          {/* STEP 3 */}
          {/* ========================= */}

          {step === 3 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-2">
                Payment Details
              </h2>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Select how you would like to pay.
              </p>

              {/* PAYMENT OPTIONS */}
              <div className="space-y-3">

                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod("card")
                  }
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    paymentMethod === "card"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-300 dark:border-gray-700"
                  }`}
                >

                  <p className="font-semibold">
                    Debit / Credit Card
                  </p>

                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Pay securely using your bank card.
                  </p>

                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod("bank")
                  }
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    paymentMethod === "bank"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-300 dark:border-gray-700"
                  }`}
                >

                  <p className="font-semibold">
                    Bank Transfer
                  </p>

                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Pay using a supported bank account.
                  </p>

                </button>

              </div>

              {/* ORDER SUMMARY */}
              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 mt-6">

                <div className="flex justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">
                    Purchase
                  </span>

                  <span>
                    {selectedCoin.symbol}
                  </span>
                </div>

                <div className="flex justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">
                    Amount
                  </span>

                  <span>
                    {formatCrypto(cryptoAmount)}{" "}
                    {selectedCoin.symbol}
                  </span>
                </div>

                <div className="flex justify-between font-bold">
                  <span>
                    Total
                  </span>

                  <span>
                    {formatUSD(total)}
                  </span>
                </div>

              </div>

              {orderError && (
                <div role="alert" className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {orderError}
                </div>
              )}

              <div className="flex justify-between mt-8">

                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {submitting ? "Processing..." : `Pay ${formatUSD(total)}`}
                </button>

              </div>

            </div>
          )}

          {/* ========================= */}
          {/* STEP 4 — CONFIRMATION */}
          {/* ========================= */}

          {step === 4 && orderResult && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl text-center">

              <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                ✓
              </div>

              <h2 className="text-2xl font-bold mb-2">Purchase completed</h2>

              {orderResult.demo && (
                <p className="text-xs text-amber-400 mb-4">
                  Demo mode — no real payment provider is connected yet, so this charge was simulated.
                </p>
              )}

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 mt-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">You received</span>
                  <span className="font-semibold">
                    {formatCrypto(orderResult.order.amount)} {selectedCoin.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Price</span>
                  <span>{formatUSD(orderResult.order.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fee</span>
                  <span>{formatUSD(orderResult.order.fee)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold text-sm">
                  <span>Total charged</span>
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
                    setAmount("100");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white"
                >
                  Buy again
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

export default BuyCrypto;