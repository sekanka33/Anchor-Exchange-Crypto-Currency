require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");


const app = express();

// Behind a reverse proxy/load balancer every request otherwise looks like it
// comes from the proxy's IP, which makes the per-IP rate limiters useless.
// Set TRUST_PROXY to the number of proxy hops (e.g. 1), never blindly "true".
if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set("trust proxy", Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";



// Middleware

// This backend only ever serves JSON, never HTML, so helmet's default CSP
// (built for HTML-serving apps) is disabled rather than fighting it with a
// policy tuned for pages this server doesn't render.
app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors({

    origin: FRONTEND_URL,
    credentials:true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]

}));


app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Express 5 leaves req.body undefined when a request has no JSON body, which
// made every `const { x } = req.body` in the controllers throw a 500 instead
// of falling through to their 400 validation.
app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});




// One line per request: method, path (never the query string — it carries
// email-verification / reset / withdrawal tokens), status, duration.
if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
        const started = process.hrtime.bigint();
        res.on("finish", () => {
            const ms = Number(process.hrtime.bigint() - started) / 1e6;
            // originalUrl, not req.path: by "finish" req.path is relative to the mounted router.
            console.log(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${ms.toFixed(1)}ms`);
        });
        next();
    });
}

// Liveness/readiness for load balancers and uptime checks.
app.get("/api/health", async (req, res) => {
    const checks = { database: "ok", redis: "ok" };

    const within = (promise, ms = 2000) =>
        Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms).unref())]);

    try {
        await within(require("./config/database").query("SELECT 1"));
    } catch {
        checks.database = "down";
    }

    try {
        await within(require("./config/redis").ping());
    } catch {
        checks.redis = "down";
    }

    const healthy = Object.values(checks).every((v) => v === "ok");
    res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", checks });
});


// Routes

const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const userRoutes = require("./routes/userRoutes");
const qrRoutes = require("./routes/qrRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const marketRoutes = require("./routes/marketRoutes");
const orderRoutes = require("./routes/orderRoutes");
const depositRoutes = require("./routes/depositRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");



app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/wallet",
    walletRoutes
);


app.use(
    "/api/users",
    userRoutes
);


app.use(
    "/api/qr",
    qrRoutes
);


app.use(
    "/api/notifications",
    notificationRoutes
);


app.use(
    "/api/markets",
    marketRoutes
);


app.use(
    "/api/orders",
    orderRoutes
);


app.use(
    "/api/deposits",
    depositRoutes
);


app.use(
    "/api/webhooks",
    webhookRoutes
);


app.use(
    "/api/withdrawals",
    withdrawalRoutes
);


app.use(
    "/api/transactions",
    transactionRoutes
);


app.use(
    "/api/admin",
    adminRoutes
);


const { notFound, errorHandler } = require("./middleware/errorHandler");

app.use(notFound);
app.use(errorHandler);


module.exports = app;
