// Starts the real server (server.js) against the throwaway test DB with the
// market-data upstream stubbed. Used by the Playwright E2E config.
require("./env");
process.env.PORT = process.env.E2E_BACKEND_PORT || "5100";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";
require("./upstreamStub");
require("../../server");
