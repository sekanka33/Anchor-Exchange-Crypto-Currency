import { useState, useEffect, useCallback, useMemo } from "react";
import { CURRENCIES, CurrencyContext, buildFormatMoney } from "../context/CurrencyContext";
import { getFiatRates } from "../api/coingecko";
import { API_BASE_URL } from "../api/config";

// Used until live rates load, or if the rates request fails.
const FALLBACK_RATES = { USD: 1, ZAR: 16.7, EUR: 0.89, GBP: 0.76 };
const RATES_REFRESH_MS = 10 * 60 * 1000;

const readSavedCurrency = () => {
  try {
    const saved = localStorage.getItem("currency");
    return CURRENCIES.includes(saved) ? saved : "USD";
  } catch {
    return "USD";
  }
};

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState(readSavedCurrency);
  const [rates, setRates] = useState(FALLBACK_RATES);

  useEffect(() => {
    let cancelled = false;

    const loadRates = async () => {
      try {
        const live = await getFiatRates(CURRENCIES);
        if (!cancelled) setRates((prev) => ({ ...prev, ...live }));
      } catch {
        // Keep the last known (or fallback) rates.
      }
    };

    loadRates();
    const timer = setInterval(loadRates, RATES_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const setCurrency = useCallback((next, { sync = true } = {}) => {
    if (!CURRENCIES.includes(next)) return;
    setCurrencyState(next);

    try {
      localStorage.setItem("currency", next);
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }

    // Keep the signed-in user's saved preference in step with the navbar.
    const token = localStorage.getItem("token");
    if (sync && token) {
      fetch(`${API_BASE_URL}/api/users/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currency: next }),
      }).catch(() => {});
    }
  }, []);

  const value = useMemo(() => {
    const rate = rates[currency] ?? 1;
    return {
      currency,
      setCurrency,
      rate,
      convert: (usd) => Number(usd) * rate,
      formatMoney: buildFormatMoney(currency, rate),
    };
  }, [currency, rates, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
