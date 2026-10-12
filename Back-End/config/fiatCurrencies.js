// Fiat currencies the exchange holds, deposits, withdraws and trades in.
// Amounts are decimal strings (see utils/money.js); all limits are in the
// currency itself. These are business settings: review them before going
// live. ZAR is the home currency (South Africa); USD is kept for existing
// balances and customers.
const FIAT_CURRENCIES = {
    ZAR: {
        code: "ZAR",
        name: "South African Rand",
        symbol: "R",
        decimals: 2,
        coingecko: "zar",
        deposit: { min: "100", max: "200000", feeRates: { bank: "0", card: "0.015" } },
        withdrawal: { min: "200", max: "200000", feeRate: "0.01" },
        trade: { min: "100", max: "200000" },
        // SA banking: 6-digit universal branch code and an account type.
        bank: { requiresBranchCode: true, branchCodePattern: /^\d{6}$/, accountTypes: ["cheque", "savings", "transmission"] }
    },
    USD: {
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        decimals: 2,
        coingecko: "usd",
        deposit: { min: "10", max: "10000", feeRates: { bank: "0", card: "0.015" } },
        withdrawal: { min: "20", max: "10000", feeRate: "0.01" },
        trade: { min: "10", max: "10000" },
        bank: { requiresBranchCode: false, branchCodePattern: /^[A-Za-z0-9]{4,11}$/, accountTypes: ["checking", "savings"] }
    }
};

const DEPOSIT_METHODS = ["bank", "card"];

// Callers that predate multi-currency (and send no currency) mean USD.
const DEFAULT_CURRENCY = "USD";

const getFiatCurrency = (code) => {
    const key = typeof code === "string" ? code.trim().toUpperCase() : DEFAULT_CURRENCY;
    return Object.hasOwn(FIAT_CURRENCIES, key) ? FIAT_CURRENCIES[key] : null;
};

const isFiat = (asset) => Object.hasOwn(FIAT_CURRENCIES, String(asset).toUpperCase());

// Public view for the frontend (no regexes).
const publicFiatConfig = () =>
    Object.values(FIAT_CURRENCIES).map(({ bank, ...rest }) => ({
        ...rest,
        bank: { requiresBranchCode: bank.requiresBranchCode, accountTypes: bank.accountTypes }
    }));

module.exports = { FIAT_CURRENCIES, DEPOSIT_METHODS, DEFAULT_CURRENCY, getFiatCurrency, isFiat, publicFiatConfig };
