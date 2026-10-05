import { useState, useEffect, useRef, useCallback } from "react";

// Loads `loader()` on mount / when deps change, optionally polling.
// Keeps the previous data while refreshing so panels don't flash.
export const useApi = (loader, deps, { pollMs, enabled = true } = {}) => {
  const [state, setState] = useState({ data: null, loading: enabled, error: "" });
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const load = useCallback(async () => {
    try {
      const data = await loaderRef.current();
      setState({ data, loading: false, error: "" });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err.message || "Request failed" }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, loading: prev.data === null }));
    load();
    if (!pollMs) return;
    const timer = setInterval(load, pollMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, pollMs, load]);

  return { ...state, reload: load };
};
