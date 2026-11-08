
const express = require("express");
const router = express.Router();

const {
    registerResident,
    loginResident,
    getCurrentUser,
    loginAdmin,
    setupResidentPassword,
    checkResidentEmail
} = require("../controllers/authController");

const upload = require("../middleware/uploadMiddleware");

// Check resident email availability
router.post("/check-email", checkResidentEmail);

// Resident registration
router.post(
    "/register",
    upload.fields([
        { name: "id_document", maxCount: 1 },
        { name: "residency_proof_document", maxCount: 1 }
    ]),
    registerResident
);

// Resident login
router.post("/login", loginResident);

// Resident password setup using email token
router.post("/setup-password", setupResidentPassword);

// Admin login
router.post("/admin/login", loginAdmin);

// Get current logged-in user
router.get("/me", getCurrentUser);

// Logout
router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.status(200).json({
            success: true,
            message: "Logout successful."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Logout failed."
            });
        }

        res.clearCookie("brgy360.sid");

        return res.status(200).json({
            success: true,
            message: "Logout successful."
        });
    });
});

module.exports = router;
