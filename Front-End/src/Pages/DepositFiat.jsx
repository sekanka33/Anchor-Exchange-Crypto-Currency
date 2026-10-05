import { useEffect, useRef, useState } from "react";
import { useCurrency } from "../hooks/useCurrency";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { API_BASE_URL } from "../api/config";

const fiatCurrencies = [
  { code: "USD", label: "US Dollar", enabled: true },
  { code: "EUR", label: "Euro", enabled: false },
  { code: "GBP", label: "British Pound", enabled: false },
];

const feeRates = {
  card: 0.015,
  bank: 0,
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const formatUSD = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const DepositFiat = () => {
  const { currency: displayCurrency, formatMoney } = useCurrency();
  // Transactions settle in USD; show the display-currency equivalent alongside.
  const fmt = (usd) =>
    displayCurrency === "USD" ? formatUSD(usd) : `${formatUSD(usd)} (≈ ${formatMoney(usd)})`;
  const [currency, setCurrency] = useState("USD");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [amount, setAmount] = useState("100");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [deposit, setDeposit] = useState(null);
  const [depositStatus, setDepositStatus] = useState(null);
  const pollRef = useRef(null);

  const numericAmount = Number(amount) || 0;
  const fee = Number((numericAmount * feeRates[paymentMethod]).toFixed(2));
  const netAmount = Number((numericAmount - fee).toFixed(2));

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleContinue = (e) => {
    e.preventDefault();

    if (!amount || numericAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (numericAmount < 10) {
      setError("Minimum deposit amount is $10.");
      return;
    }

    if (numericAmount > 10000) {
      setError("Maximum deposit amount is $10,000.");
      return;
    }

    setError("");
    setStep(2);
  };

  const handleBack = () => setStep((s) => s - 1);

  /*
   * Deposits are asynchronous: the backend creates a PENDING record, then
   * confirms it a moment later via a signed webhook call. The frontend polls
   * for the final status instead of trusting a synchronous response.
   */
  const pollDepositStatus = (depositId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/deposits/${depositId}`, {
          headers: authHeaders(),
        });

        const data = await res.json();

        if (!res.ok) return;

        if (data.deposit.status !== "PENDING") {
          clearInterval(pollRef.current);
          setDepositStatus(data.deposit.status);
        }
      } catch {
        // Keep polling — a transient network error shouldn't abandon the check.
      }
    }, 1500);
  };

  const handleConfirmDeposit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setOrderError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/deposits/fiat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          amount: numericAmount,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOrderError(data.message || "Unable to initiate deposit.");
        return;
      }

      setDeposit(data.deposit);
      setDepositStatus(data.deposit.status);
      setStep(4);
      pollDepositStatus(data.deposit.id);
    } catch {
      setOrderError("Unable to connect to Anchor Exchange server.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setDeposit(null);
    setDepositStatus(null);
    setAmount("100");
    setOrderError("");
  };

  return (
    <div>
      <PageHeader title="Deposit Funds" crumbs={[{ label: "Home", to: "/" }, { label: "Deposit" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* MAIN */}
        <div className="text-slate-900 dark:text-white font-sans w-full">

          <StepIndicator steps={["Amount", "Important Notes", "Payment Method"]} currentStep={step} />

          {/* STEP 1 — AMOUNT + CURRENCY */}
          {step === 1 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-1">Deposit Amount</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">
                Add funds to your Anchor Exchange USD balance.
              </p>

              {error && (
                <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleContinue}>

                <div className="mb-6">
                  <label className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Amount
                  </label>

                  <div className="flex items-center bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3 relative">
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm font-medium"
                      aria-label="Amount in USD" placeholder="0.00"
                    />

                    <button
                      type="button"
                      onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white ml-2"
                    >
                      <span>{currency}</span>
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">▼</span>
                    </button>

                    {showCurrencyDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                        {fiatCurrencies.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            disabled={!c.enabled}
                            onClick={() => {
                              setCurrency(c.code);
                              setShowCurrencyDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                              c.enabled ? "hover:bg-blue-500/20" : "opacity-40 cursor-not-allowed"
                            }`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.code}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{c.label}</p>
                            </div>
                            {!c.enabled && <span className="text-[10px] text-gray-500">Coming soon</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* BREAKDOWN */}
                <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Estimated fee</span>
                    <span>{fmt(fee)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold">
                    <span>You'll receive</span>
                    <span>{fmt(netAmount)}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 mb-5">
                  The exact fee depends on the payment method you choose next.
                </p>

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

          {/* STEP 2 — IMPORTANT NOTES */}
          {step === 2 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-2">Important Notes</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Please review your deposit before continuing.
              </p>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Deposit amount</span>
                  <span className="font-semibold">{formatUSD(numericAmount)} {currency}</span>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-6">
                <p className="text-sm text-yellow-400">
                  Funds are added to your wallet once the payment provider confirms your deposit. This usually takes a few seconds.
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

          {/* STEP 3 — PAYMENT METHOD */}
          {step === 3 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

              <h2 className="text-2xl font-bold mb-2">Payment Method</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Select how you would like to fund your deposit.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    paymentMethod === "card" ? "border-blue-500 bg-blue-500/10" : "border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <p className="font-semibold">Debit / Credit Card</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Instant — 1.5% fee</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    paymentMethod === "bank" ? "border-blue-500 bg-blue-500/10" : "border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <p className="font-semibold">Bank Transfer</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">No fee</p>
                </button>
              </div>

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 mt-6">
                <div className="flex justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">Amount</span>
                  <span>{fmt(numericAmount)}</span>
                </div>
                <div className="flex justify-between mb-3">
                  <span className="text-gray-600 dark:text-gray-400">Fee</span>
                  <span>-{fmt(fee)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>You'll receive</span>
                  <span>{fmt(netAmount)}</span>
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
                  onClick={handleConfirmDeposit}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-white"
                >
                  {submitting ? "Processing..." : `Deposit ${fmt(numericAmount)}`}
                </button>
              </div>

            </div>
          )}

          {/* STEP 4 — STATUS */}
          {step === 4 && deposit && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl text-center">

              {depositStatus === "PENDING" && (
                <>
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 text-2xl animate-pulse">
                    ⏳
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Confirming your deposit...</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We're waiting for your payment provider to confirm this deposit. This page will update automatically.
                  </p>
                </>
              )}

              {depositStatus === "COMPLETED" && (
                <>
                  <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                    ✓
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Deposit completed</h2>
                </>
              )}

              {depositStatus === "FAILED" && (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                    ✕
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Deposit failed</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Your payment could not be processed. No funds were added to your wallet.
                  </p>
                </>
              )}

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 mt-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="font-semibold">{fmt(deposit.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fee</span>
                  <span>{fmt(deposit.fee)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold text-sm">
                  <span>Net deposit</span>
                  <span>{fmt(deposit.net_amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Reference</span>
                  <span>{deposit.provider_reference}</span>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-8">
                <Link
                  to="/wallet"
                  className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold"
                >
                  View Wallet
                </Link>
                {depositStatus !== "PENDING" && (
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white"
                  >
                    {depositStatus === "FAILED" ? "Try again" : "Deposit again"}
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default DepositFiat;
