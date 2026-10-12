import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { StatusBadge, CopyButton, DemoNotice } from "../Components/FinanceUI";
import { useFinanceConfig } from "../hooks/useFinanceConfig";
import { formatFiat, isFinalStatus } from "../utils/finance";
import { API_BASE_URL } from "../api/config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const METHODS = [
  { id: "bank", title: "Bank Transfer (EFT)", note: (rate) => (Number(rate) === 0 ? "No fee · paid from your bank" : `${Number(rate) * 100}% fee`) },
  { id: "card", title: "Debit / Credit Card", note: (rate) => `${Number(rate) * 100}% fee` },
];

const Row = ({ label, children, strong }) => (
  <div className={`flex justify-between gap-4 text-sm ${strong ? "font-semibold" : ""}`}>
    <span className="text-gray-600 dark:text-gray-400">{label}</span>
    <span className="text-right break-all">{children}</span>
  </div>
);

const card = "bg-white dark:bg-[#16181e] p-6 sm:p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl";

const DepositFiat = () => {
  const config = useFinanceConfig();
  const currencies = config.data?.fiatCurrencies || [];

  const [currencyCode, setCurrencyCode] = useState("ZAR");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deposit, setDeposit] = useState(null);
  const [demo, setDemo] = useState(false);
  const pollRef = useRef(null);

  const currency = currencies.find((c) => c.code === currencyCode);
  const fmt = (value) => formatFiat(value, currencyCode);
  const numericAmount = Number(amount) || 0;
  // Display estimate only — the backend computes the real fee.
  const feeRate = Number(currency?.deposit.feeRates[paymentMethod] ?? 0);
  const estimatedFee = Math.round(numericAmount * feeRate * 100) / 100;

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleContinue = (e) => {
    e.preventDefault();
    if (!currency) return;
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || numericAmount <= 0) {
      setError("Enter an amount with up to 2 decimal places.");
      return;
    }
    if (numericAmount < Number(currency.deposit.min)) {
      setError(`Minimum deposit is ${fmt(currency.deposit.min)}.`);
      return;
    }
    if (numericAmount > Number(currency.deposit.max)) {
      setError(`Maximum deposit is ${fmt(currency.deposit.max)}.`);
      return;
    }
    setError("");
    setStep(2);
  };

  // The deposit completes only when the payment provider confirms it to the
  // backend; the page polls for that instead of assuming success.
  const pollDeposit = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/deposits/${id}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) return;
        setDeposit(data.deposit);
        if (isFinalStatus(data.deposit.status) || data.deposit.status === "UNDER_REVIEW") clearInterval(pollRef.current);
      } catch {
        // Keep polling through a transient network error.
      }
    }, 2000);
  };

  const handleConfirmDeposit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/deposits/fiat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ amount: amount.trim(), currency: currencyCode, paymentMethod }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to create the deposit.");
        return;
      }

      setDeposit(data.deposit);
      setDemo(data.demo === true);
      setStep(4);
      pollDeposit(data.deposit.id);
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetFlow = () => {
    clearInterval(pollRef.current);
    setStep(1);
    setDeposit(null);
    setAmount("");
    setError("");
  };

  const instructions = deposit?.instructions;

  return (
    <div>
      <PageHeader title="Deposit Funds" crumbs={[{ label: "Home", to: "/" }, { label: "Deposit" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">
        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        <div className="text-slate-900 dark:text-white font-sans w-full min-w-0">
          <StepIndicator steps={["Amount", "Payment Method", "Review"]} currentStep={Math.min(step, 3)} />

          {config.loading && <p role="status" className="text-sm text-gray-600 dark:text-gray-400">Loading deposit options…</p>}
          {config.error && (
            <div role="alert" className={`${card} text-sm text-red-600 dark:text-red-400`}>
              Deposit options couldn't be loaded. <button type="button" onClick={config.reload} className="underline">Try again</button>
            </div>
          )}

          {/* STEP 1 — AMOUNT + CURRENCY */}
          {currency && step === 1 && (
            <div className={card}>
              <h2 className="text-2xl font-bold mb-1">Deposit Amount</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">Add funds to your Anchor Exchange {currency.name} balance.</p>

              {config.data?.demo && (
                <div className="mb-6">
                  <DemoNotice>No real money moves: deposits are confirmed by a simulated payment provider.</DemoNotice>
                </div>
              )}

              {error && <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">{error}</div>}

              <form onSubmit={handleContinue} noValidate>
                <fieldset className="mb-6">
                  <legend className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">Currency</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {currencies.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCurrencyCode(c.code)}
                        aria-pressed={c.code === currencyCode}
                        className={`p-3 rounded-xl border text-left transition ${c.code === currencyCode ? "border-blue-500 bg-blue-500/10" : "border-gray-300 dark:border-gray-700"}`}
                      >
                        <p className="font-semibold text-sm">{c.code}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{c.name}</p>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label htmlFor="deposit-amount" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">Amount</label>
                <div className="flex items-center bg-slate-100 dark:bg-input-field border border-blue-500 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 mr-2">{currency.symbol}</span>
                  <input
                    id="deposit-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm font-medium"
                    placeholder="0.00"
                    aria-describedby="deposit-limits"
                  />
                  <span className="text-xs font-semibold ml-2">{currency.code}</span>
                </div>
                <p id="deposit-limits" className="text-xs text-gray-600 dark:text-gray-400 mt-2 mb-6">
                  Between {fmt(currency.deposit.min)} and {fmt(currency.deposit.max)} per deposit.
                </p>

                <div className="flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full transition-colors">
                    Continue
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2 — PAYMENT METHOD */}
          {currency && step === 2 && (
            <div className={card}>
              <h2 className="text-2xl font-bold mb-2">Payment Method</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">How will you pay {fmt(amount)}?</p>

              <div className="space-y-3">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    aria-pressed={paymentMethod === m.id}
                    className={`w-full p-4 rounded-xl border text-left transition ${paymentMethod === m.id ? "border-blue-500 bg-blue-500/10" : "border-gray-300 dark:border-gray-700"}`}
                  >
                    <p className="font-semibold">{m.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{m.note(currency.deposit.feeRates[m.id])}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-between mt-8">
                <button type="button" onClick={() => setStep(1)} className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold">Back</button>
                <button type="button" onClick={() => setStep(3)} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white">Continue</button>
              </div>
            </div>
          )}

          {/* STEP 3 — REVIEW */}
          {currency && step === 3 && (
            <div className={card}>
              <h2 className="text-2xl font-bold mb-2">Review your deposit</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Your wallet is credited only after the payment provider verifies the payment.</p>

              <div className="bg-slate-100 dark:bg-[#21242d] rounded-xl p-5 space-y-3">
                <Row label="Amount">{fmt(amount)}</Row>
                <Row label="Payment method">{METHODS.find((m) => m.id === paymentMethod).title}</Row>
                <Row label="Estimated fee">{fmt(estimatedFee)}</Row>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <Row label="Estimated credit" strong>{fmt(numericAmount - estimatedFee)}</Row>
                </div>
              </div>

              {paymentMethod === "bank" && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Next you'll get a payment reference. Use it exactly as shown when you pay, so the deposit can be matched to your account.
                </p>
              )}

              {error && <div role="alert" className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">{error}</div>}

              <div className="flex justify-between mt-8">
                <button type="button" onClick={() => setStep(2)} disabled={submitting} className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold disabled:opacity-50">Back</button>
                <button type="button" onClick={handleConfirmDeposit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 text-white">
                  {submitting ? "Creating…" : "Create deposit"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — INSTRUCTIONS + STATUS */}
          {step === 4 && deposit && (
            <div className={`${card} space-y-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">
                  {deposit.status === "COMPLETED" ? "Deposit completed" : deposit.status === "FAILED" ? "Deposit failed" : "Deposit created"}
                </h2>
                <StatusBadge status={deposit.status} />
              </div>

              {demo && <DemoNotice>This deposit is simulated and will be confirmed automatically. No money is collected.</DemoNotice>}

              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Payment reference</p>
                <div className="flex items-center gap-3 rounded-xl bg-slate-100 dark:bg-[#21242d] px-4 py-3">
                  <code className="font-mono text-base font-semibold break-all flex-1">{deposit.provider_reference}</code>
                  <CopyButton value={deposit.provider_reference} />
                </div>
              </div>

              {instructions && (
                <section aria-labelledby="deposit-instructions" className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-2">
                  <h3 id="deposit-instructions" className="font-semibold">
                    {instructions.kind === "bank_transfer" ? "How to pay" : "Payment"}
                  </h3>
                  {/* Only what the payment provider supplied — never a hard-coded account. */}
                  {instructions.beneficiary && (
                    <div className="space-y-1">
                      {Object.entries(instructions.beneficiary).map(([key, value]) => (
                        <Row key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}>{String(value)}</Row>
                      ))}
                    </div>
                  )}
                  {instructions.notice && <p className="text-gray-600 dark:text-gray-400">{instructions.notice}</p>}
                </section>
              )}

              <div className="bg-slate-100 dark:bg-[#21242d] rounded-xl p-5 space-y-3">
                <Row label="Amount">{fmt(deposit.amount)}</Row>
                <Row label="Fee">{fmt(deposit.fee)}</Row>
                <Row label="Credit to wallet" strong>{fmt(deposit.net_amount)}</Row>
                <Row label="Method">{deposit.payment_method === "bank" ? "Bank transfer" : "Card"}</Row>
                <Row label="Created">{new Date(deposit.created_at).toLocaleString()}</Row>
                {deposit.completed_at && <Row label="Completed">{new Date(deposit.completed_at).toLocaleString()}</Row>}
              </div>

              {!isFinalStatus(deposit.status) && deposit.status !== "UNDER_REVIEW" && (
                <p role="status" className="text-sm text-gray-600 dark:text-gray-400">Waiting for the payment provider to confirm the payment. This page updates automatically.</p>
              )}
              {deposit.status === "UNDER_REVIEW" && (
                <p role="status" className="text-sm text-purple-700 dark:text-purple-300">The payment didn't match this deposit exactly, so our team is reviewing it. Nothing has been credited yet.</p>
              )}
              {deposit.status === "FAILED" && (
                <p role="status" className="text-sm text-red-600 dark:text-red-400">{deposit.failure_reason || "The payment could not be completed."} No funds were added to your wallet.</p>
              )}

              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/transactions" className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold">View history</Link>
                <Link to="/wallet" className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold">View Wallet</Link>
                {isFinalStatus(deposit.status) && (
                  <button type="button" onClick={resetFlow} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white">
                    {deposit.status === "FAILED" ? "Try again" : "Deposit again"}
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
