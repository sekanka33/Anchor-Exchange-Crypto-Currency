const jwt = require("jsonwebtoken");

let io;


const initSocket = (server) => {

    const { Server } = require("socket.io");


    io = new Server(server, {

        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
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




                socket.join(qr_token);

            }
        );


        // Personal room for real-time notifications (see utils/notify.js).
        // Notification text is private financial information (trades,
        // withdrawal alerts), so the client must present a valid JWT and the
        // room is derived from the *verified* token — a claimed user id is
        // never trusted, otherwise anyone could subscribe to anyone.
        socket.on(
            "join_user",
            (token)=>{
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
                    if (!decoded?.id) throw new Error("no id");
                    socket.join(`user:${decoded.id}`);
                } catch {
                    socket.emit("join_user:error", "Invalid or expired token");
                }
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