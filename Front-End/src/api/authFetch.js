import { API_BASE_URL } from "./config";
import { AUTH_EXPIRED_EVENT } from "../context/AuthContext";

// JSON request with the signed-in user's token. Throws the backend's
// `message` on a non-2xx response so callers can show it directly.
export const authFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  // Expired or invalid session: tell AuthProvider to sign out everywhere.
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  if (!res.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = res.status;
    throw error;
  }
  return data;
};
