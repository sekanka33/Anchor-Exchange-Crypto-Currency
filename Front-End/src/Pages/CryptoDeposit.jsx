import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import { API_BASE_URL } from "../api/config";
import { StatusBadge, DemoNotice } from "../Components/FinanceUI";
import { formatCrypto as formatAmount, isFinalStatus } from "../utils/finance";

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


const CryptoDeposit = () => {
  const [selectedAsset, setSelectedAsset] = useState(assets[0]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState("");

  const [addressData, setAddressData] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");

  const [copied, setCopied] = useState("");

  const [simulateAmount, setSimulateAmount] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState("");
  const [activeTxHash, setActiveTxHash] = useState(null);
  const [recent, setRecent] = useState([]);

  const pollRef = useRef(null);

  // This asset+network's deposits, as recorded by the backend from custody
  // events (newest first). Refreshed while any is still confirming.
  const loadRecent = async (asset = selectedAsset.symbol, network = selectedNetwork) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/deposits?limit=50`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return [];
      const rows = (data.deposits || []).filter((d) => d.type === "CRYPTO" && d.asset === asset && d.network === network);
      setRecent(rows);
      return rows;
    } catch {
      return [];
    }
  };

  // Load available networks whenever the selected asset changes.
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
    setAddressData(null);
    setActiveTxHash(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }, [selectedAsset]);

  // Fetch (or generate) the deposit address whenever asset+network settle.
  useEffect(() => {
    if (!selectedNetwork) return;

    const fetchAddress = async () => {
      setAddressLoading(true);
      setAddressError("");
      setAddressData(null);

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/deposits/crypto/address?asset=${selectedAsset.symbol}&network=${selectedNetwork}`,
          { headers: authHeaders() }
        );
        const data = await res.json();

        if (!res.ok) {
          setAddressError(data.message || "Unable to load deposit address.");
          return;
        }

        setAddressData(data);
        loadRecent(selectedAsset.symbol, selectedNetwork);
      } catch {
        setAddressError("Unable to connect to Anchor Exchange server.");
      } finally {
        setAddressLoading(false);
      }
    };

    fetchAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset, selectedNetwork]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  // Polls until every recent deposit has reached a final state.
  const pollDeposits = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const rows = await loadRecent();
      if (rows.length > 0 && rows.every((d) => isFinalStatus(d.status) || d.status === "UNDER_REVIEW")) {
        clearInterval(pollRef.current);
      }
    }, 1500);
  };

  const handleSimulateDeposit = async () => {
    if (simulating) return;

    const numericAmount = Number(simulateAmount);

    if (!simulateAmount || numericAmount <= 0) {
      setSimulateError("Enter a valid amount.");
      return;
    }

    setSimulating(true);
    setSimulateError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/deposits/crypto/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          asset: selectedAsset.symbol,
          network: selectedNetwork,
          amount: numericAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSimulateError(data.message || "Unable to simulate deposit.");
        return;
      }

      // The demo custodian reports the transfer shortly; the backend records
      // it from that event, exactly as it would a real one.
      setActiveTxHash(data.txHash);
      pollDeposits();
    } catch {
      setSimulateError("Unable to connect to Anchor Exchange server.");
    } finally {
      setSimulating(false);
    }
  };

  // Rows for the asset+network on screen (a reload may still be in flight
  // after switching).
  const visibleRecent = recent.filter((d) => d.asset === selectedAsset.symbol && d.network === selectedNetwork);
  const activeDeposit = visibleRecent.find((d) => d.tx_hash === activeTxHash) || null;

  const resetSimulation = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveTxHash(null);
    setSimulateAmount("");
    setSimulateError("");
  };

  return (
    <div>
      <PageHeader title="Receive Crypto" crumbs={[{ label: "Home", to: "/" }, { label: "Receive Crypto" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* MAIN */}
        <div className="text-slate-900 dark:text-white font-sans w-full min-w-0 max-w-2xl">

          <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

            <h2 className="text-2xl font-bold mb-1">Receive Crypto</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-6">
              Send crypto from an external wallet to your Anchor Exchange address.
            </p>

            {/* ASSET + NETWORK SELECTORS */}
            <div className="flex gap-3 mb-6">

              <div className="flex-1 relative">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Asset</label>
                <button
                  type="button"
                  onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                  className="w-full flex items-center justify-between bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs">
                      {selectedAsset.icon}
                    </span>
                    {selectedAsset.symbol}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">▼</span>
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
                        <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs">
                          {a.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{a.symbol}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{a.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {networks.length > 0 && (
                <div className="flex-1">
                  <label htmlFor="deposit-network" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Network</label>
                  <select
                    id="deposit-network"
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-blue-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {networks.map((n) => (
                      <option key={n.code} value={n.code} className="bg-white dark:bg-[#21242d] text-slate-900 dark:text-white">
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            {addressLoading && <p className="text-sm text-gray-600 dark:text-gray-400">Generating your deposit address...</p>}

            {addressError && (
              <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {addressError}
              </div>
            )}

            {addressData && (
              <>
                {addressData.demo ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                    <p className="text-sm text-red-600 dark:text-red-400 font-semibold">⚠ Demo address — do not send real funds</p>
                    <p className="text-xs text-red-700 dark:text-red-300/80 mt-1">{addressData.warning}</p>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-sm text-amber-800 dark:text-amber-300">
                    {addressData.warning}
                  </div>
                )}

                <p className="text-sm mb-6">
                  Send only <strong>{selectedAsset.symbol}</strong> on the <strong>{addressData.networkLabel}</strong> network.
                  Sending another asset, or using another network, will lose the funds.
                </p>

                {/* ADDRESS + QR */}
                <div className="flex flex-col sm:flex-row gap-6 mb-6 items-start">
                  <img
                    src={addressData.qrCode}
                    alt="Deposit address QR code"
                    className="w-36 h-36 rounded-xl bg-white p-2 flex-shrink-0"
                  />

                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {selectedAsset.symbol} address ({addressData.networkLabel})
                      </p>
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3">
                        <span className="text-sm font-mono break-all flex-1">{addressData.address}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(addressData.address, "address")}
                          className="text-xs text-blue-400 font-semibold flex-shrink-0"
                        >
                          {copied === "address" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {addressData.memo && (
                      <div>
                        <p className="text-xs text-amber-400 mb-1 font-semibold">
                          Destination tag / memo (required — deposits without it may be lost)
                        </p>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-3">
                          <span className="text-sm font-mono flex-1">{addressData.memo}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(addressData.memo, "memo")}
                            className="text-xs text-blue-400 font-semibold flex-shrink-0"
                          >
                            {copied === "memo" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>Minimum deposit: {addressData.minDeposit} {selectedAsset.symbol}</p>
                      <p>Credited after {addressData.requiredConfirmations} network confirmation{addressData.requiredConfirmations === 1 ? "" : "s"}</p>
                      <p>Deposits below the minimum are not credited automatically.</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* DEMO TOOLS — simulate an incoming on-chain deposit */}
            {addressData?.demo && (
              <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-5 mt-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Demo Tools</p>
                <div className="mb-4">
                  <DemoNotice>
                    No blockchain is being watched. This sends a simulated transfer to your demo address; the demo
                    custodian then reports it and its confirmations, as a real one would.
                  </DemoNotice>
                </div>

                {!activeTxHash && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={simulateAmount}
                      onChange={(e) => setSimulateAmount(e.target.value)}
                      aria-label="Simulated deposit amount"
                      placeholder={`Amount (${selectedAsset.symbol})`}
                      className="w-full sm:flex-1 sm:min-w-0 bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={handleSimulateDeposit}
                      disabled={simulating}
                      className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50 text-white"
                    >
                      {simulating ? "Sending..." : "Simulate Deposit"}
                    </button>
                  </div>
                )}

                {simulateError && (
                  <p role="alert" className="text-red-400 text-xs mt-3">{simulateError}</p>
                )}

                {activeTxHash && !activeDeposit && (
                  <p role="status" className="text-sm text-gray-600 dark:text-gray-400">Waiting for the custodian to detect the transfer…</p>
                )}

                {activeDeposit && (
                  <div className="mt-1">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        {formatAmount(activeDeposit.amount, activeDeposit.asset)}
                      </span>
                      <span className="flex items-center gap-2">
                        {activeDeposit.status !== "COMPLETED" && (
                          <span className="text-xs text-gray-600 dark:text-gray-400">{activeDeposit.confirmations}/{activeDeposit.required_confirmations}</span>
                        )}
                        <StatusBadge status={activeDeposit.status} />
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 dark:bg-[#21242d] text-slate-900 dark:text-white rounded-full overflow-hidden">
                      <div
                        className={`h-full ${activeDeposit.status === "COMPLETED" ? "bg-green-500" : "bg-blue-600"} transition-all text-white`}
                        style={{
                          width: `${Math.min(
                            100,
                            (activeDeposit.confirmations / Math.max(activeDeposit.required_confirmations, 1)) * 100
                          )}%`,
                        }}
                      ></div>
                    </div>

                    <p className="text-xs text-gray-500 mt-2 break-all">Tx hash: {activeDeposit.tx_hash}</p>

                    {isFinalStatus(activeDeposit.status) && (
                      <div className="flex gap-3 mt-4">
                        <Link
                          to="/wallet"
                          className="px-5 py-2 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold"
                        >
                          View Wallet
                        </Link>
                        <button
                          type="button"
                          onClick={resetSimulation}
                          className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-full text-sm font-semibold text-white"
                        >
                          Simulate another
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {addressData && (
            <section aria-labelledby="recent-deposits" className="mt-6 bg-white dark:bg-[#16181e] p-6 rounded-2xl border border-gray-200 dark:border-gray-800/50">
              <h2 id="recent-deposits" className="text-lg font-bold mb-3">Recent {selectedAsset.symbol} deposits ({addressData.networkLabel})</h2>
              {visibleRecent.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No deposits to this address yet. Incoming transfers appear here once the network sees them.</p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                  {visibleRecent.map((d) => (
                    <li key={d.id} className="py-3 text-sm space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{formatAmount(d.amount, d.asset)}</span>
                        <span className="flex items-center gap-2">
                          {!isFinalStatus(d.status) && d.status !== "UNDER_REVIEW" && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">{d.confirmations}/{d.required_confirmations} confirmations</span>
                          )}
                          <StatusBadge status={d.status} />
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 break-all">Tx: {d.tx_hash}</p>
                      {d.failure_reason && <p className="text-xs text-gray-600 dark:text-gray-400">{d.failure_reason}</p>}
                      <p className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

        </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default CryptoDeposit;
