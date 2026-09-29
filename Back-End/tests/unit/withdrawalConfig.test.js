require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { isValidAddress, CRYPTO_WITHDRAWAL_FEES } = require("../../config/withdrawalConfig");
const { SUPPORTED_ASSETS } = require("../../config/tradingConfig");
const { ASSET_NETWORKS, getNetworkConfig, getNetworksForAsset, MIN_CRYPTO_DEPOSIT, CONFIRMATIONS_REQUIRED } = require("../../config/cryptoNetworks");

describe("isValidAddress", () => {
    const valid = {
        BTC: ["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"],
        ERC20: ["0x52908400098527886E0F7030069857D2E4169EE7"],
        BEP20: ["0x52908400098527886E0F7030069857D2E4169EE7"],
        TRC20: ["TJRabPrwbZy45sbavfcjinPJC18kjpRTv8"],
        SOL: ["4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T"],
        XRP: ["rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY"],
        DOGE: ["D7Y55r1bXkhjZ3vYZfQm2f9uPjyzrBW4Ng"]
    };

    for (const [network, addresses] of Object.entries(valid)) {
        for (const address of addresses) {
            test(`accepts a well-formed ${network} address (${address.slice(0, 10)}…)`, () => {
                assert.equal(isValidAddress(network, address), true);
            });
        }
    }

    test("rejects an address from the wrong chain", () => {
        assert.equal(isValidAddress("BTC", "0x52908400098527886E0F7030069857D2E4169EE7"), false);
        assert.equal(isValidAddress("ERC20", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"), false);
        assert.equal(isValidAddress("TRC20", "0x52908400098527886E0F7030069857D2E4169EE7"), false);
    });

    for (const bad of [undefined, null, "", " ", 12345, {}, [], "0x123", "0x" + "g".repeat(40), "0x" + "a".repeat(41), "'; DROP TABLE users;--", "<script>alert(1)</script>", "bc1q" + "a".repeat(200)]) {
        test(`rejects junk input ${JSON.stringify(bad)?.slice(0, 30)}`, () => {
            for (const network of ["BTC", "ERC20", "TRC20", "SOL"]) {
                assert.equal(isValidAddress(network, bad), false);
            }
        });
    }

    test("rejects unknown networks and does not treat prototype keys as networks", () => {
        assert.equal(isValidAddress("NOPE", "0x52908400098527886E0F7030069857D2E4169EE7"), false);
        assert.equal(isValidAddress("__proto__", "x"), false);
        assert.equal(isValidAddress("constructor", "x"), false);
    });

    test("is not vulnerable to newline injection appended after a valid address", () => {
        assert.equal(isValidAddress("ERC20", "0x52908400098527886E0F7030069857D2E4169EE7\n<b>"), false);
    });
});

describe("asset configuration is internally consistent", () => {
    test("every supported asset has networks, a withdrawal fee, a min deposit and confirmations", () => {
        for (const asset of SUPPORTED_ASSETS) {
            assert.ok(getNetworksForAsset(asset).length > 0, `${asset} networks`);
            assert.ok(CRYPTO_WITHDRAWAL_FEES[asset] > 0, `${asset} fee`);
            assert.ok(MIN_CRYPTO_DEPOSIT[asset] > 0, `${asset} min deposit`);
            assert.ok(CONFIRMATIONS_REQUIRED[asset] >= 1, `${asset} confirmations`);
        }
    });

    test("every network code has an address validator (otherwise withdrawals to it would be impossible)", () => {
        const codes = new Set(Object.values(ASSET_NETWORKS).flat().map((n) => n.code));
        for (const code of codes) {
            const sample = { BTC: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", ERC20: "0x52908400098527886E0F7030069857D2E4169EE7", BEP20: "0x52908400098527886E0F7030069857D2E4169EE7", TRC20: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8", SOL: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T", XRP: "rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY", DOGE: "D7Y55r1bXkhjZ3vYZfQm2f9uPjyzrBW4Ng", ADA: "addr1" + "q".repeat(60) }[code];
            assert.ok(sample, `test has no sample for network ${code}`);
            assert.equal(isValidAddress(code, sample), true, code);
        }
    });

    test("getNetworkConfig returns undefined for mismatched asset/network", () => {
        assert.equal(getNetworkConfig("BTC", "ERC20"), undefined);
        assert.equal(getNetworkConfig("SHIB", "BTC"), undefined);
        assert.ok(getNetworkConfig("USDT", "TRC20"));
    });

    test("USDT is offered on multiple networks", () => {
        assert.ok(getNetworksForAsset("USDT").length >= 3);
    });
});
