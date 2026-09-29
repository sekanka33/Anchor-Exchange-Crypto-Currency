import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import { API_BASE_URL } from "../api/config";
import useNotificationSocket from "../hooks/useNotificationSocket";

const typeStyles = {
  SECURITY: "text-red-400",
  INFO: "text-blue-400",
  SUCCESS: "text-emerald-400",
};

const timeAgo = (isoString) => {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE_URL}/api/notifications?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to load notifications.");
        return;
      }

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch {
      setError("Unable to connect to Anchor Exchange server.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Live updates: a brand-new notification only ever lands on page 1
  // (newest-first ordering), so only splice it in there — otherwise just
  // bump the unread count so the header stays accurate.
  useNotificationSocket((notification) => {
    setUnreadCount((prev) => prev + 1);

    if (page === 1) {
      setNotifications((prev) => [notification, ...prev]);
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
    }
  });

  const markAsRead = async (id) => {
    const token = localStorage.getItem("token");

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(prev - 1, 0));

    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort; UI already optimistically updated
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem("token");

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {loading && <p className="text-slate-500 dark:text-gray-400">Loading notifications...</p>}

      {!loading && error && <p className="text-red-500">{error}</p>}

      {!loading && !error && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-gray-400">
          <FiBell className="text-4xl mb-3" />
          <p>No notifications yet.</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`text-left rounded-xl p-4 border transition-colors ${
                n.is_read
                  ? "border-gray-200 dark:border-line-color bg-transparent"
                  : "border-blue-500 bg-blue-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {n.type === "SECURITY" ? (
                  <FiAlertTriangle className={`mt-1 shrink-0 ${typeStyles.SECURITY}`} />
                ) : (
                  <FiCheckCircle className={`mt-1 shrink-0 ${typeStyles[n.type] || typeStyles.INFO}`} />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{n.title}</p>
                    <span className="text-xs text-slate-600 dark:text-gray-400 shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">{n.message}</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0 text-white" />}
              </div>
            </button>
          ))}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm text-slate-500 dark:text-gray-400">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-line-color disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="px-4 py-1.5 rounded-full border border-gray-300 dark:border-line-color disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
