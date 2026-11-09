
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./database/db");

async function updateAdminPassword() {
    try {
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            throw new Error("Admin email and password are required.");
        }

        if (password.length < 12) {
            throw new Error("Password must be at least 12 characters.");
        }

        const result = await pool.query(
            "SELECT admin_id FROM admins WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error("Admin account not found.");
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            "UPDATE admins SET password_hash = $1 WHERE email = $2",
            [passwordHash, email]
        );

        console.log("Admin password updated successfully!");

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await pool.end();
    }
}

updateAdminPassword();
