import { CURRENCIES } from "../context/CurrencyContext";
import { useCurrency } from "../hooks/useCurrency";

const LABELS = { ZAR: "ZAR (R)", USD: "USD ($)", EUR: "EUR (€)", GBP: "GBP (£)" };

const CurrencySelect = ({ className = "" }) => {
  const { currency, setCurrency } = useCurrency();

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value)}
      aria-label="Display currency"
      className={`bg-transparent text-slate-900 dark:text-white font-medium cursor-pointer hover:text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${className}`}
    >
      {CURRENCIES.map((code) => (
        <option key={code} value={code} className="bg-white dark:bg-[#0d0e12] text-slate-900 dark:text-white">
          {LABELS[code]}
        </option>
      ))}
    </select>
  );
};

export default CurrencySelect;
