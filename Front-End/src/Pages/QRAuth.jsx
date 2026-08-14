import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const QRAuth = () => {

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [message, setMessage] = useState("Checking login...");

    useEffect(() => {

        const verifyQR = async () => {

            const qr_token = searchParams.get("token");

            if (!qr_token) {
                setMessage("Invalid QR Code.");
                return;
            }

            // Check if this phone is already logged in
            const token = localStorage.getItem("token");

            if (!token) {

                // Phone is not logged in
                // Send the user to login and keep the QR token
                navigate(`/signin?qr=${qr_token}`);

                return;
            }

            try {

                const response = await fetch(
                    "http://192.168.0.117:5000/api/qr/verify",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },

                        body: JSON.stringify({
                            qr_token
                        })
                    }
                );

                const data = await response.json();

                if (response.ok) {

                    setMessage(
                        "✅ Login approved. You can return to your computer."
                    );

                } else {

                    setMessage(
                        data.message || "QR login failed."
                    );

                }

            } catch (error) {

                console.error("QR VERIFY ERROR:", error);

                setMessage(
                    "Unable to connect to Anchor Exchange server."
                );

            }

        };

        verifyQR();

    }, [navigate, searchParams]);


    return (

        <div className="flex flex-col items-center justify-center h-screen">

            <h1 className="text-3xl font-bold">
                Anchor Exchange
            </h1>

            <p className="mt-6 text-lg text-center">
                {message}
            </p>

        </div>

    );

};

export default QRAuth;