const Redis = require("ioredis");

// REDIS_URL wins (managed Redis usually hands you one); otherwise host/port.
const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379
    });

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("error", (err) => {
    console.error("Redis error:", err.message);
});

module.exports = redis;
