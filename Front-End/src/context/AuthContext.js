import { createContext } from "react";

export const AuthContext = createContext(null);

// Fired by authFetch (and anything else) when the API answers 401, so the
// whole app drops the session at once.
export const AUTH_EXPIRED_EVENT = "auth:expired";

// Where each role lands after signing in, and where it's sent when it opens a
// page meant for the other role.
export const homeFor = (role) => (role === "admin" ? "/admin" : "/dashboard");
