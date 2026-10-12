const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {

    const authHeader =
        req.headers["authorization"] ||
        req.headers["Authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Access denied. No token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        req.user = decoded;

        next();

    } catch (err) {

        // A bad or expired token means "not authenticated" (401), not
        // "authenticated but not allowed" (403) — clients use 401 to
        // end the session and send the user back to sign in.
        return res.status(401).json({
            message: "Invalid or expired token."
        });

    }
};

module.exports = authenticate;