// Replaces global fetch for CoinGecko/Binance so tests never touch the network.
// Every other URL goes to the real fetch. Shared by the API test harness and
// the E2E backend launcher.
// --- Upstream market-data stub -------------------------------------------
// The app proxies CoinGecko/Binance. Tests must be deterministic and offline,
// so those hosts are answered here; every other URL (our own test server)
// goes to the real fetch.
const PRICES = {
    bitcoin: 50000,
    ethereum: 2500,
    binancecoin: 500,
    solana: 100,
    ripple: 0.5,
    dogecoin: 0.1,
    cardano: 0.5,
    tether: 1
};

const upstream = { fail: false, calls: 0, prices: { ...PRICES } };

const realFetch = global.fetch;

const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

global.fetch = async (url, options) => {
    const target = String(url);

    if (target.includes("api.coingecko.com") || target.includes("api.binance.com")) {
        upstream.calls++;

        if (upstream.fail) {
            return jsonResponse({ error: "upstream down" }, 503);
        }

        const parsed = new URL(target);

        if (parsed.pathname.endsWith("/simple/price")) {
            const ids = (parsed.searchParams.get("ids") || "").split(",");
            const out = {};
            for (const id of ids) {
                if (upstream.prices[id] !== undefined) out[id] = { usd: upstream.prices[id] };
            }
            return jsonResponse(out);
        }

        if (parsed.pathname.endsWith("/coins/markets")) {
            return jsonResponse(
                Object.entries(upstream.prices).map(([id, price]) => ({
                    id, symbol: id.slice(0, 3), name: id, current_price: price, price_change_percentage_24h: 1.5
                }))
            );
        }

        if (parsed.pathname.endsWith("/global")) {
            return jsonResponse({ data: { active_cryptocurrencies: 1 } });
        }

        if (parsed.pathname.endsWith("/ticker/24hr")) {
            return jsonResponse({ symbol: parsed.searchParams.get("symbol"), lastPrice: "50000" });
        }

        return jsonResponse({ id: "stub" });
    }

    return realFetch(url, options);
};

module.exports = { upstream };
