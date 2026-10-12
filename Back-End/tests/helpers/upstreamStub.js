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

// Fixed test exchange rates: a price in another currency is the USD price × this.
const FX = { usd: 1, zar: 18, eur: 0.9, gbp: 0.8 };

const upstream = { fail: false, calls: 0, prices: { ...PRICES }, fx: { ...FX } };

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
            const currencies = (parsed.searchParams.get("vs_currencies") || "usd").split(",");
            const out = {};
            for (const id of ids) {
                if (upstream.prices[id] === undefined) continue;
                out[id] = {};
                for (const vs of currencies) {
                    if (upstream.fx[vs] !== undefined) out[id][vs] = upstream.prices[id] * upstream.fx[vs];
                }
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

        if (parsed.pathname.endsWith("/depth")) {
            return jsonResponse({ lastUpdateId: 1, bids: [["49999", "1"]], asks: [["50001", "2"]] });
        }

        if (parsed.pathname.endsWith("/trades")) {
            return jsonResponse([{ id: 1, price: "50000", qty: "0.1", time: Date.now(), isBuyerMaker: false }]);
        }

        if (parsed.pathname.endsWith("/ticker/24hr")) {
            return jsonResponse({ symbol: parsed.searchParams.get("symbol"), lastPrice: "50000" });
        }

        return jsonResponse({ id: "stub" });
    }

    return realFetch(url, options);
};

module.exports = { upstream };
