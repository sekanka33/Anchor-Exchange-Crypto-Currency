const PAYMENT_METHODS = ["card", "bank"];

const DEPOSIT_FEE_RATES = {
    card: 0.015,
    bank: 0
};

module.exports = {
    PAYMENT_METHODS,
    DEPOSIT_FEE_RATES,
    MIN_DEPOSIT_USD: 10,
    MAX_DEPOSIT_USD: 10000
};
