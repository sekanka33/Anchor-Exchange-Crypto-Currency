const express = require("express");
const router = express.Router();

const redis = require("../config/redis");
const { getIO } = require("../socket");


// ==========================================
// GENERATE QR CODE
// ==========================================

router.get("/init", async (req, res) => {

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
        const qrUrl =
            `http://192.168.0.117:5173/qr-auth?token=${qr_token}`;


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

router.post("/verify", async (req, res) => {

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
        // TEMPORARY USER IDENTIFICATION
        // ==========================================
        //
        // We will replace this with your real JWT
        // verification middleware.
        //
        // DO NOT trust a userId sent from the phone.
        //

        const userId = token;


        // ==========================================
        // APPROVE QR LOGIN
        // ==========================================

        await redis.set(

            `qr:${qr_token}`,

            JSON.stringify({

                status: "approved",

                userId

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

                userId

            }

        );


        console.log(
            "QR login approved:",
            qr_token
        );


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