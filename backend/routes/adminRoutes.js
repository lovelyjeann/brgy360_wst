
const express = require("express");
const router = express.Router();

const { isAdmin } = require("../middleware/authMiddleware");

const {
    getPendingResidents,
    getAllResidents,
    updateResidentVerification,
    createPreRegisteredResident,
    sendResidentSetupEmail,
    getGeographicBreakdown
} = require("../controllers/adminController");

const pool = require("../database/db");
const sendPickupReadyEmail = require("../utils/sendPickupReadyEmail");

// ======================================================
// ADMIN NOTIFICATION MANAGEMENT
// ======================================================

// GET: Retrieve admin notifications
router.get("/notifications", isAdmin, async (req, res) => {
    try {
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
             WHERE recipient_type = 'admin'
             ORDER BY created_at DESC
             LIMIT 100`
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
        console.error("Error retrieving admin notifications:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve admin notifications."
        });
    }
});

// PATCH: Mark one admin notification as read
router.patch("/notifications/:id/read", isAdmin, async (req, res) => {
    try {
        const notificationId = req.params.id;

        const [result] = await pool.query(
            `UPDATE notifications
             SET is_read = 1
             WHERE notification_id = ?
             AND recipient_type = 'admin'`,
            [notificationId]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.query(
                `SELECT notification_id
                 FROM notifications
                 WHERE notification_id = ?
                 AND recipient_type = 'admin'`,
                [notificationId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Admin notification not found."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read."
        });

    } catch (error) {
        console.error("Error marking notification as read:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update notification."
        });
    }
});

// PATCH: Mark all admin notifications as read
router.patch("/notifications/read-all", isAdmin, async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications
             SET is_read = 1
             WHERE recipient_type = 'admin'
             AND is_read = 0`
        );

        return res.status(200).json({
            success: true,
            message: "All admin notifications marked as read."
        });

    } catch (error) {
        console.error("Error marking all notifications as read:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update admin notifications."
        });
    }
});

// Admin dashboard
router.get("/dashboard", isAdmin, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Admin dashboard route is working."
    });
});

// Get pending residents
router.get("/residents/pending", isAdmin, getPendingResidents);

// Get all residents
router.get("/residents/all", isAdmin, getAllResidents);

// Get geographic breakdown of residents
router.get("/residents/geographic-breakdown", isAdmin, getGeographicBreakdown);

// Pre-register a resident
router.post("/residents/pre-register", isAdmin, createPreRegisteredResident);

// Approve or reject a resident
router.patch("/residents/:userId/verification", isAdmin, updateResidentVerification);

// Send account setup email to an approved resident
router.post("/residents/:userId/send-setup-email", isAdmin, sendResidentSetupEmail);


// ======================================================
// SERVICE REQUEST MANAGEMENT
// ======================================================

// GET: Retrieve all service requests for admin

router.get("/requests", isAdmin, async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT
                sr.request_id,
                sr.user_id,
                sr.user_id,
                sr.document_type,
                sr.purpose_category,
                sr.specific_details,
                sr.supporting_document_path,
                sr.request_status,
                sr.created_at,
                sr.updated_at,
                sr.ready_for_pickup_at,
                sr.completed_at,
                u.full_legal_name,
                u.email,
                u.mobile_number,
                u.address,
                u.date_of_birth
            FROM service_requests sr
            INNER JOIN users u ON sr.user_id = u.user_id
            ORDER BY sr.created_at DESC`
        );

        return res.status(200).json({
            success: true,
            requests
        });

    } catch (error) {
        console.error("Error retrieving admin service requests:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve service requests."
        });
    }
});

// PATCH: Update a service request status
router.patch("/requests/:id/status", isAdmin, async (req, res) => {
    try {
        const requestId = req.params.id;
        const { request_status } = req.body;

        const allowedStatuses = [
            "In Review",
            "Ready for Pickup",
            "Completed",
            "Rejected"
        ];

        if (!allowedStatuses.includes(request_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request status."
            });
        }

        // Get the request and resident details before updating.
        const [requests] = await pool.query(
            `SELECT
                sr.request_id,
                sr.request_status,
                sr.document_type,
                u.full_legal_name,
                u.email
             FROM service_requests sr
             INNER JOIN users u ON sr.user_id = u.user_id
             WHERE sr.request_id = ?`,
            [requestId]
        );

        if (requests.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        const request = requests[0];

        // Send an email only when the status changes to Ready for Pickup.
        const shouldSendPickupEmail =
            request_status === "Ready for Pickup" &&
            request.request_status !== "Ready for Pickup";

        // Update the request status.
        const [result] = await pool.query(
            `UPDATE service_requests
             SET
                request_status = ?,
                ready_for_pickup_at = CASE
                    WHEN ? = 'Ready for Pickup'
                    THEN COALESCE(ready_for_pickup_at, NOW())
                    ELSE ready_for_pickup_at
                END,
                completed_at = CASE
                    WHEN ? = 'Completed'
                    THEN COALESCE(completed_at, NOW())
                    ELSE completed_at
                END
             WHERE request_id = ?`,
            [
                request_status,
                request_status,
                request_status,
                requestId
            ]
        );

                if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        // Notify the resident when their request status changes.
        const statusChanged = request.request_status !== request_status;

        if (statusChanged) {
            try {
                await pool.query(
                    `INSERT INTO notifications (
                        recipient_type,
                        user_id,
                        event_type,
                        title,
                        message,
                        target_section,
                        target_record_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        "resident",
                        request.user_id,
                        "service_request_status_changed",
                        "Service Request Update",
                        `Your ${request.document_type} request status has been updated to "${request_status}".`,
                        "requests",
                        String(request.request_id)
                    ]
                );
            } catch (notificationError) {
                console.error(
                    "Failed to create service request notification:",
                    notificationError
                );
            }
        }

        // Send the pickup-ready email without failing the status update
        // if the email service encounters an error.
        if (shouldSendPickupEmail && request.email) {
            try {
                await sendPickupReadyEmail(
                    request.email,
                    request.full_legal_name,
                    request.document_type,
                    requestId
                );

                console.log(
                    `Pickup-ready email sent to ${request.email} for request ${requestId}.`
                );
            } catch (emailError) {
                console.error(
                    "Failed to send pickup-ready email:",
                    emailError
                );
            }
        }

        return res.json({
            success: true,
            message: "Request status updated successfully."
        });

    } catch (error) {
        console.error("Error updating request status:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating request status."
        });
    }
});

module.exports = router;
