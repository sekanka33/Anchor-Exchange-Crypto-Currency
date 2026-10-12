import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { StatusBadge, CopyButton, DemoNotice } from "../Components/FinanceUI";
import { useFinanceConfig } from "../hooks/useFinanceConfig";
import { useApi } from "../hooks/useApi";
import { authFetch } from "../api/authFetch";
import { formatFiat, isFinalStatus } from "../utils/finance";

const card = "bg-white dark:bg-[#16181e] p-6 sm:p-8 rounded-2xl max-w-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl";
const input = "w-full bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700";
const label = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2";

const Row = ({ name, children, strong }) => (
  <div className={`flex justify-between gap-4 text-sm ${strong ? "font-semibold" : ""}`}>
    <span className="text-gray-600 dark:text-gray-400">{name}</span>
    <span className="text-right break-all">{children}</span>
  </div>
);

const STATUS_COPY = {
  PENDING_CONFIRMATION: "We sent a confirmation link to your email. Nothing is paid out until you click it.",
  PROCESSING: "Confirmed. The payout has been sent to the payment provider; this page updates when it confirms.",
  UNDER_REVIEW: "We're confirming the payout's status with the payment provider. Your funds stay reserved until we know the outcome.",
  COMPLETED: "The payment provider confirmed the payout.",
  FAILED: "The payout failed. The full amount is back in your available balance.",
  CANCELLED: "Cancelled. The funds are back in your available balance.",
  EXPIRED: "The confirmation link expired. The funds are back in your available balance.",
  REJECTED: "Rejected by our security team. The funds are back in your available balance.",
};

const emptyBank = { accountHolderName: "", bankName: "", accountNumber: "", branchCode: "", accountType: "" };

