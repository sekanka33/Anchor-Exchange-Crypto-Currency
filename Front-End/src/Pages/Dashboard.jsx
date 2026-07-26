import React, { useEffect, useState } from "react";


const Dashboard = () => {

    const [wallet, setWallet] = useState(null);
    const [error, setError] = useState("");


    useEffect(() => {


        const fetchWallet = async () => {

            const token = localStorage.getItem("token");


            if(!token){
                setError("No token found");
                return;
            }


            try {

                const response = await fetch(
                    "http://localhost:5000/api/wallet",
                    {
                        method:"GET",
                        headers:{
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );


                const data = await response.json();


                if(!response.ok){
                    setError(data.message);
                    return;
                }


                setWallet(data);


            } catch(error){

                setError("Server error");

            }

        };


        fetchWallet();


    }, []);



    return (

        <div>

            <h1>
                Anchor Exchange Dashboard
            </h1>


            {
                error && (
                    <p>
                        {error}
                    </p>
                )
            }



            {
                wallet && (

                    <div>

                        <h2>
                            My Wallet
                        </h2>


                        <p>
                            BTC Balance: {wallet.btc_balance}
                        </p>


                        <p>
                            ETH Balance: {wallet.eth_balance}
                        </p>

                        <p>USDT Balance: {wallet.usdt_balance}</p>
                    </div>

                )
            }


        </div>

    );

};


export default Dashboard;