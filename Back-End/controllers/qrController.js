const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const redis = require("../config/redis");

const initQR = async (req, res) => {

    try {

        const qr_token = uuidv4();

        const qr_url =
            `http://localhost:5173/qr-auth?token=${qr_token}`;


        await redis.set(

            `qr:${qr_token}`,

            JSON.stringify({

                status: "PENDING",

                createdAt: Date.now()

            }),

            "EX",
            60

        );


        const qrCode =
            await QRCode.toDataURL(qr_url);


        res.json({

            qr_token,

            qrCode,

            expires_in: 60

        });


    } catch (error) {

        console.error("QR ERROR:", error);


        res.status(500).json({

            message: "Unable to generate QR code."

        });

    }

};


module.exports = {
    initQR
};