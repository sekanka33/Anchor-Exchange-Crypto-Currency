require("dotenv").config();

const http = require("http");

const { validateEnv } = require("./config/validateEnv");

const { errors, warnings } = validateEnv();

warnings.forEach((w) => console.warn(`CONFIG WARNING: ${w}`));

if (errors.length > 0) {
    errors.forEach((e) => console.error(`CONFIG ERROR: ${e}`));
    console.error("Refusing to start with an invalid configuration.");
    process.exit(1);
}

const app = require("./app");
const pool = require("./config/database");
const redis = require("./config/redis");
const { initSocket } = require("./socket");
const { demoAllowed } = require("./config/demoMode");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`);

    if (demoAllowed()) {
        console.warn("DEMO MODE: payments, deposits and crypto addresses are simulated. No real money or crypto moves.");
    }
});

// --- Process safety ---------------------------------------------------------

let shuttingDown = false;

const shutdown = async (reason, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Shutting down (${reason})...`);

    // Don't hang forever on a stuck connection.
    const force = setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
    }, 10_000);
    force.unref();

    try {
        server.closeIdleConnections?.();
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
        redis.disconnect();
    } catch (error) {
        console.error("Error during shutdown:", error.message);
        exitCode = 1;
    }

    process.exit(exitCode);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// A promise rejected with no handler means some code path failed silently.
// Log loudly but keep serving; Express 5 already routes handler rejections
// to the error middleware, so reaching here means a background task failed.
process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION:", reason);
});

// State after an uncaught exception is undefined: exit and let the process
// manager restart us.
process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:", error);
    shutdown("uncaughtException", 1);
});
