const pool = require("../config/database");

// Runs after `authenticate` (which only proves *who* the request is from via
// a valid JWT). This proves *what* they're allowed to do — the role is
// looked up fresh from the DB on every request rather than trusted from the
// JWT payload, so revoking admin access takes effect immediately instead of
// waiting for the token to expire.
const authorizeAdmin = async (req, res, next) => {

    try {

        const result = await pool.query(
            "SELECT role FROM users WHERE id = $1",
            [req.user.id]
        );

        if (result.rows.length === 0 || result.rows[0].role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        req.user.role = result.rows[0].role;

        next();

    } catch (error) {

        console.error("AUTHORIZE ADMIN ERROR:", error);

        res.status(500).json({ message: "Unable to verify admin access" });

    }

};

module.exports = authorizeAdmin;
