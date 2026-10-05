import { API_BASE_URL } from "./config";

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
  if (!res.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = res.status;
    throw error;
  }
  return data;
};
