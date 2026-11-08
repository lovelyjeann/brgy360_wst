require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const sessionConfig = require("./config/sessionConfig");

const authRoutes = require("./routes/authRoutes");
const residentRoutes = require("./routes/residentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const concernRoutes = require("./routes/concernRoutes");
const serviceRequestRoutes = require("./routes/serviceRequestRoutes");
const projectRoutes = require("./routes/projectRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const announcementRoutes = require("./routes/announcementRoutes");

const app = express();

// Port
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Session middleware
app.use(sessionConfig);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Main API test route
app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Brgy360 Backend API is running!"
    });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Resident routes
app.use("/api/residents", residentRoutes);

// Service Request routes
app.use("/api/resident/requests", serviceRequestRoutes);

// Concern routes
app.use("/api/concerns", concernRoutes);

// Project routes
app.use("/api/projects", projectRoutes);

// Project Proposal routes
app.use("/api/proposals", proposalRoutes);

// Budget routes
app.use("/api/budget", budgetRoutes);

// Announcement routes
app.use("/api/announcements", announcementRoutes);


// Admin routes
app.use("/api/admin", adminRoutes);

app.post("/api/admin/residents/pre-register-test", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "POST route is working!"
    });
});

// Temporary admin route connection test
app.get("/api/admin/test", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Admin routes are connected!"
    });
});

// 404 handler
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Brgy360 backend running on http://localhost:${PORT}`);
});
