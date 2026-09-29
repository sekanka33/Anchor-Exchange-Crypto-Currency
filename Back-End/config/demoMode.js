// The exchange has no real payment provider, custody wallet, or blockchain
// node: card/bank charges, fiat deposits and crypto deposits are all
// simulated, which means they credit wallets with money that doesn't exist.
// That is fine for development and demos and must never happen silently in
// production, so it requires an explicit opt-in.
const isProduction = () => process.env.NODE_ENV === "production";

const demoAllowed = () => !isProduction() || process.env.ALLOW_DEMO_MODE === "true";

module.exports = { isProduction, demoAllowed };
