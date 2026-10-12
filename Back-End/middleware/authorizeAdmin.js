// Admin-only routes: see authorizeRole.js. Kept as its own module so
// adminRoutes reads `authenticate, authorizeAdmin`.
const { authorizeRole } = require("./authorizeRole");

module.exports = authorizeRole("admin");
