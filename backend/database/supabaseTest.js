
require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || "postgres",
    ssl: {
        rejectUnauthorized: false
    }
});

const tables = [
    "users",
    "admins",
    "announcements",
    "budget_records",
    "concerns",
    "notifications",
    "project_proposals",
    "projects",
    "service_requests"
];

async function testSupabase() {
    try {
        console.log("\nBRGY360 SUPABASE DATABASE CHECK\n");

        const connection = await pool.query(`
            SELECT
                current_database() AS database,
                current_user AS connected_user,
                NOW() AS server_time
        `);

        console.log("SUPABASE CONNECTION SUCCESSFUL!");
        console.log("Database:", connection.rows[0].database);
        console.log("Connected user:", connection.rows[0].connected_user);
        console.log("Server time:", connection.rows[0].server_time);

        console.log("\nTABLE RECORD COUNTS\n");

        for (const table of tables) {
            const result = await pool.query(
                `SELECT COUNT(*) AS total FROM public."${table}"`
            );

            console.log(`${table}: ${result.rows[0].total}`);
        }

        console.log("\nSUPABASE CHECK COMPLETED.");

    } catch (error) {
        console.error("SUPABASE TEST ERROR:", error.message);
        process.exitCode = 1;

    } finally {
        await pool.end();
    }
}

testSupabase();
