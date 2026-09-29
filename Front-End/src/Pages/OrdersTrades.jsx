import { useEffect, useState } from "react";
import Modal from "../Components/Modal";
import PageHeader from "../Components/PageHeader";
import MoneyFlowSidebar from "../Components/MoneyFlowSidebar";
import { API_BASE_URL } from "../api/config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const sideStyles = {
  BUY: "text-emerald-400",
  SELL: "text-rose-500",
};

const statusStyles = {
  COMPLETED: "bg-green-500/10 text-green-400",
  OPEN: "bg-amber-500/10 text-amber-400",
  CANCELLED: "bg-red-500/10 text-red-400",
};

const TABS = [
  { key: "ALL", label: "All Orders", status: "" },
  { key: "OPEN", label: "Open Orders", status: "OPEN" },
  { key: "CLOSED", label: "Closed Orders", status: "COMPLETED" },
];

const formatAmount = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? num.toString() : num.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
};

const OrdersTrades = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("ALL");
  const [sideFilter, setSideFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [page, setPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ page: String(page), limit: "20" });
      const tab = TABS.find((t) => t.key === activeTab);
      if (tab?.status) params.set("status", tab.status);
      if (sideFilter) params.set("side", sideFilter);
      if (assetFilter) params.set("asset", assetFilter.toUpperCase());

      try {
        const res = await fetch(`${API_BASE_URL}/api/orders?${params.toString()}`, {
          headers: authHeaders(),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || "Unable to load orders.");
          return;
        }

        setOrders(data.orders || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      } catch {
        setError("Unable to connect to Anchor Exchange server.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [activeTab, sideFilter, assetFilter, page]);

  return (
    <div className="pb-20 text-slate-900 dark:text-white font-sans">
      <PageHeader title="Orders & Trades" crumbs={[{ label: "Home", to: "/" }, { label: "Orders & Trades" }]} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-16 lg:gap-30 pt-6 md:pt-20 pb-10 md:pb-20 px-4 md:px-16 lg:px-30">

        <MoneyFlowSidebar />

        <div className="hidden md:block h-140 w-0 border-r-2 border-gray-200 dark:border-hero-dark"></div>

        {/* MAIN */}
        <div className="w-full">

          {/* TABS + FILTERS */}
          <div className="bg-white dark:bg-[#16181e] p-5 rounded-2xl border border-gray-200 dark:border-gray-800/50 mb-6">
            <div className="flex items-center gap-6 text-sm font-semibold mb-4 border-b border-gray-200 dark:border-gray-800/40 pb-4">
              {TABS.map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  aria-pressed={activeTab === tab.key}
                  onClick={() => { setActiveTab(tab.key); setPage(1); }}
                  className={`cursor-pointer pb-1 ${
                    activeTab === tab.key
                      ? "text-slate-900 dark:text-white border-b-2 border-indigo-500"
                      : "text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label htmlFor="ot-side-filter" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Side</label>
                <select
                  id="ot-side-filter"
                  value={sideFilter}
                  onChange={(e) => { setSideFilter(e.target.value); setPage(1); }}
                  className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </div>

              <div>
                <label htmlFor="ot-asset-filter" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Asset</label>
                <input
                  id="ot-asset-filter"
                  type="text"
                  value={assetFilter}
                  onChange={(e) => { setAssetFilter(e.target.value); setPage(1); }}
                  placeholder="e.g. BTC"
                  className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24"
                />
              </div>

              {(sideFilter || assetFilter) && (
                <button
                  type="button"
                  onClick={() => { setSideFilter(""); setAssetFilter(""); setPage(1); }}
                  className="text-xs text-blue-400 font-semibold px-3 py-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">

            {loading && <p className="text-gray-500 dark:text-gray-400 text-sm p-6">Loading orders...</p>}
            {!loading && error && <p className="text-red-500 text-sm p-6">{error}</p>}

            {!loading && !error && orders.length === 0 && activeTab === "OPEN" && (
              <p className="text-gray-500 dark:text-gray-400 text-sm p-6">
                No open orders — Anchor Exchange currently only executes market orders, which fill instantly, so orders never stay open.
              </p>
            )}

            {!loading && !error && orders.length === 0 && activeTab !== "OPEN" && (
              <p className="text-gray-500 dark:text-gray-400 text-sm p-6">No orders match these filters.</p>
            )}

            {!loading && !error && orders.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Pair</th>
                      <th className="px-5 py-3 font-medium">Side</th>
                      <th className="px-5 py-3 font-medium">Price</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1c1f27] cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(order.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 font-semibold">{order.pair}</td>
                        <td className={`px-5 py-3 font-semibold ${sideStyles[order.side] || ""}`}>{order.side}</td>
                        <td className="px-5 py-3">${formatAmount(order.price)}</td>
                        <td className="px-5 py-3">{formatAmount(order.amount)}</td>
                        <td className="px-5 py-3">${formatAmount(order.total)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[order.status] || "bg-gray-500/10 text-gray-500 dark:text-gray-400"}`}>
                            {order.status}
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
      {selectedOrder && (
        <Modal onClose={() => setSelectedOrder(null)} titleId="order-detail-title" className="bg-white dark:bg-[#16181e] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full text-slate-900 dark:text-white">
            <div className="flex justify-between items-start mb-4">
              <h3 id="order-detail-title" className="text-lg font-bold">Order #{selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} aria-label="Close dialog" className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Pair</span>
                <span className="font-semibold">{selectedOrder.pair}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Side</span>
                <span className={`font-semibold ${sideStyles[selectedOrder.side] || ""}`}>{selectedOrder.side}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <span>{selectedOrder.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[selectedOrder.status] || ""}`}>{selectedOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Price</span>
                <span>${formatAmount(selectedOrder.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount</span>
                <span>{formatAmount(selectedOrder.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Filled</span>
                <span>{formatAmount(selectedOrder.filled_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Fee</span>
                <span>${formatAmount(selectedOrder.fee)}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>${formatAmount(selectedOrder.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span>{new Date(selectedOrder.created_at).toLocaleString()}</span>
              </div>
            </div>
        </Modal>
      )}

    </div>
  );
};

export default OrdersTrades;
