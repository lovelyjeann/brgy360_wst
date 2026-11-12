
const express = require("express");
const router = express.Router();

const { isResident } = require("../middleware/authMiddleware");
const pool = require("../database/db");
const bcrypt = require("bcrypt");

// ======================================================
// GET LOGGED-IN RESIDENT'S PROFILE
// ======================================================
router.get("/profile", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const result = await pool.query(
            `SELECT
                user_id,
                full_legal_name,
                gender,
                civil_status,
                date_of_birth,
                mobile_number,
                email,
                address,
                sitio_purok,
                id_type,
                id_file_path,
                residency_proof_type,
                residency_proof_path,
                verification_status,
                verification_notes,
                reviewed_at
             FROM users
             WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident profile not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Get resident profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving profile."
        });
    }
});


// ======================================================
// UPDATE LOGGED-IN RESIDENT'S PROFILE
// ======================================================
router.put("/profile", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const {
            mobile_number,
            email,
            address,
            sitio_purok
        } = req.body;

        // Validate required fields.
        if (
            typeof mobile_number !== "string" ||
            typeof email !== "string" ||
            typeof address !== "string" ||
            typeof sitio_purok !== "string" ||
            !mobile_number.trim() ||
            !email.trim() ||
            !address.trim() ||
            !sitio_purok.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required profile fields."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedMobile = mobile_number.trim();
        const normalizedAddress = address.trim();
        const normalizedSitio = sitio_purok.trim();

        // Validate email format.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Update resident record.
        // Age is intentionally not saved because it is calculated
        // from date_of_birth on the frontend.
        const result = await pool.query(
            `UPDATE users
             SET
                mobile_number = $1,
                email = $2,
                address = $3,
                sitio_purok = $4
             WHERE user_id = $5
             RETURNING
                user_id,
                full_legal_name,
                mobile_number,
                email,
                address,
                sitio_purok,
                date_of_birth`,
            [
                normalizedMobile,
                normalizedEmail,
                normalizedAddress,
                normalizedSitio,
                userId
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident profile not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Update resident profile error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error while updating profile."
        });
    }
});


// ======================================================
// CHANGE PASSWORD FOR LOGGED-IN RESIDENT
// ======================================================
router.put("/change-password", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const {
            currentPassword,
            newPassword
        } = req.body;

        // Validate required fields.
        if (
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            !currentPassword ||
            !newPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required."
            });
        }

        // Validate new password.
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long."
            });
        }

        if (
            !/[a-zA-Z]/.test(newPassword) ||
            !/[0-9]/.test(newPassword)
        ) {
            return res.status(400).json({
                success: false,
                message: "New password must contain both letters and numbers."
            });
        }

        // Retrieve current password hash.
        const userResult = await pool.query(
            `SELECT password_hash
             FROM users
             WHERE user_id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident account not found."
            });
        }

        const user = userResult.rows[0];

        if (!user.password_hash) {
            return res.status(400).json({
                success: false,
                message: "Your account does not have a password configured."
            });
        }

        // Verify current password.
        const isPasswordValid = await bcrypt.compare(
            currentPassword,
            user.password_hash
        );

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect."
            });
        }

        // Prevent reusing the current password.
        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password cannot be the same as your current password."
            });
        }

        // Hash new password.
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            `UPDATE users
             SET password_hash = $1
             WHERE user_id = $2`,
            [newPasswordHash, userId]
        );

        return res.status(200).json({
            success: true,
            message: "Password updated successfully."
        });

    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating password."
        });
    }
});


// ======================================================
// GET RESIDENT NOTIFICATIONS
// ======================================================
router.get("/notifications", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const result = await pool.query(
            `SELECT
                notification_id,
                event_type,
                title,
                message,
                target_section,
                target_record_id,
                is_read,
                created_at
             FROM notifications
             WHERE recipient_type = 'resident'
               AND user_id = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId]
        );

        const notifications = result.rows;

        const unreadCount = notifications.filter(
            notification => notification.is_read === false
        ).length;

        return res.status(200).json({
            success: true,
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error("Get resident notifications error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve your notifications."
        });
    }
});


// ======================================================
// MARK ONE RESIDENT NOTIFICATION AS READ
// ======================================================
router.patch("/notifications/:id/read", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const notificationId = Number(req.params.id);

        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID."
            });
        }

        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE notification_id = $1
               AND recipient_type = 'resident'
               AND user_id = $2
             RETURNING notification_id`,
            [notificationId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read."
        });

    } catch (error) {
        console.error("Mark resident notification as read error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update notification."
        });
    }
});


// ======================================================
// MARK ALL RESIDENT NOTIFICATIONS AS READ
// ======================================================
router.patch("/notifications/read-all", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE recipient_type = 'resident'
               AND user_id = $1
               AND is_read = FALSE`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read."
        });

    } catch (error) {
        console.error("Mark all resident notifications as read error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to mark all notifications as read."
        });
    }
});


module.exports = router;