// Minimal forward-only migration runner.
//   node db/migrate.js         apply every pending db/migrations/*.sql, in name order
//
// Fresh install:  psql -f db/schema.sql   (baseline snapshot)  then  node db/migrate.js
// Each migration runs in its own transaction and is recorded in
// schema_migrations, so re-running is a no-op and a failing migration leaves
// the database exactly as it was.
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const migrate = async (pool, log = console.log) => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT NOW()
        )
    `);

    const applied = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const ran = [];

    for (const file of files) {
        if (applied.has(file)) continue;

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [file]);
            await client.query("COMMIT");
            log(`applied ${file}`);
            ran.push(file);
        } catch (error) {
            await client.query("ROLLBACK");
            throw new Error(`Migration ${file} failed and was rolled back: ${error.message}`);
        } finally {
            client.release();
        }
    }

    if (ran.length === 0) log("database is up to date");
    return ran;
};

module.exports = { migrate };

if (require.main === module) {
    require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
    const pool = require("../config/database");

    migrate(pool)
        .then(() => pool.end())
        .catch((error) => {
            console.error(error.message);
            process.exit(1);
        });
}
