import { useEffect, useState } from "react";
import Modal from "../Components/Modal";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const formatUSD = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const statusStyles = {
  COMPLETED: "bg-green-500/10 text-green-400",
  PENDING: "bg-amber-500/10 text-amber-400",
  PENDING_CONFIRMATION: "bg-amber-500/10 text-amber-400",
  FAILED: "bg-red-500/10 text-red-400",
  CANCELLED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  EXPIRED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const TABS = ["Overview", "Users", "Transactions", "Deposits", "Withdrawals", "Orders"];

const PaginationBar = ({ pagination, page, setPage }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
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
  );
};

const StatusBadge = ({ status }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[status] || "bg-gray-500/10 text-gray-600 dark:text-gray-400"}`}>
    {status}
  </span>
);

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [accessState, setAccessState] = useState("checking"); // checking | granted | denied
  const [activeTab, setActiveTab] = useState("Overview");

  // Overview
  const [stats, setStats] = useState(null);

  // Users
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState(null);
  const [usersPage, setUsersPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [userActionError, setUserActionError] = useState("");

  // Transactions
  const [transactions, setTransactions] = useState([]);
  const [txPagination, setTxPagination] = useState(null);
  const [txPage, setTxPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState("");

  // Deposits
  const [deposits, setDeposits] = useState([]);
  const [depositsPagination, setDepositsPagination] = useState(null);
  const [depositsPage, setDepositsPage] = useState(1);
  const [depositStatusFilter, setDepositStatusFilter] = useState("");

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalsPagination, setWithdrawalsPagination] = useState(null);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("");
  const [rejectingId, setRejectingId] = useState(null);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersPagination, setOrdersPagination] = useState(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [orderSideFilter, setOrderSideFilter] = useState("");

  // Gate: confirm admin access server-side before rendering anything sensitive.
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: authHeaders() });

        if (res.status === 401) {
          navigate("/signin");
          return;
        }

        if (res.status === 403) {
          setAccessState("denied");
          return;
        }

        const data = await res.json();
        setStats(data);
        setAccessState("granted");
      } catch {
        setAccessState("denied");
      }
    };

    checkAccess();
  }, [navigate]);

  useEffect(() => {
    if (accessState !== "granted" || activeTab !== "Users") return;

    const params = new URLSearchParams({ page: String(usersPage), limit: "20" });
    if (userSearch) params.set("search", userSearch);

    fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setUsersPagination(data.pagination || null);
      })
      .catch(() => {});
  }, [accessState, activeTab, usersPage, userSearch]);

  useEffect(() => {
    if (accessState !== "granted" || activeTab !== "Transactions") return;

    const params = new URLSearchParams({ page: String(txPage), limit: "20" });
    if (txTypeFilter) params.set("type", txTypeFilter);

    fetch(`${API_BASE_URL}/api/admin/transactions?${params.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data.transactions || []);
        setTxPagination(data.pagination || null);
      })
      .catch(() => {});
  }, [accessState, activeTab, txPage, txTypeFilter]);

  useEffect(() => {
    if (accessState !== "granted" || activeTab !== "Deposits") return;

    const params = new URLSearchParams({ page: String(depositsPage), limit: "20" });
    if (depositStatusFilter) params.set("status", depositStatusFilter);

    fetch(`${API_BASE_URL}/api/admin/deposits?${params.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setDeposits(data.deposits || []);
        setDepositsPagination(data.pagination || null);
      })
      .catch(() => {});
  }, [accessState, activeTab, depositsPage, depositStatusFilter]);

  const fetchWithdrawals = () => {
    const params = new URLSearchParams({ page: String(withdrawalsPage), limit: "20" });
    if (withdrawalStatusFilter) params.set("status", withdrawalStatusFilter);

    fetch(`${API_BASE_URL}/api/admin/withdrawals?${params.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setWithdrawals(data.withdrawals || []);
        setWithdrawalsPagination(data.pagination || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (accessState !== "granted" || activeTab !== "Withdrawals") return;
    fetchWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessState, activeTab, withdrawalsPage, withdrawalStatusFilter]);

  useEffect(() => {
    if (accessState !== "granted" || activeTab !== "Orders") return;

    const params = new URLSearchParams({ page: String(ordersPage), limit: "20" });
    if (orderSideFilter) params.set("side", orderSideFilter);

    fetch(`${API_BASE_URL}/api/admin/orders?${params.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setOrdersPagination(data.pagination || null);
      })
      .catch(() => {});
  }, [accessState, activeTab, ordersPage, orderSideFilter]);

  const openUserDetail = async (user) => {
    setSelectedUser(user);
    setUserDetail(null);
    setUserActionError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setUserDetail(data);
    } catch {
      // best-effort
    }
  };

  const refreshUsersList = () => {
    const params = new URLSearchParams({ page: String(usersPage), limit: "20" });
    if (userSearch) params.set("search", userSearch);

    fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setUsersPagination(data.pagination || null);
      })
      .catch(() => {});
  };

  const handleRoleChange = async (userId, newRole) => {
    setUserActionError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUserActionError(data.message || "Unable to update role.");
        return;
      }

      openUserDetail(selectedUser);
      refreshUsersList();
    } catch {
      setUserActionError("Unable to connect to Anchor Exchange server.");
    }
  };

  const handleSuspensionChange = async (userId, suspended) => {
    setUserActionError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/suspension`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ suspended }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUserActionError(data.message || "Unable to update suspension.");
        return;
      }

      openUserDetail(selectedUser);
      refreshUsersList();
    } catch {
      setUserActionError("Unable to connect to Anchor Exchange server.");
    }
  };

  const handleRejectWithdrawal = async (id) => {
    if (rejectingId) return;

    const reason = window.prompt("Reason for rejecting this withdrawal (optional):") || "";

    setRejectingId(id);

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) fetchWithdrawals();
    } catch {
      // best-effort
    } finally {
      setRejectingId(null);
    }
  };

  if (accessState === "checking") {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0d0e12] text-slate-900 dark:text-white">Checking access...</div>;
  }

  if (accessState === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0d0e12] text-slate-900 dark:text-white gap-4">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-gray-600 dark:text-gray-400">This area is restricted to Anchor Exchange administrators.</p>
        <Link to="/dashboard" className="text-blue-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0e12] text-slate-900 dark:text-white font-sans pb-20">
      <div className="px-4 md:px-8 pt-6 md:pt-10 pb-6 border-b border-gray-200 dark:border-gray-800/50">
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage users, transactions, deposits, withdrawals and orders.</p>
      </div>

      {/* TABS */}
      <div className="flex gap-2 px-4 md:px-8 pt-6 overflow-x-auto border-b border-gray-200 dark:border-gray-800/50 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            aria-pressed={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === tab ? "bg-white dark:bg-[#16181e] text-slate-900 dark:text-white border-b-2 border-indigo-500" : "text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4 md:px-8 py-6">

        {/* OVERVIEW */}
        {activeTab === "Overview" && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 p-5">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Users</p>
              <p className="text-2xl font-bold">{stats.users.total}</p>
              <p className="text-xs text-gray-500 mt-2">{stats.users.verified} verified · {stats.users.newLast7Days} new (7d)</p>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 p-5">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fiat Deposits</p>
              <p className="text-2xl font-bold">{formatUSD(stats.deposits.fiatCompletedTotalUsd)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.deposits.fiatCompletedCount} fiat · {stats.deposits.cryptoCompletedCount} crypto · {stats.deposits.pending} pending
              </p>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 p-5">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fiat Withdrawals</p>
              <p className="text-2xl font-bold">{formatUSD(stats.withdrawals.fiatCompletedTotalUsd)}</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.withdrawals.fiatCompletedCount} fiat · {stats.withdrawals.cryptoCompletedCount} crypto · {stats.withdrawals.pendingConfirmation} awaiting confirmation
              </p>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 p-5">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Orders</p>
              <p className="text-2xl font-bold">{stats.orders.total}</p>
              <p className="text-xs text-gray-500 mt-2">{stats.orders.buy} buy · {stats.orders.sell} sell</p>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 p-5">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Transactions</p>
              <p className="text-2xl font-bold">{stats.transactions.total}</p>
            </div>

          </div>
        )}

        {/* USERS */}
        {activeTab === "Users" && (
          <div>
            <div className="mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1); }}
                placeholder="Search by email, name or username"
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-80"
              />
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Verified</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => openUserDetail(u)}
                        className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1c1f27] cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3">{u.email}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.fullname || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-indigo-500/10 text-indigo-400" : "bg-gray-500/10 text-gray-600 dark:text-gray-400"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3">{u.is_verified ? "Yes" : "No"}</td>
                        <td className="px-5 py-3">
                          {u.is_suspended ? <span className="text-red-400 font-semibold">Suspended</span> : <span className="text-green-400">Active</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={usersPagination} page={usersPage} setPage={setUsersPage} />
            </div>
          </div>
        )}

        {/* TRANSACTIONS */}
        {activeTab === "Transactions" && (
          <div>
            <div className="mb-4">
              <select
                value={txTypeFilter}
                onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All types</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAWAL">Withdrawal</option>
              </select>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-200 dark:border-gray-800/50">
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">{t.user_email}</td>
                        <td className="px-5 py-3 font-semibold">{t.type}</td>
                        <td className="px-5 py-3">{t.asset}</td>
                        <td className="px-5 py-3">{Number(t.total).toLocaleString()}</td>
                        <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={txPagination} page={txPage} setPage={setTxPage} />
            </div>
          </div>
        )}

        {/* DEPOSITS */}
        {activeTab === "Deposits" && (
          <div>
            <div className="mb-4">
              <select
                value={depositStatusFilter}
                onChange={(e) => { setDepositStatusFilter(e.target.value); setDepositsPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Net Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d) => (
                      <tr key={d.id} className="border-b border-gray-200 dark:border-gray-800/50">
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(d.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">{d.user_email}</td>
                        <td className="px-5 py-3">{d.type}</td>
                        <td className="px-5 py-3">{d.asset}</td>
                        <td className="px-5 py-3">{Number(d.net_amount).toLocaleString()}</td>
                        <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={depositsPagination} page={depositsPage} setPage={setDepositsPage} />
            </div>
          </div>
        )}

        {/* WITHDRAWALS */}
        {activeTab === "Withdrawals" && (
          <div>
            <div className="mb-4">
              <select
                value={withdrawalStatusFilter}
                onChange={(e) => { setWithdrawalStatusFilter(e.target.value); setWithdrawalsPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                <option value="PENDING_CONFIRMATION">Pending confirmation</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="border-b border-gray-200 dark:border-gray-800/50">
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">{w.user_email}</td>
                        <td className="px-5 py-3">{w.type}</td>
                        <td className="px-5 py-3">{w.asset}</td>
                        <td className="px-5 py-3">{Number(w.amount).toLocaleString()}</td>
                        <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                        <td className="px-5 py-3">
                          {w.status === "PENDING_CONFIRMATION" && (
                            <button
                              type="button"
                              onClick={() => handleRejectWithdrawal(w.id)}
                              disabled={rejectingId === w.id}
                              className="text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
                            >
                              {rejectingId === w.id ? "Rejecting..." : "Reject"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={withdrawalsPagination} page={withdrawalsPage} setPage={setWithdrawalsPage} />
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === "Orders" && (
          <div>
            <div className="mb-4">
              <select
                value={orderSideFilter}
                onChange={(e) => { setOrderSideFilter(e.target.value); setOrdersPage(1); }}
                className="bg-slate-100 dark:bg-[#21242d] text-slate-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All sides</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>

            <div className="bg-white dark:bg-[#16181e] rounded-2xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Pair</th>
                      <th className="px-5 py-3 font-medium">Side</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-200 dark:border-gray-800/50">
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">{o.user_email}</td>
                        <td className="px-5 py-3">{o.pair}</td>
                        <td className={`px-5 py-3 font-semibold ${o.side === "BUY" ? "text-emerald-400" : "text-rose-500"}`}>{o.side}</td>
                        <td className="px-5 py-3">${Number(o.total).toLocaleString()}</td>
                        <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar pagination={ordersPagination} page={ordersPage} setPage={setOrdersPage} />
            </div>
          </div>
        )}

      </div>

      {/* USER DETAIL PANEL */}
      {selectedUser && (
        <Modal onClose={() => setSelectedUser(null)} titleId="user-detail-title" className="bg-white dark:bg-[#16181e] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-lg w-full text-slate-900 dark:text-white max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 id="user-detail-title" className="text-lg font-bold">{selectedUser.email}</h3>
              <button onClick={() => setSelectedUser(null)} aria-label="Close dialog" className="text-gray-600 dark:text-gray-400 hover:text-white">✕</button>
            </div>

            {!userDetail && <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>}

            {userDetail && (
              <div className="space-y-5 text-sm">

                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-gray-600 dark:text-gray-400">Full name</span><p>{userDetail.user.fullname} {userDetail.user.surname}</p></div>
                  <div><span className="text-gray-600 dark:text-gray-400">Country</span><p>{userDetail.user.country || "—"}</p></div>
                  <div><span className="text-gray-600 dark:text-gray-400">Verified</span><p>{userDetail.user.is_verified ? "Yes" : "No"}</p></div>
                  <div><span className="text-gray-600 dark:text-gray-400">KYC status</span><p>{userDetail.user.kyc_status}</p></div>
                  <div><span className="text-gray-600 dark:text-gray-400">Joined</span><p>{new Date(userDetail.user.created_at).toLocaleDateString()}</p></div>
                  <div><span className="text-gray-600 dark:text-gray-400">Role</span><p className="capitalize">{userDetail.user.role}</p></div>
                </div>

                <div className="flex justify-between bg-slate-100 dark:bg-[#21242d] rounded-xl p-4">
                  <div className="text-center">
                    <p className="text-lg font-bold">{userDetail.counts.orders}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Orders</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{userDetail.counts.deposits}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Deposits</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{userDetail.counts.withdrawals}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Withdrawals</p>
                  </div>
                </div>

                {userDetail.balances.length > 0 && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">Wallet balances</p>
                    <div className="grid grid-cols-2 gap-2">
                      {userDetail.balances.filter((b) => Number(b.available_balance) > 0 || Number(b.locked_balance) > 0).map((b) => (
                        <div key={b.asset_symbol} className="flex justify-between bg-slate-100 dark:bg-[#21242d] rounded-lg px-3 py-2">
                          <span>{b.asset_symbol}</span>
                          <span>{Number(b.available_balance).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userActionError && (
                  <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">{userActionError}</div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                  {userDetail.user.role === "user" ? (
                    <button
                      onClick={() => handleRoleChange(userDetail.user.id, "admin")}
                      className="px-4 py-2 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/30"
                    >
                      Grant admin
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRoleChange(userDetail.user.id, "user")}
                      className="px-4 py-2 rounded-full bg-gray-500/20 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-500/30"
                    >
                      Revoke admin
                    </button>
                  )}

                  {userDetail.user.is_suspended ? (
                    <button
                      onClick={() => handleSuspensionChange(userDetail.user.id, false)}
                      className="px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30"
                    >
                      Reinstate account
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspensionChange(userDetail.user.id, true)}
                      className="px-4 py-2 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30"
                    >
                      Suspend account
                    </button>
                  )}
                </div>

              </div>
            )}
        </Modal>
      )}

    </div>
  );
};

export default AdminDashboard;
