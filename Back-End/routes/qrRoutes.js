const express = require("express");
const router = express.Router();

const redis = require("../config/redis");
const { getIO } = require("../socket");


// Generate QR token
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


        res.json({

            qr_token,

            qrCode:
            `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qr_token}`,

            expires_in: 60

        });


    } catch (error) {

        console.log("QR INIT ERROR:", error);


        res.status(500).json({

            message: "QR generation failed"

        });

    }

});


// Verify QR login from phone
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



        // Check if QR exists
        const exists = await redis.get(
            `qr:${qr_token}`
        );



        if (!exists) {

            return res.status(400).json({

                message: "QR expired"

            });

        }



        // Approve login
        await redis.set(
            `qr:${qr_token}`,
            JSON.stringify({

                status: "approved",
                userId

            }),
            "EX",
            60
        );

        const io = getIO();


        io.to(qr_token)
        .emit(
            "qr-login-success",
            {
                userId
            }
        );


        res.json({

            message: "Login approved"

        });



    } catch (error) {


        console.log("QR VERIFY ERROR:", error);



        res.status(500).json({

            message: "Server error"

        });

    }

});





module.exports = router;