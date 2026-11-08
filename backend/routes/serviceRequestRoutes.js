
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isResident } = require("../middleware/authMiddleware");

// GET: Retrieve service requests for the logged-in resident
router.get("/", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [requests] = await pool.query(
            `SELECT
                sr.request_id,
                sr.user_id,
                u.full_legal_name,
                sr.document_type,
                sr.purpose_category,
                sr.specific_details,
                sr.supporting_document_path,
                sr.request_status,
                sr.created_at,
                sr.updated_at,
                sr.ready_for_pickup_at,
                sr.completed_at
            FROM service_requests sr
            LEFT JOIN users u
                ON u.user_id = sr.user_id
            WHERE sr.user_id = ?
            ORDER BY sr.created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            requests
        });

    } catch (error) {
        console.error("Error retrieving service requests:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve service requests."
        });
    }
});

// POST: Create a service request for the logged-in resident
router.post("/", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const {
            document_type,
            purpose_category,
            specific_details,
            supporting_document_path
        } = req.body;

        // Validate required fields
        if (
            !document_type?.trim() ||
            !purpose_category?.trim() ||
            !specific_details?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Document type, purpose category, and specific details are required."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO service_requests (
                user_id,
                document_type,
                purpose_category,
                specific_details,
                supporting_document_path,
                request_status
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                document_type.trim(),
                purpose_category.trim(),
                specific_details.trim(),
                supporting_document_path || null,
                "In Review"
            ]
        );

        // Retrieve the resident's name
        const [residents] = await pool.query(
            `SELECT full_legal_name
             FROM users
             WHERE user_id = ?`,
            [userId]
        );

        const residentName =
            residents.length > 0
                ? residents[0].full_legal_name
                : "A resident";

        // Create an admin notification
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
                    "admin",
                    null,
                    "new_service_request",
                    "New Service Request",
                    `${residentName} submitted a request for ${document_type.trim()}.`,
                    "requests",
                    String(result.insertId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create service request notification:",
                notificationError
            );
        }

        // Create a notification for the resident
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
                    userId,
                    "service_request_submitted",
                    "Service Request Submitted",
                    `Your request for ${document_type.trim()} has been submitted successfully and is now In Review.`,
                    "requests",
                    String(result.insertId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create resident service request notification:",
                notificationError
            );
        }

        return res.status(201).json({
            success: true,
            message: "Service request submitted successfully.",
            request: {
                request_id: result.insertId,
                user_id: userId,
                full_legal_name: residentName,
                document_type: document_type.trim(),
                purpose_category: purpose_category.trim(),
                specific_details: specific_details.trim(),
                supporting_document_path: supporting_document_path || null,
                request_status: "In Review"
            }
        });

    } catch (error) {
        console.error("Error creating service request:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to submit service request."
        });
    }
});

// PATCH: Cancel a service request belonging to the logged-in resident
router.patch("/:requestId/cancel", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const requestId = req.params.requestId;

        const [result] = await pool.query(
            `UPDATE service_requests
             SET request_status = 'Cancelled',
                 updated_at = CURRENT_TIMESTAMP
             WHERE request_id = ?
               AND user_id = ?
               AND request_status NOT IN (
                   'Ready for Pickup',
                   'Completed',
                   'Cancelled'
               )`,
            [requestId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Request cannot be cancelled or was not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Service request cancelled successfully."
        });

    } catch (error) {
        console.error("Error cancelling service request:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel service request."
        });
    }
});

module.exports = router;
