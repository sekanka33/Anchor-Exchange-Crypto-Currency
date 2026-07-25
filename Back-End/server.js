const express = require("express");
const cors = require("cors");

const app = express();

const PORT = 5000;


// Middleware
app.use(cors());
app.use(express.json());


// Routes
const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const userRoutes = require("./routes/userRoutes");


// Register routes
app.use("/", authRoutes);
app.use("/", walletRoutes);
app.use("/api/users", userRoutes);


// Test route
app.get("/", (req, res) => {
    res.send("Anchor Exchange Backend is running 🚀");
});


// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});