import { createContext } from "react";

// Display currencies offered in the navbar / Profile & Settings. All amounts in
// the app (market prices, balances, order totals) are stored in USD and are
// converted to the selected currency for display only.
export const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"];

export const buildFormatMoney = (currency, rate) => (usdValue, options = {}) => {
  const value = Number(usdValue);
  if (usdValue === null || usdValue === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value * rate);
};

// Default value keeps components usable outside the provider (e.g. in tests).
export const CurrencyContext = createContext({
  currency: "USD",
  setCurrency: () => {},
  rate: 1,
  convert: (usd) => Number(usd),
  formatMoney: buildFormatMoney("USD", 1),
});

