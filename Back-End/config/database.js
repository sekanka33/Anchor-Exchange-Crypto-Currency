const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// An idle client can error (e.g. Postgres restarts). Without a listener that
// 'error' event is unhandled and takes the whole process down.
pool.on("error", (error) => {
    console.error("Unexpected idle database client error:", error.message);
});

pool.connect()
    .then((client) => {
        client.release();
        console.log("Database connected successfully");
    })
    .catch((error) => console.error("Database connection failed:", error));

module.exports = pool;