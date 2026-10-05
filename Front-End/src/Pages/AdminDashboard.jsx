import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutDashboard, Users, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, List } from "lucide-react";
import AdminOverview from "../Components/AdminOverview";
import { useCurrency } from "../hooks/useCurrency";
import Modal from "../Components/Modal";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/config";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});


const statusStyles = {
  COMPLETED: "bg-green-500/10 text-green-700 dark:text-green-400",
  OPEN: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PENDING_CONFIRMATION: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
  CANCELLED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  EXPIRED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const TABS = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Users", icon: Users },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Deposits", icon: ArrowDownToLine },
  { label: "Withdrawals", icon: ArrowUpFromLine },
  { label: "Orders", icon: List },
];

// Placeholder row for a table with no matching records.
const EmptyRow = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-text-color">
      No data available yet.
    </td>
  </tr>
);

const PaginationBar = ({ pagination, setPage }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-line-color text-sm text-gray-600 dark:text-gray-400">
      <span>
        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-line-color disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-input-field"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-line-color disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-input-field"
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
  const { formatMoney } = useCurrency();
  const navigate = useNavigate();

  const [accessState, setAccessState] = useState("checking"); // checking | granted | denied
  // The active section lives in the URL (?tab=withdrawals) so the sidebar
  // highlight follows navigation, refreshes and the browser back button.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab =
    TABS.find((t) => t.label.toLowerCase() === (searchParams.get("tab") || "").toLowerCase())?.label || "Overview";
  const setActiveTab = (tab) => setSearchParams(tab === "Overview" ? {} : { tab: tab.toLowerCase() });

  // Overview
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");

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
        if (res.ok) setStats(data);
        else setStatsError(data.message || "Unable to load statistics");
        setAccessState("granted");
      } catch {
        setAccessState("denied");
      }
    };

    checkAccess();
  }, [navigate]);

  const reloadStats = async () => {
    setStatsError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStats(data);
    } catch (err) {
      setStatsError(err.message || "Unable to load statistics");
    }
  };

  // Jump from an Overview panel to a section, optionally pre-filtered by status.
  const openTab = (tab, statusFilter = "") => {
    if (tab === "Deposits") { setDepositStatusFilter(statusFilter); setDepositsPage(1); }
    if (tab === "Withdrawals") { setWithdrawalStatusFilter(statusFilter); setWithdrawalsPage(1); }
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-hero-dark text-slate-900 dark:text-white">Checking access...</div>;
  }

  if (accessState === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-hero-dark text-slate-900 dark:text-white gap-4">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-gray-600 dark:text-gray-400">This area is restricted to Anchor Exchange administrators.</p>
        <Link to="/dashboard" className="text-blue-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const navButton = (tab, compact = false) => {
    const Icon = tab.icon;
    const active = activeTab === tab.label;
    return (
      <button
        key={tab.label}
        type="button"
        onClick={() => setActiveTab(tab.label)}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-colors border whitespace-nowrap ${compact ? "px-3 py-2" : "w-full px-3 py-2.5"} ${
          active
            ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
            : "border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-input-field hover:text-slate-900 dark:hover:text-white"
        }`}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{tab.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-hero-dark text-slate-900 dark:text-white font-sans flex">
      {/* SIDEBAR (desktop) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-gray-200 dark:border-line-color bg-white dark:bg-dark-void p-5 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
        <p className="text-lg font-bold mb-1">Admin Panel</p>
        <p className="text-xs text-gray-500 dark:text-text-color mb-6">Exchange operations</p>
        <nav aria-label="Admin sections" className="space-y-1">
          {TABS.map((tab) => navButton(tab))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 pb-20">
        {/* SECTION NAV (mobile / tablet) */}
        <div className="lg:hidden border-b border-gray-200 dark:border-line-color bg-white dark:bg-dark-void px-4 pt-5 pb-3">
          <p className="text-lg font-bold mb-3">Admin Panel</p>
          <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => navButton(tab, true))}
          </nav>
        </div>

      <div className="px-4 md:px-8 py-6">
        <h1 className="sr-only">Admin Panel — {activeTab}</h1>

        {/* OVERVIEW */}
        {activeTab === "Overview" && (
          <AdminOverview
            stats={stats}
            statsError={statsError}
            onReloadStats={reloadStats}
            onOpenTab={openTab}
            onViewUser={openUserDetail}
          />
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
                className="bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-gray-300 dark:border-line-color rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-80"
              />
            </div>

            <div className="bg-white dark:bg-crypto-color rounded-2xl border border-gray-200 dark:border-line-color overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-line-color">
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Verified</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && <EmptyRow colSpan={6} />}
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => openUserDetail(u)}
                        className="border-b border-gray-200 dark:border-line-color hover:bg-gray-50 dark:hover:bg-input-field cursor-pointer transition-colors"
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
                          {u.is_suspended ? <span className="text-red-600 dark:text-red-400 font-semibold">Suspended</span> : <span className="text-green-700 dark:text-green-400">Active</span>}
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
                className="bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-gray-300 dark:border-line-color rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All types</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAWAL">Withdrawal</option>
              </select>
            </div>

            <div className="bg-white dark:bg-crypto-color rounded-2xl border border-gray-200 dark:border-line-color overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-line-color">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 && <EmptyRow colSpan={6} />}
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-200 dark:border-line-color">
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
                className="bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-gray-300 dark:border-line-color rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="bg-white dark:bg-crypto-color rounded-2xl border border-gray-200 dark:border-line-color overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-line-color">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Asset</th>
                      <th className="px-5 py-3 font-medium">Net Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.length === 0 && <EmptyRow colSpan={6} />}
                    {deposits.map((d) => (
                      <tr key={d.id} className="border-b border-gray-200 dark:border-line-color">
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
                className="bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-gray-300 dark:border-line-color rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                <option value="PENDING_CONFIRMATION">Pending confirmation</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className="bg-white dark:bg-crypto-color rounded-2xl border border-gray-200 dark:border-line-color overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-line-color">
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
                    {withdrawals.length === 0 && <EmptyRow colSpan={7} />}
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="border-b border-gray-200 dark:border-line-color">
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
                className="bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white border border-gray-300 dark:border-line-color rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All sides</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>

            <div className="bg-white dark:bg-crypto-color rounded-2xl border border-gray-200 dark:border-line-color overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-line-color">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">User</th>
                      <th className="px-5 py-3 font-medium">Pair</th>
                      <th className="px-5 py-3 font-medium">Side</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && <EmptyRow colSpan={6} />}
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-200 dark:border-line-color">
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(o.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3">{o.user_email}</td>
                        <td className="px-5 py-3">{o.pair}</td>
                        <td className={`px-5 py-3 font-semibold ${o.side === "BUY" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{o.side}</td>
                        <td className="px-5 py-3">{formatMoney(o.total)}</td>
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
      </div>

      {/* USER DETAIL PANEL */}
      {selectedUser && (
        <Modal onClose={() => setSelectedUser(null)} titleId="user-detail-title" className="bg-white dark:bg-crypto-color border border-gray-200 dark:border-line-color rounded-2xl p-6 max-w-lg w-full text-slate-900 dark:text-white max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 id="user-detail-title" className="text-lg font-bold">{selectedUser.email}</h3>
              <button onClick={() => setSelectedUser(null)} aria-label="Close dialog" className="text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">✕</button>
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

                <div className="flex justify-between bg-slate-100 dark:bg-input-field rounded-xl p-4">
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
                        <div key={b.asset_symbol} className="flex justify-between bg-slate-100 dark:bg-input-field rounded-lg px-3 py-2">
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

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-line-color">
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
