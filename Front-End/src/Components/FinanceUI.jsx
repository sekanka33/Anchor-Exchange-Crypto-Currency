import { useState } from "react";
import { STATUS_META } from "../utils/finance";

const TONES = {
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  green: "bg-green-500/10 text-green-700 dark:text-green-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  purple: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  gray: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status || "—", tone: "gray" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${TONES[meta.tone]}`}>
      {meta.label}
    </span>
  );
};

// Copies `value` and says so (also to screen readers).
export const CopyButton = ({ value, label = "Copy" }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
};

// Shown wherever money movement is simulated, so demo activity is never
// mistaken for a real payment, address or balance.
export const DemoNotice = ({ children }) => (
  <div role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
    <span className="font-semibold">Demo mode. </span>
    {children}
  </div>
);
