
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const pool = require("../database/db");

require("dotenv").config();

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
