// Flat "network fee" per asset (approximates real gas/miner fees) — charged
// in the withdrawn asset itself, unlike the percentage-based deposit fees.
const CRYPTO_WITHDRAWAL_FEES = {
    BTC: 0.0005,
    ETH: 0.005,
    BNB: 0.001,
    SOL: 0.01,
    XRP: 0.2,
    DOGE: 5,
    ADA: 1,
    USDT: 1
};

const MIN_CRYPTO_WITHDRAWAL_USD = 25;
const MAX_CRYPTO_WITHDRAWAL_USD = 10000;

const FIAT_WITHDRAWAL_FEE_RATE = 0.01;
const MIN_FIAT_WITHDRAWAL_USD = 20;
const MAX_FIAT_WITHDRAWAL_USD = 10000;

// A user must click the link in a confirmation email before a withdrawal is
// processed — the core anti-account-takeover control for this stage. If an
// attacker gets a session token but not email access, they can request a
// withdrawal but cannot complete one.
const WITHDRAWAL_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

// Loose but real per-network address format checks. Not full checksum
// validation (e.g. no bech32 checksum or base58Check verification) — enough
// to catch obviously-wrong input (wrong chain, malformed address) without
// pulling in a chain-specific validation library for a demo.
const ADDRESS_PATTERNS = {
    BTC: /^(bc1[a-z0-9]{25,39}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
    ERC20: /^0x[a-fA-F0-9]{40}$/,
    BEP20: /^0x[a-fA-F0-9]{40}$/,
    SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    XRP: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
    DOGE: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{24,33}$/,
    ADA: /^addr1[a-z0-9]{50,103}$/,
    TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/
};

const isValidAddress = (networkCode, address) => {
    const pattern = Object.hasOwn(ADDRESS_PATTERNS, networkCode) ? ADDRESS_PATTERNS[networkCode] : undefined;
    return Boolean(pattern && typeof address === "string" && pattern.test(address));
};

module.exports = {
    CRYPTO_WITHDRAWAL_FEES,
    MIN_CRYPTO_WITHDRAWAL_USD,
    MAX_CRYPTO_WITHDRAWAL_USD,
    FIAT_WITHDRAWAL_FEE_RATE,
    MIN_FIAT_WITHDRAWAL_USD,
    MAX_FIAT_WITHDRAWAL_USD,
    WITHDRAWAL_CONFIRMATION_TTL_MS,
    isValidAddress
};
