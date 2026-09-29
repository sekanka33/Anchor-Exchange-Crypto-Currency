require("../helpers/env");
const { test, describe, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const cache = require("../../utils/cache");

describe("TTL cache", () => {
    test("get returns a fresh value, undefined for unknown keys", () => {
        cache.set("k1", { a: 1 }, 1000);
        assert.deepEqual(cache.get("k1"), { a: 1 });
        assert.equal(cache.get("never-set"), undefined);
    });

    test("get hides an expired value but getStale still returns it", () => {
        const realNow = Date.now;
        try {
            const t0 = realNow();
            Date.now = () => t0;
            cache.set("k2", "v", 1000);
            Date.now = () => t0 + 1001;
            assert.equal(cache.get("k2"), undefined);
            assert.equal(cache.getStale("k2"), "v");
        } finally {
            Date.now = realNow;
        }
    });

    test("a falsy cached value (0, false, empty string) is still a hit", () => {
        cache.set("zero", 0, 1000);
        cache.set("empty", "", 1000);
        assert.equal(cache.get("zero"), 0);
        assert.equal(cache.get("empty"), "");
    });
});

describe("marketDataService stale-on-failure", () => {
    let realFetch;
    let realNow;
    let t;

    beforeEach(() => {
        realFetch = global.fetch;
        realNow = Date.now;
        t = realNow();
        Date.now = () => t;
    });

    afterEach(() => {
        global.fetch = realFetch;
        Date.now = realNow;
    });

    test("serves the last good value when the upstream fails after the TTL expires; throws if there was never a good value", async () => {
        const svc = require("../../services/marketDataService");
        let fail = false;
        let calls = 0;
        global.fetch = async () => {
            calls++;
            return fail ? new Response("nope", { status: 500 }) : new Response(JSON.stringify({ bitcoin: { usd: 111 } }), { status: 200 });
        };

        const first = await svc.getSimplePrice("bitcoin", "usd");
        assert.equal(first.bitcoin.usd, 111);

        await svc.getSimplePrice("bitcoin", "usd");
        assert.equal(calls, 1, "second call inside the TTL is served from cache");

        t += 60_000;
        fail = true;
        const stale = await svc.getSimplePrice("bitcoin", "usd");
        assert.equal(stale.bitcoin.usd, 111, "stale value beats an error");

        await assert.rejects(svc.getSimplePrice("some-unseen-coin", "usd"), /CoinGecko request failed/);
    });
});
