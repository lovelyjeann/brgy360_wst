
const express = require("express");
const router = express.Router();

const { isResident } = require("../middleware/authMiddleware");
const pool = require("../database/db");
const bcrypt = require("bcrypt");

// Get logged-in resident's profile
router.get("/profile", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [users] = await pool.query(
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
            WHERE user_id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident profile not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: users[0]
        });

    } catch (error) {
        console.error("Get resident profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving profile."
        });
    }
});

// Update logged-in resident's profile
router.put("/profile", isResident, async (req, res) => {
        console.log("PUT /api/residents/profile reached");
    try {
        const userId = req.session.user.id;

        const {
            mobile_number,
            email,
            age,
            address,
            sitio_purok
        } = req.body;

        // Validate required fields
        if (
            !mobile_number ||
            !email ||
            !age ||
            !address ||
            !sitio_purok
        ) {
            return res.status(400).json({
                success: false,
                message: "All profile fields are required."
            });
        }

        // Update resident record
        const [result] = await pool.query(
            `UPDATE users
             SET
                mobile_number = ?,
                email = ?,
                address = ?,
                sitio_purok = ?
             WHERE user_id = ?`,
            [
                mobile_number.trim(),
                email.trim(),
                address.trim(),
                sitio_purok,
                userId
            ]
        );
        console.log("Profile update result:", result);
        console.log("Session user ID:", userId);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident profile not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully."
        });

    } catch (error) {
    console.error("Update resident profile error:", error);

    return res.status(500).json({
        success: false,
        message: error.message || "Internal server error."
    });
}
});

// Change password for logged-in resident
router.put("/change-password", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const {
            currentPassword,
            newPassword
        } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required."
            });
        }

        // Validate new password
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters long."
            });
        }

        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "New password must contain both letters and numbers."
            });
        }

        // Retrieve the resident's current password hash
        const [users] = await pool.query(
            `SELECT password_hash
             FROM users
             WHERE user_id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident account not found."
            });
        }

        const user = users[0];

        // Verify current password
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

        // Prevent using the same password
        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password cannot be the same as your current password."
            });
        }

        // Hash the new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password in database
        await pool.query(
            `UPDATE users
             SET password_hash = ?
             WHERE user_id = ?`,
            [newPasswordHash, userId]
        );

        return res.status(200).json({
            success: true,
            message: "Password updated successfully."
        });

    } catch (error) {
        console.error("Change password error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error while updating password."
        });
    }
});

// ======================================================
// RESIDENT NOTIFICATION MANAGEMENT
// ======================================================

// GET: Retrieve notifications for the logged-in resident
router.get("/notifications", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [notifications] = await pool.query(
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
             AND user_id = ?
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId]
        );

        const unreadCount = notifications.filter(
            notification => Number(notification.is_read) === 0
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

// PATCH: Mark one resident notification as read
router.patch("/notifications/:id/read", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const notificationId = req.params.id;

        const [result] = await pool.query(
            `UPDATE notifications
             SET is_read = 1
             WHERE notification_id = ?
             AND recipient_type = 'resident'
             AND user_id = ?`,
            [notificationId, userId]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.query(
                `SELECT notification_id
                 FROM notifications
                 WHERE notification_id = ?
                 AND recipient_type = 'resident'
                 AND user_id = ?`,
                [notificationId, userId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found."
                });
            }
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

// PATCH: Mark all resident notifications as read
router.patch("/notifications/read-all", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        await pool.query(
            `UPDATE notifications
             SET is_read = 1
             WHERE recipient_type = 'resident'
             AND user_id = ?
             AND is_read = 0`,
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
