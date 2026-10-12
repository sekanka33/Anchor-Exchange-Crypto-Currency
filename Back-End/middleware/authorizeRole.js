const pool = require("../config/database");
const authenticate = require("./authenticate");

// Runs after `authenticate` (which only proves *who* the request is from via
// a valid JWT). This proves *what* they're allowed to do — role and
// suspension are looked up fresh from the DB on every request rather than
// trusted from the JWT payload, so promoting, demoting, or suspending an
// account takes effect on its very next request instead of when the token
// expires.
const authorizeRole = (...allowedRoles) => async (req, res, next) => {

    try {

        const result = await pool.query(
            "SELECT role, is_suspended FROM users WHERE id = $1",
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Session is no longer valid. Please sign in again." });
        }

        const { role, is_suspended } = result.rows[0];

        if (is_suspended) {
            return res.status(403).json({ message: "This account has been suspended. Contact support for assistance." });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                message: role === "admin"
                    ? "Administrator accounts can't use customer features"
                    : "Admin access required"
            });
        }

        req.user.role = role;

        next();

    } catch (error) {

        console.error("AUTHORIZE ROLE ERROR:", error);

        res.status(500).json({ message: "Unable to verify access" });

    }

};

// Ready-made chains for routers: a valid token AND a current, unsuspended
// account with the right role.
const requireCustomer = [authenticate, authorizeRole("user")];
const requireAccount = [authenticate, authorizeRole("user", "admin")];

module.exports = { authorizeRole, requireCustomer, requireAccount };
