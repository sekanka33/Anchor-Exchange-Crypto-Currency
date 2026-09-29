import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CreateAnAccoutSection from "../Components/CreateAnAccoutSection";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
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

const formatCrypto = (value) => Number(value).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");

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
  const [activeDeposit, setActiveDeposit] = useState(null);

  const pollRef = useRef(null);

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
    setActiveDeposit(null);
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
      } catch {
        setAddressError("Unable to connect to Anchor Exchange server.");
      } finally {
        setAddressLoading(false);
      }
    };

    fetchAddress();
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

  const pollDeposit = (depositId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/deposits/${depositId}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) return;

        setActiveDeposit(data.deposit);

        if (data.deposit.status !== "PENDING") {
          clearInterval(pollRef.current);
        }
      } catch {
        // Transient network error — keep polling.
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

      setActiveDeposit(data.deposit);
      pollDeposit(data.deposit.id);
    } catch {
      setSimulateError("Unable to connect to Anchor Exchange server.");
    } finally {
      setSimulating(false);
    }
  };

  const resetSimulation = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveDeposit(null);
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
        <div className="text-slate-900 dark:text-white font-sans w-full max-w-2xl">

          <div className="bg-white dark:bg-[#16181e] p-8 rounded-2xl border border-gray-200 dark:border-gray-800/50 shadow-xl">

            <h2 className="text-2xl font-bold mb-1">Receive Crypto</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
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
                        <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs">
                          {a.icon}
                        </span>
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
                      <option key={n.code} value={n.code} className="bg-white dark:bg-[#21242d] text-slate-900 dark:text-white">
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            {addressLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Generating your deposit address...</p>}

            {addressError && (
              <div role="alert" className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {addressError}
              </div>
            )}

            {addressData && (
              <>
                {/* DEMO WARNING */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-red-400 font-semibold">⚠ Demo address — do not send real funds</p>
                  <p className="text-xs text-red-300/80 mt-1">{addressData.warning}</p>
                </div>

                {/* ADDRESS + QR */}
                <div className="flex flex-col sm:flex-row gap-6 mb-6 items-start">
                  <img
                    src={addressData.qrCode}
                    alt="Deposit address QR code"
                    className="w-36 h-36 rounded-xl bg-white p-2 flex-shrink-0"
                  />

                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
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

                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>Minimum deposit: {addressData.minDeposit} {selectedAsset.symbol}</p>
                      <p>Required confirmations: {addressData.requiredConfirmations}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* DEMO TOOLS — simulate an incoming on-chain deposit */}
            {addressData && (
              <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-5 mt-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Demo Tools</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  There's no real blockchain being watched in this demo. In production, an incoming transaction to the
                  address above would be detected automatically. Use this to simulate that happening.
                </p>

                {!activeDeposit && (
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

                {activeDeposit && (
                  <div className="mt-1">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        {activeDeposit.amount} {activeDeposit.asset}
                      </span>
                      <span
                        className={
                          activeDeposit.status === "COMPLETED"
                            ? "text-green-400 font-semibold"
                            : "text-blue-400 font-semibold"
                        }
                      >
                        {activeDeposit.status === "COMPLETED"
                          ? "Completed"
                          : `${activeDeposit.confirmations}/${activeDeposit.required_confirmations} confirmations`}
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

                    {activeDeposit.status === "COMPLETED" && (
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

        </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default CryptoDeposit;
