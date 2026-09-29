import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { API_BASE_URL } from "../api/config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const formatUSD = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const feeRate = 0.01;

const FiatWithdraw = () => {
  const [amount, setAmount] = useState("100");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [withdrawal, setWithdrawal] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const numericAmount = Number(amount) || 0;
  const fee = Number((numericAmount * feeRate).toFixed(2));
  const receiveAmount = Number((numericAmount - fee).toFixed(2));

  const handleContinue = (e) => {
    e.preventDefault();

    if (!amount || numericAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (numericAmount < 20) {
      setError("Minimum withdrawal amount is $20.");
      return;
    }

    if (numericAmount > 10000) {
      setError("Maximum withdrawal amount is $10,000.");
      return;
    }

    if (!accountHolderName.trim() || !accountNumber.trim() || !bankName.trim()) {
      setError("Please fill in all bank details.");
      return;
    }

    setError("");
    setStep(2);
  };

  const handleBack = () => setStep((s) => s - 1);

  const pollWithdrawal = (id) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/withdrawals/${id}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) return;

        setWithdrawal(data.withdrawal);

        if (data.withdrawal.status !== "PENDING_CONFIRMATION") {
          clearInterval(pollRef.current);
        }
      } catch {
        // Transient network error — keep polling.
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/withdrawals/fiat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          amount: numericAmount,
          bankDetails: {
            accountHolderName: accountHolderName.trim(),
            accountNumber: accountNumber.trim(),
            bankName: bankName.trim(),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.message || "Unable to request withdrawal.");
        return;
      }

      setWithdrawal(data.withdrawal);
      setStep(3);
      pollWithdrawal(data.withdrawal.id);
    } catch {
      setSubmitError("Unable to connect to Anchor Exchange server.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!withdrawal || cancelling) return;

    setCancelling(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/withdrawals/${withdrawal.id}/cancel`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();

      if (res.ok) {
        if (pollRef.current) clearInterval(pollRef.current);
        setWithdrawal({ ...withdrawal, status: "CANCELLED" });
      } else {
        setSubmitError(data.message || "Unable to cancel withdrawal.");
      }
    } catch {
      setSubmitError("Unable to connect to Anchor Exchange server.");
    } finally {
      setCancelling(false);
    }
  };

  const resetFlow = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep(1);
    setWithdrawal(null);
    setAmount("100");
    setAccountHolderName("");
    setAccountNumber("");
    setBankName("");
    setSubmitError("");
  };

  return (
    <div>
      <PageHeader title="Withdraw Funds" crumbs={[{ label: "Home", to: "/" }, { label: "Withdraw" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        <div className="text-slate-900 dark:text-white font-sans w-full max-w-2xl">

          <StepIndicator steps={["Details", "Review", "Confirmation"]} currentStep={step} />

          {/* STEP 1 */}
          {step === 1 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">
              <h2 className="text-2xl font-bold mb-1">Withdraw to Bank</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">Send funds from your USD balance to your bank account.</p>

              {error && (
                <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
              )}

              <form onSubmit={handleContinue} className="space-y-5">

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Amount</label>
                  <div className="flex items-center bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3">
                    <input
                      type="number"
                      min="20"
                      max="10000"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                      aria-label="Amount in USD" placeholder="0.00"
                    />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 ml-2">USD</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Account holder name</label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700"
                    aria-label="Account holder name" placeholder="Full name on the account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700"
                    aria-label="Bank name" placeholder="e.g. First National Bank"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Account number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700"
                    aria-label="Account number" placeholder="Account number"
                  />
                </div>

                {/* BREAKDOWN */}
                <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Withdrawal fee (1%)</span>
                    <span>{formatUSD(fee)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold">
                    <span>You'll receive</span>
                    <span>{formatUSD(receiveAmount)}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-600 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full transition-colors">
                    Continue
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">
              <h2 className="text-2xl font-bold mb-2">Review Withdrawal</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Please confirm these details are correct.</p>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="font-semibold">{formatUSD(numericAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Fee</span>
                  <span>{formatUSD(fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Bank</span>
                  <span>{bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Account</span>
                  <span className="font-mono">•••• {accountNumber.slice(-4)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between font-bold">
                  <span>You'll receive</span>
                  <span>{formatUSD(receiveAmount)}</span>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-6">
                <p className="text-sm text-yellow-400">
                  A confirmation link will be sent to your email. The withdrawal will not be processed until you click it.
                </p>
              </div>

              {submitError && (
                <div role="alert" className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{submitError}</div>
              )}

              <div className="flex justify-between mt-8">
                <button type="button" onClick={handleBack} disabled={submitting} className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold disabled:opacity-50">
                  Back
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-white">
                  {submitting ? "Requesting..." : "Request Withdrawal"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — STATUS */}
          {step === 3 && withdrawal && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl text-center">

              {withdrawal.status === "PENDING_CONFIRMATION" && (
                <>
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 text-2xl animate-pulse">✉</div>
                  <h2 className="text-2xl font-bold mb-2">Check your email</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We sent a confirmation link to your email. This page updates automatically once you confirm it there.
                  </p>
                </>
              )}

              {withdrawal.status === "COMPLETED" && (
                <>
                  <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                  <h2 className="text-2xl font-bold mb-4">Withdrawal completed</h2>
                </>
              )}

              {(withdrawal.status === "CANCELLED" || withdrawal.status === "EXPIRED") && (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl">✕</div>
                  <h2 className="text-2xl font-bold mb-4">
                    {withdrawal.status === "CANCELLED" ? "Withdrawal cancelled" : "Confirmation link expired"}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Your funds have been released back to your available balance.</p>
                </>
              )}

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 mt-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="font-semibold">{formatUSD(withdrawal.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Fee</span>
                  <span>{formatUSD(withdrawal.fee)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold text-sm">
                  <span>You'll receive</span>
                  <span>{formatUSD(withdrawal.receive_amount)}</span>
                </div>
              </div>

              {submitError && <p role="alert" className="text-red-400 text-xs mt-4">{submitError}</p>}

              <div className="flex justify-center gap-4 mt-8">
                <Link to="/wallet" className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold">
                  View Wallet
                </Link>

                {withdrawal.status === "PENDING_CONFIRMATION" && (
                  <button type="button" onClick={handleCancel} disabled={cancelling} className="bg-red-500/80 hover:bg-red-500 px-8 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50">
                    {cancelling ? "Cancelling..." : "Cancel Withdrawal"}
                  </button>
                )}

                {withdrawal.status !== "PENDING_CONFIRMATION" && (
                  <button type="button" onClick={resetFlow} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white">
                    New Withdrawal
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

export default FiatWithdraw;