const FiatWithdraw = () => {
  const config = useFinanceConfig();
  const currencies = config.data?.fiatCurrencies || [];
  const wallet = useApi(() => authFetch("/api/wallet"), []);
  const beneficiaries = useApi(() => authFetch("/api/withdrawals/beneficiaries"), []);

  const [currencyCode, setCurrencyCode] = useState("ZAR");
  const [amount, setAmount] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("new");
  const [bank, setBank] = useState(emptyBank);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawal, setWithdrawal] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const idempotencyKey = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const currency = currencies.find((c) => c.code === currencyCode);
  const fmt = (value) => formatFiat(value, currencyCode);
  const saved = (beneficiaries.data?.beneficiaries || []).filter((b) => b.currency === currencyCode);
  const selected = saved.find((b) => String(b.id) === String(beneficiaryId));
  const available = (wallet.data?.balances || []).find((b) => b.assetSymbol === currencyCode)?.availableBalance ?? 0;
  const numericAmount = Number(amount) || 0;
  const feeRate = Number(currency?.withdrawal.feeRate ?? 0);
  const estimatedFee = Math.round(numericAmount * feeRate * 100) / 100;

  const chooseCurrency = (code) => {
    setCurrencyCode(code);
    setBeneficiaryId("new");
    setBank(emptyBank);
  };

  const handleContinue = (e) => {
    e.preventDefault();
    if (!currency) return;
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || numericAmount <= 0) return setError("Enter an amount with up to 2 decimal places.");
    if (numericAmount < Number(currency.withdrawal.min)) return setError(`Minimum withdrawal is ${fmt(currency.withdrawal.min)}.`);
    if (numericAmount > Number(currency.withdrawal.max)) return setError(`Maximum withdrawal is ${fmt(currency.withdrawal.max)}.`);
    if (numericAmount > Number(available)) return setError(`You have ${fmt(available)} available.`);
    if (beneficiaryId === "new") {
      if (!bank.accountHolderName.trim() || !bank.bankName.trim() || !bank.accountNumber.trim()) return setError("Fill in the account holder, bank and account number.");
      if (!/^\d{6,17}$/.test(bank.accountNumber.replace(/[\s-]/g, ""))) return setError("The account number should be 6 to 17 digits.");
      if (currency.bank.requiresBranchCode && !/^\d{6}$/.test(bank.branchCode.trim())) return setError("Enter the 6-digit branch code.");
    }
    setError("");
    idempotencyKey.current = crypto.randomUUID(); // one request per review, however many clicks
    setStep(2);
  };

  const pollWithdrawal = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await authFetch(`/api/withdrawals/${id}`);
        setWithdrawal(data.withdrawal);
        if (isFinalStatus(data.withdrawal.status)) clearInterval(pollRef.current);
      } catch {
        // Keep polling through a transient error.
      }
    }, 2500);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      let targetId = selected?.id;
      if (!targetId) {
        const savedBank = await authFetch("/api/withdrawals/beneficiaries", {
          method: "POST",
          body: JSON.stringify({ ...bank, currency: currencyCode }),
        });
        targetId = savedBank.beneficiary.id;
        beneficiaries.reload();
      }

      const data = await authFetch("/api/withdrawals/fiat", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({ amount: amount.trim(), currency: currencyCode, beneficiaryId: targetId }),
      });

      setWithdrawal(data.withdrawal);
      setStep(3);
      wallet.reload();
      pollWithdrawal(data.withdrawal.id);
    } catch (err) {
      setError(err.message || "Unable to request the withdrawal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!withdrawal || cancelling) return;
    setCancelling(true);
    try {
      const data = await authFetch(`/api/withdrawals/${withdrawal.id}/cancel`, { method: "POST" });
      clearInterval(pollRef.current);
      setWithdrawal(data.withdrawal);
      wallet.reload();
    } catch (err) {
      setError(err.message || "Unable to cancel the withdrawal.");
    } finally {
      setCancelling(false);
    }
  };

  const resetFlow = () => {
    clearInterval(pollRef.current);
    setStep(1);
    setWithdrawal(null);
    setAmount("");
    setError("");
  };

  const destination = selected
    ? `${selected.bankName} ${selected.accountNumberMasked}`
    : `${bank.bankName} •••• ${bank.accountNumber.replace(/\D/g, "").slice(-4)}`;

  return (
    <div>
      <PageHeader title="Withdraw Funds" crumbs={[{ label: "Home", to: "/" }, { label: "Withdraw" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">
        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        <div className="text-slate-900 dark:text-white font-sans w-full min-w-0">
          <StepIndicator steps={["Details", "Review", "Confirmation"]} currentStep={step} />

          {config.loading && <p role="status" className="text-sm text-gray-600 dark:text-gray-400">Loading withdrawal options…</p>}
          {config.error && (
            <div role="alert" className={`${card} text-sm text-red-600 dark:text-red-400`}>
              Withdrawal options couldn't be loaded. <button type="button" onClick={config.reload} className="underline">Try again</button>
            </div>
          )}

          {/* STEP 1 — DETAILS */}
          {currency && step === 1 && (
            <div className={card}>
              <h2 className="text-2xl font-bold mb-1">Withdraw to Bank</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">Send funds from your {currency.name} balance to your bank account.</p>

              {config.data?.demo && (
                <div className="mb-6"><DemoNotice>Payouts are simulated: no bank transfer is made.</DemoNotice></div>
              )}

              {error && <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">{error}</div>}

              <form onSubmit={handleContinue} className="space-y-5" noValidate>
                <fieldset>
                  <legend className={label}>Currency</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {currencies.map((c) => (
                      <button key={c.code} type="button" onClick={() => chooseCurrency(c.code)} aria-pressed={c.code === currencyCode}
                        className={`p-3 rounded-xl border text-left transition ${c.code === currencyCode ? "border-blue-500 bg-blue-500/10" : "border-gray-300 dark:border-gray-700"}`}>
                        <p className="font-semibold text-sm">{c.code}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{c.name}</p>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="withdraw-amount" className={label}>Amount</label>
                  <div className="flex items-center bg-slate-100 dark:bg-input-field border border-blue-500 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 mr-2">{currency.symbol}</span>
                    <input id="withdraw-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm" placeholder="0.00" aria-describedby="withdraw-hint" />
                    <button type="button" onClick={() => setAmount(String(Math.floor(Number(available) * 100) / 100))} className="text-xs font-semibold text-blue-600 dark:text-blue-400 ml-2">Max</button>
                  </div>
                  <p id="withdraw-hint" className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Available: {wallet.loading ? "…" : fmt(available)} · Limits {fmt(currency.withdrawal.min)}–{fmt(currency.withdrawal.max)}
                  </p>
                </div>

                <div>
                  <label htmlFor="withdraw-beneficiary" className={label}>Bank account</label>
                  <select id="withdraw-beneficiary" value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} className={input}>
                    {saved.map((b) => (
                      <option key={b.id} value={b.id}>{b.label ? `${b.label} — ` : ""}{b.bankName} {b.accountNumberMasked} ({b.accountHolder})</option>
                    ))}
                    <option value="new">Add a new bank account…</option>
                  </select>
                </div>

                {beneficiaryId === "new" && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="bank-holder" className={label}>Account holder name</label>
                      <input id="bank-holder" className={input} value={bank.accountHolderName} onChange={(e) => setBank({ ...bank, accountHolderName: e.target.value })} autoComplete="name" />
                    </div>
                    <div>
                      <label htmlFor="bank-name" className={label}>Bank</label>
                      <input id="bank-name" className={input} value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} placeholder="e.g. FNB" />
                    </div>
                    <div>
                      <label htmlFor="bank-number" className={label}>Account number</label>
                      <input id="bank-number" className={`${input} font-mono`} inputMode="numeric" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} autoComplete="off" />
                    </div>
                    <div>
                      <label htmlFor="bank-branch" className={label}>Branch code{currency.bank.requiresBranchCode ? "" : " (optional)"}</label>
                      <input id="bank-branch" className={input} inputMode="numeric" value={bank.branchCode} onChange={(e) => setBank({ ...bank, branchCode: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="bank-type" className={label}>Account type</label>
                      <select id="bank-type" className={input} value={bank.accountType} onChange={(e) => setBank({ ...bank, accountType: e.target.value })}>
                        <option value="">Select…</option>
                        {currency.bank.accountTypes.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <p className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-400">The account is saved for next time. Its number is stored encrypted and only the last four digits are ever shown.</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 w-40 text-white font-semibold text-sm px-8 py-2.5 rounded-full transition-colors">Continue</button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2 — REVIEW */}
          {currency && step === 2 && (
            <div className={card}>
              <h2 className="text-2xl font-bold mb-2">Review Withdrawal</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Check these details carefully: bank payouts can't be reversed.</p>

              <div className="bg-slate-100 dark:bg-[#21242d] rounded-xl p-5 space-y-3">
                <Row name="Amount">{fmt(amount)}</Row>
                <Row name={`Fee (${feeRate * 100}%)`}>{fmt(estimatedFee)}</Row>
                <Row name="To">{destination}</Row>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <Row name="You'll receive" strong>{fmt(numericAmount - estimatedFee)}</Row>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-6">
                <p className="text-sm text-amber-800 dark:text-amber-300">The amount is reserved now. A confirmation link goes to your email, and nothing is paid out until you click it.</p>
              </div>

              {error && <div role="alert" className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">{error}</div>}

              <div className="flex justify-between mt-8">
                <button type="button" onClick={() => setStep(1)} disabled={submitting} className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold disabled:opacity-50">Back</button>
                <button type="button" onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 text-white">
                  {submitting ? "Requesting…" : "Request Withdrawal"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — STATUS */}
          {step === 3 && withdrawal && (
            <div className={`${card} space-y-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Withdrawal {withdrawal.reference}</h2>
                <StatusBadge status={withdrawal.status} />
              </div>

              <p role="status" className="text-sm text-gray-600 dark:text-gray-400">{STATUS_COPY[withdrawal.status]}</p>
              {withdrawal.failure_reason && withdrawal.status !== "COMPLETED" && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Reason: {withdrawal.failure_reason}</p>
              )}

              <div className="bg-slate-100 dark:bg-[#21242d] rounded-xl p-5 space-y-3">
                <Row name="Amount">{fmt(withdrawal.amount)}</Row>
                <Row name="Fee">{fmt(withdrawal.fee)}</Row>
                <Row name="You'll receive" strong>{fmt(withdrawal.receive_amount)}</Row>
                <Row name="To">{withdrawal.bank_details?.bankName} {withdrawal.bank_details?.accountNumberMasked}</Row>
                <Row name="Requested">{new Date(withdrawal.created_at).toLocaleString()}</Row>
                {withdrawal.completed_at && <Row name="Paid out">{new Date(withdrawal.completed_at).toLocaleString()}</Row>}
                {withdrawal.provider_reference && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Payout reference</span>
                    <span className="flex items-center gap-2 min-w-0"><code className="font-mono break-all">{withdrawal.provider_reference}</code><CopyButton value={withdrawal.provider_reference} /></span>
                  </div>
                )}
              </div>

              {error && <p role="alert" className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/transactions" className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold">View history</Link>
                {withdrawal.status === "PENDING_CONFIRMATION" && (
                  <button type="button" onClick={handleCancel} disabled={cancelling} className="bg-red-600 hover:bg-red-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50">
                    {cancelling ? "Cancelling…" : "Cancel Withdrawal"}
                  </button>
                )}
                {isFinalStatus(withdrawal.status) && (
                  <button type="button" onClick={resetFlow} className="bg-blue-600 hover:bg-blue-700 px-8 py-2.5 rounded-full text-sm font-semibold text-white">New Withdrawal</button>
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
