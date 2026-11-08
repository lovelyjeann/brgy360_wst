const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

const pool = require("../database/db");

const sessionStore = new MySQLStore(
    {
        clearExpired: true,
        checkExpirationInterval: 900000,
        expiration: 86400000
    },
    pool
);

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
