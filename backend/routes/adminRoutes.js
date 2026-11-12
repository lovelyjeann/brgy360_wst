
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
             WHERE recipient_type = 'admin'
             ORDER BY created_at DESC
             LIMIT 100`
        );

        const notifications = result.rows;

        const unreadCount = notifications.filter(
            notification => !notification.is_read
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
               AND recipient_type = 'admin'
             RETURNING notification_id`,
            [notificationId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin notification not found."
            });
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
             SET is_read = TRUE
             WHERE recipient_type = 'admin'
               AND is_read = FALSE`
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


// ======================================================
// ADMIN DASHBOARD
// ======================================================

router.get("/dashboard", isAdmin, (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Admin dashboard route is working."
    });
});


// ======================================================
// RESIDENT MANAGEMENT
// ======================================================

router.get("/residents/pending", isAdmin, getPendingResidents);

router.get("/residents/all", isAdmin, getAllResidents);

router.get(
    "/residents/geographic-breakdown",
    isAdmin,
    getGeographicBreakdown
);

router.post(
    "/residents/pre-register",
    isAdmin,
    createPreRegisteredResident
);

router.patch(
    "/residents/:userId/verification",
    isAdmin,
    updateResidentVerification
);

router.post(
    "/residents/:userId/send-setup-email",
    isAdmin,
    sendResidentSetupEmail
);


// ======================================================
// SERVICE REQUEST MANAGEMENT
// ======================================================

// GET: Retrieve all service requests for admin
router.get("/requests", isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                sr.request_id,
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
             INNER JOIN users u
                ON sr.user_id = u.user_id
             ORDER BY sr.created_at DESC`
        );

        return res.status(200).json({
            success: true,
            requests: result.rows
        });

    } catch (error) {
        console.error("Error retrieving admin service requests:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve service requests."
        });
    }
});


// PATCH: Update service request status
router.patch("/requests/:id/status", isAdmin, async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        const { request_status } = req.body;

        const allowedStatuses = [
            "In Review",
            "Ready for Pickup",
            "Completed",
            "Rejected"
        ];

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid service request ID."
            });
        }

        if (!allowedStatuses.includes(request_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request status."
            });
        }

        // Retrieve the request and resident details
        const requestResult = await pool.query(
            `SELECT
                sr.request_id,
                sr.user_id,
                sr.request_status,
                sr.document_type,
                u.full_legal_name,
                u.email
             FROM service_requests sr
             INNER JOIN users u
                ON sr.user_id = u.user_id
             WHERE sr.request_id = $1`,
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        const request = requestResult.rows[0];

        const statusChanged =
            request.request_status !== request_status;

        const shouldSendPickupEmail =
            request_status === "Ready for Pickup" &&
            request.request_status !== "Ready for Pickup";

        // Update the request status in PostgreSQL
        const updateResult = await pool.query(
            `UPDATE service_requests
             SET
                request_status = $1,
                ready_for_pickup_at = CASE
                    WHEN $2 = 'Ready for Pickup'
                    THEN COALESCE(ready_for_pickup_at, CURRENT_TIMESTAMP)
                    ELSE ready_for_pickup_at
                END,
                completed_at = CASE
                    WHEN $3 = 'Completed'
                    THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
                    ELSE completed_at
                END,
                updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $4
             RETURNING request_id, user_id, request_status`,
            [
                request_status,
                request_status,
                request_status,
                requestId
            ]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Service request could not be updated."
            });
        }

        // Create resident notification only when status changes
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
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

        // Send pickup-ready email when status changes to Ready for Pickup
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

        return res.status(200).json({
            success: true,
            message: "Request status updated successfully.",
            request: updateResult.rows[0]
        });

    } catch (error) {
        console.error("Error updating request status:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating request status.",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined
        });
    }
});

module.exports = router;