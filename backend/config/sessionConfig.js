
const path = require("path");

// Load environment variables from backend/.env
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const pool = require("../database/db");

// Validate session secret
if (!process.env.SESSION_SECRET) {
    throw new Error(
        "SESSION_SECRET is missing. Check backend/.env."
    );
}

const PostgreSQLStore = connectPgSimple(session);

const sessionStore = new PostgreSQLStore({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true,
    pruneSessionInterval: 900,
    ttl: 24 * 60 * 60
});

const sessionConfig = session({
    name: "brgy360.sid",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
});

module.exports = sessionConfig;
