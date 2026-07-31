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

            // Check whether this phone has already logged in
            const token = localStorage.getItem("token");

            if (!token) {

                // Not logged in on this phone
                navigate(`/signin?qr=${qr_token}`);
                return;

            }

            try {

                const response = await fetch(
                    "http://10.21.152.182:5000/api/qr/verify",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            qr_token
                        })
                    }
                );

                const data = await response.json();

                if (response.ok) {

                    setMessage("✅ Login approved.");

                } else {

                    setMessage(data.message);

                }

            } catch (err) {

                setMessage("Unable to connect to server.");

            }

        };

        verifyQR();

    }, []);

    return (

        <div className="flex flex-col items-center justify-center h-screen">

            <h1 className="text-3xl font-bold">
                Anchor Exchange
            </h1>

            <p className="mt-6 text-lg">
                {message}
            </p>

        </div>

    );

};

export default QRAuth;