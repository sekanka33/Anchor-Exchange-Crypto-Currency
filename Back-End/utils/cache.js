const store = new Map();

const get = (key) => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    return entry.value;
};

const getStale = (key) => {
    const entry = store.get(key);
    return entry ? entry.value : undefined;
};

const set = (key, value, ttlMs) => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

module.exports = { get, set, getStale };
