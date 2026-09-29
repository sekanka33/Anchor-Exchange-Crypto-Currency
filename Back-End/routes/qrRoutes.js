const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const pool = require("../config/database");
const redis = require("../config/redis");
const { getIO } = require("../socket");

// The Sign In page auto-generates a QR code on mount and regenerates it every
// 60s for as long as the tab stays open (so the code shown is never stale) —
// that alone is ~15 calls per open tab per 15-minute window, before counting
// every redirect back to /signin from a protected route. /init only mints an
// unauthenticated, side-effect-free session id, so it gets a generous cap;
// /verify actually approves a login and keeps the tighter one.
const qrInitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});

const qrLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    skip: () => process.env.NODE_ENV === "test",
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});


// ==========================================
// GENERATE QR CODE
// ==========================================

router.get("/init", qrInitLimiter, async (req, res) => {

    try {

        const crypto = require("crypto");

        const qr_token = crypto.randomUUID();


        // Store QR session in Redis
        await redis.set(
            `qr:${qr_token}`,
            JSON.stringify({
                status: "pending"
            }),
            "EX",
            60
        );


        // URL that the phone will open
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const qrUrl =
            `${frontendUrl}/qr-auth?token=${qr_token}`;


        res.json({

            qr_token,

            qrCode:
                `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`,

            expires_in: 60

        });


    } catch (error) {

        console.log("QR INIT ERROR:", error);

        res.status(500).json({

            message: "QR generation failed"

        });

    }

});


// ==========================================
// VERIFY QR CODE
// ==========================================

router.post("/verify", qrLimiter, async (req, res) => {

    try {

        const { qr_token } = req.body;


        // Check QR token
        if (!qr_token) {

            return res.status(400).json({

                message: "Missing QR token"

            });

        }


        // Check phone authentication
        const authHeader =
            req.headers.authorization;


        if (!authHeader) {

            return res.status(401).json({

                message: "Phone is not logged in"

            });

        }


        // Check that it is a Bearer token
        if (!authHeader.startsWith("Bearer ")) {

            return res.status(401).json({

                message: "Invalid authentication"

            });

        }


        const token =
            authHeader.split(" ")[1];


        if (!token) {

            return res.status(401).json({

                message: "Invalid token"

            });

        }


        // ==========================================
        // VERIFY THE PHONE'S TOKEN
        // ==========================================
        //
        // The raw token must never be trusted as-is (it was previously
        // assigned directly to `userId`, meaning any string sent as a
        // Bearer token would be accepted as an authenticated identity).
        // It's cryptographically verified here exactly like the
        // `authenticate` middleware does, and the numeric user id is taken
        // only from the verified payload.

        let decoded;

        try {

            decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

        } catch (jwtError) {

            return res.status(401).json({

                message: "Invalid or expired token"

            });

        }


        const userResult = await pool.query(
            "SELECT id, email, fullname, role, is_suspended FROM users WHERE id = $1",
            [decoded.id]
        );

        if (userResult.rows.length === 0) {

            return res.status(401).json({

                message: "Invalid or expired token"

            });

        }

        const user = userResult.rows[0];

        if (user.is_suspended) {

            return res.status(403).json({

                message: "This account has been suspended. Contact support for assistance."

            });

        }


        // ==========================================
        // CHECK QR SESSION
        // ==========================================

        const qrData =
            await redis.get(`qr:${qr_token}`);


        if (!qrData) {

            return res.status(400).json({

                message: "QR expired"

            });

        }


        const qrSession =
            JSON.parse(qrData);


        if (qrSession.status !== "pending") {

            return res.status(400).json({

                message: "QR code already used"

            });

        }


        // ==========================================
        // ISSUE A FRESH SESSION TOKEN FOR THE DESKTOP
        // ==========================================
        //
        // The desktop browser gets its own new JWT — it must never reuse
        // the phone's token (that would mean one device's token grants a
        // second, independent session with no way to tell them apart or
        // revoke one without the other).

        const desktopToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );


        // ==========================================
        // APPROVE QR LOGIN
        // ==========================================

        await redis.set(

            `qr:${qr_token}`,

            JSON.stringify({

                status: "approved",

                userId: user.id

            }),

            "EX",

            60

        );


        // ==========================================
        // TELL PC BROWSER LOGIN WAS APPROVED
        // ==========================================

        const io = getIO();


        io.to(qr_token).emit(

            "qr-login-success",

            {

                token: desktopToken,

                user: {

                    id: user.id,

                    email: user.email,

                    fullname: user.fullname,

                    role: user.role

                }

            }

        );


        console.log("QR login approved");


        res.json({

            message: "Login approved"

        });


    } catch (error) {

        console.log(
            "QR VERIFY ERROR:",
            error
        );


        res.status(500).json({

            message: "Server error"

        });

    }

});


module.exports = router;