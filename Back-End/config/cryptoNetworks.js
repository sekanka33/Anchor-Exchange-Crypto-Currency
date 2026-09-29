// Demo/testnet configuration for crypto deposits. There is no real
// blockchain-watching infrastructure wired up — in production this would be
// replaced by a node/indexer webhook (e.g. BlockCypher, Alchemy) that detects
// on-chain transactions to each generated address and calls into
// cryptoDepositService the same way that webhook would. Confirmation counts
// are scaled down from real-world values purely so the demo simulation
// finishes in a reasonable time.
const ASSET_NETWORKS = {
    BTC: [{ code: "BTC", label: "Bitcoin", addressPrefix: "bc1q", addressLength: 39, requiresMemo: false }],
    ETH: [{ code: "ERC20", label: "Ethereum (ERC20)", addressPrefix: "0x", addressLength: 42, requiresMemo: false }],
    BNB: [{ code: "BEP20", label: "BNB Smart Chain (BEP20)", addressPrefix: "0x", addressLength: 42, requiresMemo: false }],
    SOL: [{ code: "SOL", label: "Solana", addressPrefix: "", addressLength: 44, requiresMemo: false }],
    XRP: [{ code: "XRP", label: "XRP Ledger", addressPrefix: "r", addressLength: 34, requiresMemo: true }],
    DOGE: [{ code: "DOGE", label: "Dogecoin", addressPrefix: "D", addressLength: 34, requiresMemo: false }],
    ADA: [{ code: "ADA", label: "Cardano", addressPrefix: "addr1", addressLength: 58, requiresMemo: false }],
    USDT: [
        { code: "ERC20", label: "Ethereum (ERC20)", addressPrefix: "0x", addressLength: 42, requiresMemo: false },
        { code: "BEP20", label: "BNB Smart Chain (BEP20)", addressPrefix: "0x", addressLength: 42, requiresMemo: false },
        { code: "TRC20", label: "Tron (TRC20)", addressPrefix: "T", addressLength: 34, requiresMemo: false }
    ]
};

const CONFIRMATIONS_REQUIRED = {
    BTC: 2,
    ETH: 3,
    BNB: 3,
    SOL: 1,
    XRP: 1,
    DOGE: 2,
    ADA: 2,
    USDT: 3
};

const MIN_CRYPTO_DEPOSIT = {
    BTC: 0.0001,
    ETH: 0.001,
    BNB: 0.001,
    SOL: 0.01,
    XRP: 1,
    DOGE: 10,
    ADA: 1,
    USDT: 1
};

const getNetworksForAsset = (asset) => ASSET_NETWORKS[asset] || [];

const getNetworkConfig = (asset, networkCode) =>
    getNetworksForAsset(asset).find((n) => n.code === networkCode);

module.exports = {
    ASSET_NETWORKS,
    CONFIRMATIONS_REQUIRED,
    MIN_CRYPTO_DEPOSIT,
    getNetworksForAsset,
    getNetworkConfig
};
