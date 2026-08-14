const express = require("express");
const router = express.Router();

const redis = require("../config/redis");
const { getIO } = require("../socket");


// Generate QR token
router.get("/init", async (req, res) => {
    try {

        const crypto = require("crypto");

        const qr_token = crypto.randomUUID();

        await redis.set(
            `qr:${qr_token}`,
            JSON.stringify({
                status: "pending"
            }),
            "EX",
            60
        );

        // IMPORTANT:
        // This must be your PC's IPv4 address
        const qrUrl =
            `http://10.21.152.182:5173/qr-auth?token=${qr_token}`;

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


// Verify QR login
router.post("/verify", async (req, res) => {

    try {

        const {
            qr_token,
            userId
        } = req.body;

        if (!qr_token || !userId) {
            return res.status(400).json({
                message: "Missing data"
            });
        }

        const exists = await redis.get(
            `qr:${qr_token}`
        );

        if (!exists) {
            return res.status(400).json({
                message: "QR expired"
            });
        }

        // Approve QR login
        await redis.set(
            `qr:${qr_token}`,
            JSON.stringify({
                status: "approved",
                userId
            }),
            "EX",
            60
        );

        // Tell PC browser
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