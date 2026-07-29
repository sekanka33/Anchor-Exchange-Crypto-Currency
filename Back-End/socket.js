let io;


const initSocket = (server) => {

    const { Server } = require("socket.io");


    io = new Server(server, {

        cors: {
            origin: "http://localhost:5173",
            methods:["GET","POST"]
        }

    });


    io.on("connection", (socket)=>{


        console.log(
            "Socket connected:",
            socket.id
        );


        socket.on(
            "join_qr",
            (qr_token)=>{


                console.log(
                    "QR Joined:",
                    qr_token
                );


                socket.join(qr_token);

            }
        );


        socket.on(
            "disconnect",
            ()=>{

                console.log(
                    "Socket disconnected"
                );

            }
        );


    });


};


const getIO = ()=>{

    if(!io){
        throw new Error(
            "Socket.io not initialized"
        );
    }

    return io;

};


module.exports = {
    initSocket,
    getIO
};