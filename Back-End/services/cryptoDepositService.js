const crypto = require("crypto");
const { getNetworkConfig } = require("../config/cryptoNetworks");
const { readSecret } = require("../config/secrets");

// Demo mode only: addresses are deterministically derived from a local
// secret rather than issued by a real wallet/custody provider, so the same
// user+asset+network always gets the same address back. These are NOT real
// chain addresses and nothing is watching them — see simulateIncomingDeposit.
//
// Addresses are stored in deposit_addresses when first issued and re-read
// from there, so changing CRYPTO_ADDRESS_SECRET only changes addresses issued
// afterwards; existing demo records keep their address.

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const deterministicBytes = (seed, byteLength) => {
    let buf = Buffer.alloc(0);
    let counter = 0;

    while (buf.length < byteLength) {
        const chunk = crypto.createHmac("sha256", readSecret("CRYPTO_ADDRESS_SECRET")).update(`${seed}:${counter}`).digest();
        buf = Buffer.concat([buf, chunk]);
        counter += 1;
    }

    return buf.subarray(0, byteLength);
};

const toBase58ish = (bytes) => {
    let out = "";
    for (const b of bytes) out += BASE58_ALPHABET[b % BASE58_ALPHABET.length];
    return out;
};

const generateDepositAddress = (userId, asset, network) => {

    const config = getNetworkConfig(asset, network);

    if (!config) return null;

    const seed = `${userId}:${asset}:${network}`;
    const bodyLength = config.addressLength - config.addressPrefix.length;
    const bytes = deterministicBytes(seed, bodyLength);

    const body = config.addressPrefix.startsWith("0x")
        ? bytes.toString("hex").slice(0, bodyLength)
        : toBase58ish(bytes).slice(0, bodyLength);

    const address = `${config.addressPrefix}${body}`;

    let memo = null;

    if (config.requiresMemo) {
        const memoBytes = deterministicBytes(`${seed}:memo`, 4);
        memo = String(memoBytes.readUInt32BE(0) % 1000000000);
    }

    return { address, memo, network: config.code, networkLabel: config.label };

};

module.exports = { generateDepositAddress };
