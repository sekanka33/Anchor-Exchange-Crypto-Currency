// Drops and recreates the throwaway test database from db/schema.sql.
// Run automatically by `npm test` (pretest).
require("./env");

const path = require("path");
const { execFileSync } = require("child_process");
const { Client } = require("pg");

const dbName = process.env.DB_NAME;

const main = async () => {
    const admin = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: "postgres"
    });

    await admin.connect();
    await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [dbName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    execFileSync(
        "psql",
        [
            "-h", process.env.DB_HOST,
            "-p", String(process.env.DB_PORT),
            "-U", process.env.DB_USER,
            "-d", dbName,
            "-v", "ON_ERROR_STOP=1",
            "-q",
            "-f", path.join(__dirname, "../../db/schema.sql")
        ],
        { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, stdio: ["ignore", "ignore", "inherit"] }
    );

    // schema.sql is the baseline snapshot; migrations bring it to current.
    const pool = new (require("pg").Pool)({
        host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: dbName
    });
    await require("../../db/migrate").migrate(pool, () => {});
    await pool.end();

    console.log(`Test database "${dbName}" recreated from db/schema.sql`);
};

main().catch((error) => {
    console.error("Test DB setup failed:", error.message);
    process.exit(1);
});
