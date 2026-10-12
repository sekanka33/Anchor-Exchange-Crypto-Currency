const express = require("express");
const router = express.Router();

const { publicFiatConfig, DEPOSIT_METHODS } = require("../config/fiatCurrencies");
const { ASSET_NETWORKS, CONFIRMATIONS_REQUIRED, MIN_CRYPTO_DEPOSIT } = require("../config/cryptoNetworks");
const { CRYPTO_WITHDRAWAL_FEES, MIN_CRYPTO_WITHDRAWAL_USD, MAX_CRYPTO_WITHDRAWAL_USD } = require("../config/withdrawalConfig");
const { FEE_RATE } = require("../config/tradingConfig");
const { financeStatus } = require("../config/financeMode");

// Public, non-secret settings the frontend needs to show limits, fees and
// supported networks — the backend still enforces all of them itself.
router.get("/finance", (req, res) => {
    res.json({
        fiatCurrencies: publicFiatConfig(),
        depositMethods: DEPOSIT_METHODS,
        tradingFeeRate: String(FEE_RATE),
        crypto: Object.entries(ASSET_NETWORKS).map(([asset, networks]) => ({
            asset,
            networks: networks.map(({ code, label, requiresMemo }) => ({ code, label, requiresMemo })),
            minDeposit: String(MIN_CRYPTO_DEPOSIT[asset] ?? 0),
            requiredConfirmations: CONFIRMATIONS_REQUIRED[asset] || 1,
            withdrawalFee: String(CRYPTO_WITHDRAWAL_FEES[asset] ?? 0)
        })),
        cryptoWithdrawalLimitsUsd: { min: String(MIN_CRYPTO_WITHDRAWAL_USD), max: String(MAX_CRYPTO_WITHDRAWAL_USD) },
        ...financeStatus()
    });
});

module.exports = router;
