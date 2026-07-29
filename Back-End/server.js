const express = require("express");
const cors = require("cors");
const http = require("http");


const { initSocket } = require("./socket");


const app = express();

const PORT = 5000;



// Middleware

app.use(cors({

    origin:"http://localhost:5173",
    credentials:true

}));


app.use(express.json());




// Routes

const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const userRoutes = require("./routes/userRoutes");
const qrRoutes = require("./routes/qrRoutes");



app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/wallet",
    walletRoutes
);


app.use(
    "/api/users",
    userRoutes
);


app.use(
    "/api/qr",
    qrRoutes
);




// Create HTTP server

const server = http.createServer(app);




// Start Socket.IO

initSocket(server);




// Start server

server.listen(PORT,()=>{

    console.log(
        `Server running on port ${PORT}`
    );

});