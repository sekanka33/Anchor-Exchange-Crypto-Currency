// Grants or revokes the admin role for an existing account.
//
//   node scripts/set-role.js <email> <admin|user>
//
// This is the only way to create the first administrator: it needs direct
// database access (the credentials in .env), so it can't be reached over
// HTTP. Registration always creates 'user' accounts, and after the first
// admin exists, admins can promote/demote others from the admin dashboard.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const pool = require("../config/database");

const ROLES = ["user", "admin"];

// Emails are matched exactly, the same way login matches them (the unique
// constraint is case-sensitive, so a case-insensitive match could hit two rows).
const main = async () => {
    const [email, role] = process.argv.slice(2);

    if (!email || !ROLES.includes(role)) {
        console.error("Usage: node scripts/set-role.js <email> <admin|user>");
        process.exitCode = 1;
        return;
    }

    if (role === "user") {
        const admins = await pool.query("SELECT email FROM users WHERE role = 'admin'");
        if (admins.rows.length === 1 && admins.rows[0].email === email) {
            console.error("Refusing to demote the last remaining admin.");
            process.exitCode = 1;
            return;
        }
    }

    const result = await pool.query(
        "UPDATE users SET role = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, role",
        [role, email]
    );

    if (result.rows.length === 0) {
        console.error(`No account found for ${email}. The user must register first.`);
        process.exitCode = 1;
        return;
    }

    const user = result.rows[0];
    console.log(`${user.email} (id ${user.id}) is now '${user.role}'. Takes effect on their next request.`);
};

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
