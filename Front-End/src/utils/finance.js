// Display helpers for money. Amounts arrive from the API as exact decimal
// strings; converting to Number here is for formatting only — every
// calculation that matters happens on the backend.

export const FIAT_CODES = ["ZAR", "USD"];

export const isFiat = (asset) => FIAT_CODES.includes(String(asset || "").toUpperCase());

export const formatFiat = (value, currency = "USD") => {
  const number = Number(value);
  if (value === null || value === undefined || Number.isNaN(number)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

export const formatCrypto = (value, asset) => {
  const number = Number(value);
  if (value === null || value === undefined || Number.isNaN(number)) return "—";
  return `${number.toLocaleString("en-US", { maximumFractionDigits: 8 })}${asset ? ` ${asset}` : ""}`;
};

export const formatAmount = (value, asset) => (isFiat(asset) ? formatFiat(value, asset) : formatCrypto(value, asset));

// Every deposit/withdrawal/transaction status the backend can return.
export const STATUS_META = {
  PENDING: { label: "Pending", tone: "amber" },
  DETECTED: { label: "Detected", tone: "amber" },
  CONFIRMING: { label: "Confirming", tone: "amber" },
  PENDING_CONFIRMATION: { label: "Awaiting email confirmation", tone: "amber" },
  PROCESSING: { label: "Processing", tone: "blue" },
  OPEN: { label: "Open", tone: "amber" },
  COMPLETED: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  UNDER_REVIEW: { label: "Under review", tone: "purple" },
  REJECTED: { label: "Rejected", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
  EXPIRED: { label: "Expired", tone: "gray" },
};

export const isFinalStatus = (status) => ["COMPLETED", "FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(status);
