import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import StepIndicator from "../Components/StepIndicator";
import { API_BASE_URL } from "../api/config";

const assets = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ" },
  { symbol: "BNB", name: "BNB", icon: "₿" },
  { symbol: "SOL", name: "Solana", icon: "S" },
  { symbol: "XRP", name: "XRP", icon: "X" },
  { symbol: "DOGE", name: "Dogecoin", icon: "Ð" },
  { symbol: "ADA", name: "Cardano", icon: "A" },
  { symbol: "USDT", name: "Tether", icon: "₮" },
];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const CryptoWithdraw = () => {
  const [selectedAsset, setSelectedAsset] = useState(assets[0]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const currentNetwork = networks.find((n) => n.code === selectedNetwork);

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [withdrawal, setWithdrawal] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const pollRef = useRef(null);

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/deposits/crypto/networks?asset=${selectedAsset.symbol}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) return;

        setNetworks(data.networks || []);
        setSelectedNetwork(data.networks?.[0]?.code || "");
      } catch {
        setNetworks([]);
      }
    };

    fetchNetworks();
  }, [selectedAsset]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const numericAmount = Number(amount) || 0;

  const handleContinue = (e) => {
    e.preventDefault();

    if (!amount || numericAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!address.trim()) {
      setError("Please enter a destination address.");
      return;
    }

    if (currentNetwork?.requiresMemo && memo && !/^\d+$/.test(memo)) {
      setError("Destination tag/memo must be numeric.");
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
      const res = await fetch(`${API_BASE_URL}/api/withdrawals/crypto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          asset: selectedAsset.symbol,
          network: selectedNetwork,
          amount: numericAmount,
          address: address.trim(),
          memo: memo.trim() || undefined,
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
    setAmount("");
    setAddress("");
    setMemo("");
    setSubmitError("");
  };

  return (
    <div>
      <PageHeader title="Send Crypto" crumbs={[{ label: "Home", to: "/" }, { label: "Send Crypto" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        <div className="text-slate-900 dark:text-white font-sans w-full max-w-2xl">

          <StepIndicator steps={["Details", "Review", "Confirmation"]} currentStep={step} />

          {/* STEP 1 */}
          {step === 1 && (
            <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">
              <h2 className="text-2xl font-bold mb-1">Withdraw Crypto</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Send crypto from your Anchor Exchange wallet to an external address.</p>

              {error && (
                <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
              )}

              <form onSubmit={handleContinue} className="space-y-5">

                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Asset</label>
                    <button
                      type="button"
                      onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                      className="w-full flex items-center justify-between bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">{selectedAsset.icon}</span>
                        {selectedAsset.symbol}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">▼</span>
                    </button>

                    {showAssetDropdown && (
                      <div className="absolute mt-2 w-full bg-white dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
                        {assets.map((a) => (
                          <button
                            key={a.symbol}
                            type="button"
                            onClick={() => {
                              setSelectedAsset(a);
                              setShowAssetDropdown(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-500/20"
                          >
                            <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs">{a.icon}</span>
                            <div>
                              <p className="text-sm font-semibold">{a.symbol}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{a.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {networks.length > 1 && (
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Network</label>
                      <select
                        value={selectedNetwork}
                        onChange={(e) => setSelectedNetwork(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {networks.map((n) => (
                          <option key={n.code} value={n.code} className="bg-white dark:bg-[#21242d] text-slate-900 dark:text-white">{n.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Amount</label>
                  <div className="flex items-center bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-transparent outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                      aria-label="Withdrawal amount" placeholder="0.00"
                    />
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-2">{selectedAsset.symbol}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Destination address ({currentNetwork?.label || "..."})
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700"
                    aria-label="Destination address" placeholder="Paste the recipient's address"
                  />
                </div>

                {currentNetwork?.requiresMemo && (
                  <div>
                    <label className="block text-sm font-semibold text-amber-400 mb-2">
                      Destination tag / memo (optional, but required by some exchanges)
                    </label>
                    <input
                      type="text"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700"
                      placeholder="Numeric tag"
                    />
                  </div>
                )}

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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Double-check the destination address — crypto sent to the wrong address cannot be recovered.</p>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Amount</span>
                  <span className="font-semibold">{amount} {selectedAsset.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Network</span>
                  <span>{currentNetwork?.label}</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Address</span>
                  <span className="font-mono text-sm text-right break-all">{address}</span>
                </div>
                {memo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Memo</span>
                    <span className="font-mono">{memo}</span>
                  </div>
                )}
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
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
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Your funds have been released back to your available balance.</p>
                </>
              )}

              <div className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl p-5 mt-4 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Amount</span>
                  <span className="font-semibold">{withdrawal.amount} {withdrawal.asset}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Network fee</span>
                  <span>{withdrawal.fee} {withdrawal.asset}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold text-sm">
                  <span>Recipient receives</span>
                  <span>{withdrawal.receive_amount} {withdrawal.asset}</span>
                </div>
                {withdrawal.tx_hash && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tx hash</span>
                    <span className="break-all text-right">{withdrawal.tx_hash}</span>
                  </div>
                )}
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

export default CryptoWithdraw;
