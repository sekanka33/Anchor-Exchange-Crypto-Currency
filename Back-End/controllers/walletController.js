const pool = require("../config/database");
const { getUsdPrice } = require("../utils/assetPrices");

const getWallet = async (req, res) => {
    try {

        const userId = req.user.id;

        const walletResult = await pool.query(
            "SELECT id, created_at, updated_at FROM wallets WHERE user_id = $1",
            [userId]
        );

        if (walletResult.rows.length === 0) {
            return res.status(404).json({
                message: "Wallet not found"
            });
        }

        const wallet = walletResult.rows[0];

        const balancesResult = await pool.query(
            `
            SELECT asset_symbol, available_balance, locked_balance
            FROM wallet_balances
            WHERE wallet_id = $1
            ORDER BY asset_symbol
            `,
            [wallet.id]
        );

        let portfolioValue = 0;

        const balances = await Promise.all(
            balancesResult.rows.map(async (row) => {

                const available = Number(row.available_balance);
                const locked = Number(row.locked_balance);
                const total = available + locked;

                const usdPrice = await getUsdPrice(row.asset_symbol);
                const usdValue = total * usdPrice;

                portfolioValue += usdValue;

                return {
                    assetSymbol: row.asset_symbol,
                    availableBalance: available,
                    lockedBalance: locked,
                    totalBalance: total,
                    usdPrice,
                    usdValue
                };

            })
        );

        res.json({
            wallet: {
                id: wallet.id,
                createdAt: wallet.created_at
            },
            balances,
            portfolioValue
        });

    } catch (error) {

        console.error("GET WALLET ERROR:", error);

        res.status(500).json({
            message: "Unable to load wallet"
        });

    }
};

const getWalletTransactions = async (req, res) => {
    try {

        const userId = req.user.id;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const result = await pool.query(
            `
            SELECT id, type, asset, amount, fee, total, status, reference, tx_hash, created_at
            FROM transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            `,
            [userId, limit]
        );

        res.json({ transactions: result.rows });

    } catch (error) {

        console.error("GET WALLET TRANSACTIONS ERROR:", error);

        res.status(500).json({
            message: "Unable to load wallet transactions"
        });

    }
};

module.exports = {
    getWallet,
    getWalletTransactions
};
