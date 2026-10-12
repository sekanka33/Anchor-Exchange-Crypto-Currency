import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../api/config";
import { AuthContext, AUTH_EXPIRED_EVENT } from "../context/AuthContext";

const STORAGE_KEYS = ["token", "userId", "role"];

const readToken = () => {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
};

const clearStorage = () => {
  try {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing to clear.
  }
};

// Milliseconds until the JWT's `exp`, or null if it can't be read. Only used
// to schedule sign-out; the server still validates every request.
const msUntilExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 - Date.now() : null;
  } catch {
    return null;
  }
};

// The signed-in user's role always comes from the server (login response or
// GET /api/users/profile), never from localStorage, so editing browser
// storage can't change what the app lets you open. The backend enforces the
// same rules on every API call regardless.
//
// status: "loading" | "authenticated" | "anonymous" | "error" (couldn't reach
// the server to verify a stored session)
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => ({
    status: readToken() ? "loading" : "anonymous",
    user: null,
    reason: null,
  }));

  const signOut = useCallback((reason = null) => {
    clearStorage();
    setSession({ status: "anonymous", user: null, reason });
  }, []);

  const signIn = useCallback((token, user) => {
    try {
      localStorage.setItem("token", token);
      if (user?.id) localStorage.setItem("userId", String(user.id));
    } catch {
      // The session still works for this tab.
    }
    if (user?.role === "admin" || user?.role === "user") {
      setSession({ status: "authenticated", user: { id: user.id, email: user.email, role: user.role }, reason: null });
    } else {
      // No trustworthy role in the response: verify with the server first.
      setSession({ status: "loading", user: null, reason: null });
    }
  }, []);

  // Asks the server who the stored token belongs to. Callers only invoke it
  // when a token exists.
  const verify = useCallback(() => {
    const token = readToken();

    return fetch(`${API_BASE_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          // Expired/invalid token, deleted or suspended account.
          const data = await res.json().catch(() => ({}));
          signOut(res.status === 403 ? data.message || "Your account can't be used right now." : "expired");
          return;
        }
        if (!res.ok) throw new Error("Session check failed");

        const { user } = await res.json();
        if (user?.role !== "admin" && user?.role !== "user") throw new Error("Unknown role");

        setSession({ status: "authenticated", user: { id: user.id, email: user.email, role: user.role }, reason: null });
      })
      .catch(() => {
        // Can't verify: never guess a role. Guards show a retry screen.
        setSession((prev) => (prev.status === "authenticated" ? prev : { status: "error", user: null, reason: null }));
      });
  }, [signOut]);

  // Verify a stored session on startup, or after a login whose response
  // didn't carry a usable role.
  useEffect(() => {
    if (session.status === "loading") verify();
  }, [session.status, verify]);

  // Sign out when the token expires, when any API call reports 401, when
  // another tab signs out, and re-check the role when the tab regains focus
  // (picks up promotion, demotion, or suspension).
  useEffect(() => {
    const token = readToken();
    const remaining = session.status === "authenticated" ? msUntilExpiry(token) : null;
    const timer = remaining === null ? null : setTimeout(() => signOut("expired"), Math.max(0, remaining));

    const onExpired = () => signOut("expired");
    const onStorage = (e) => {
      if (e.key === "token" || e.key === null) {
        if (readToken()) verify();
        else signOut();
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || session.status !== "authenticated") return;
      if (readToken()) verify();
      else signOut();
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session.status, signOut, verify]);

  const value = useMemo(
    () => ({ ...session, signIn, signOut, retry: verify }),
    [session, signIn, signOut, verify]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
