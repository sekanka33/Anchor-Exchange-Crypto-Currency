import { useEffect, useState } from "react";
import Modal from "../Components/Modal";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import { API_BASE_URL } from "../api/config";

const TYPE_OPTIONS = ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL"];
const STATUS_OPTIONS = ["PENDING", "COMPLETED", "FAILED"];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const statusStyles = {
  COMPLETED: "bg-green-500/10 text-green-400",
  PENDING: "bg-amber-500/10 text-amber-400",
  FAILED: "bg-red-500/10 text-red-400",
};

const typeStyles = {
  BUY: "text-green-400",
  SELL: "text-red-400",
  DEPOSIT: "text-blue-400",
  WITHDRAWAL: "text-purple-400",
};

const formatAmount = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? num.toString() : num.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
};

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (typeFilter) params.set("type", typeFilter);
      if (assetFilter) params.set("asset", assetFilter.toUpperCase());
      if (statusFilter) params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      try {
        const res = await fetch(`${API_BASE_URL}/api/transactions?${params.toString()}`, {
          headers: authHeaders(),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || "Unable to load transactions.");
          return;
        }

        setTransactions(data.transactions || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      } catch {
        setError("Unable to connect to Anchor Exchange server.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [typeFilter, assetFilter, statusFilter, startDate, endDate, page]);

  const clearFilters = () => {
    setTypeFilter("");
    setAssetFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasActiveFilters = typeFilter || assetFilter || statusFilter || startDate || endDate;

  return (
    <div className="pb-20">
      <PageHeader title="Transaction History" crumbs={[{ label: "Home", to: "/" }, { label: "Transactions" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* MAIN */}
        <div className="text-slate-900 dark:text-white font-sans w-full">

          {/* FILTER BAR */}
          <div className="bg-white dark:bg-[#16181e] p-5 rounded-2xl border border-gray-200 dark:border-gray-800/50 mb-6 flex flex-wrap gap-3 items-end">

            <div>
              <label htmlFor="tx-type-filter" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                id="tx-type-filter"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-asset-filter" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Asset</label>
              <input
                id="tx-asset-filter"
                type="text"
                value={assetFilter}
                onChange={(e) => { setAssetFilter(e.target.value); setPage(1); }}
                placeholder="e.g. BTC"
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24"
              />
            </div>

            <div>
              <label htmlFor="tx-status-filter" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                id="tx-status-filter"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-start-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
              <input
                id="tx-start-date"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="tx-end-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
              <input
                id="tx-end-date"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-blue-400 font-semibold px-3 py-2"
              >
                Clear filters
              </button>
            )}

          </div>

          {/* TABLE */}
          <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">

            {loading && <p className="text-gray-500 dark:text-gray-400 text-sm p-6">Loading transactions...</p>}
            {!loading && error && <p className="text-red-500 text-sm p-6">{error}</p>}

            {!loading && !error && transactions.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm p-6">No transactions match these filters.</p>
            )}

            {!loading && !error && transactions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Fee</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1c1f27] cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td className={`px-5 py-3 font-semibold ${typeStyles[tx.type] || ""}`}>{tx.type}</td>
                        <td className="px-5 py-3">{tx.asset}</td>
                        <td className="px-5 py-3">{formatAmount(tx.amount)}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatAmount(tx.fee)}</td>
                        <td className="px-5 py-3">{formatAmount(tx.total)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[tx.status] || "bg-gray-500/10 text-gray-500 dark:text-gray-400"}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION */}
            {!loading && !error && pagination.total > 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* DETAIL PANEL */}
      {selectedTx && (
        <Modal onClose={() => setSelectedTx(null)} titleId="tx-detail-title" className="bg-white dark:bg-[#16181e] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full text-slate-900 dark:text-white">
            <div className="flex justify-between items-start mb-4">
              <h3 id="tx-detail-title" className="text-lg font-bold">Transaction #{selectedTx.id}</h3>
              <button onClick={() => setSelectedTx(null)} aria-label="Close dialog" className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <span className={`font-semibold ${typeStyles[selectedTx.type] || ""}`}>{selectedTx.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[selectedTx.status] || ""}`}>{selectedTx.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Asset</span>
                <span>{selectedTx.asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount</span>
                <span>{formatAmount(selectedTx.amount)} {selectedTx.asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Fee</span>
                <span>{formatAmount(selectedTx.fee)} {selectedTx.asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total</span>
                <span>{formatAmount(selectedTx.total)} {selectedTx.asset}</span>
              </div>
              {selectedTx.reference && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Reference</span>
                  <span className="text-right break-all font-mono text-xs">{selectedTx.reference}</span>
                </div>
              )}
              {selectedTx.tx_hash && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Tx hash</span>
                  <span className="text-right break-all font-mono text-xs">{selectedTx.tx_hash}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span>{new Date(selectedTx.created_at).toLocaleString()}</span>
              </div>
            </div>
        </Modal>
      )}

    </div>
  );
};

export default TransactionHistory;
