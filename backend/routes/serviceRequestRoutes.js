
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isResident } = require("../middleware/authMiddleware");

// ======================================================
// GET: RETRIEVE SERVICE REQUESTS FOR LOGGED-IN RESIDENT
// ======================================================

router.get("/", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const result = await pool.query(
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
             WHERE sr.user_id = $1
             ORDER BY sr.created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            requests: result.rows
        });

    } catch (error) {
        console.error("Error retrieving service requests:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve service requests."
        });
    }
});


// ======================================================
// POST: CREATE A SERVICE REQUEST
// ======================================================

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
            typeof document_type !== "string" ||
            typeof purpose_category !== "string" ||
            typeof specific_details !== "string" ||
            !document_type.trim() ||
            !purpose_category.trim() ||
            !specific_details.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Document type, purpose category, and specific details are required."
            });
        }

        // Insert service request
        const insertResult = await pool.query(
            `INSERT INTO service_requests (
                user_id,
                document_type,
                purpose_category,
                specific_details,
                supporting_document_path,
                request_status
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING request_id`,
            [
                userId,
                document_type.trim(),
                purpose_category.trim(),
                specific_details.trim(),
                supporting_document_path || null,
                "In Review"
            ]
        );

        const requestId = insertResult.rows[0].request_id;

        // Retrieve resident name
        const residentResult = await pool.query(
            `SELECT full_legal_name
             FROM users
             WHERE user_id = $1`,
            [userId]
        );

        const residentName = residentResult.rows.length > 0
            ? residentResult.rows[0].full_legal_name
            : "A resident";

        // ==================================================
        // ADMIN NOTIFICATION
        // ==================================================

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
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    "admin",
                    null,
                    "new_service_request",
                    "New Service Request",
                    `${residentName} submitted a request for ${document_type.trim()}.`,
                    "requests",
                    String(requestId)
                ]
            );

        } catch (notificationError) {
            console.error(
                "Admin notification error:",
                notificationError
            );
        }

        // ==================================================
        // RESIDENT NOTIFICATION
        // ==================================================

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
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    "resident",
                    userId,
                    "service_request_submitted",
                    "Service Request Submitted",
                    `Your request for ${document_type.trim()} has been submitted successfully and is now In Review.`,
                    "requests",
                    String(requestId)
                ]
            );

        } catch (notificationError) {
            console.error(
                "Resident notification error:",
                notificationError
            );
        }

        return res.status(201).json({
            success: true,
            message: "Service request submitted successfully.",
            request: {
                request_id: requestId,
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


// ======================================================
// PATCH: CANCEL A SERVICE REQUEST
// ======================================================

router.patch("/:requestId/cancel", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const requestId = Number(req.params.requestId);

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid service request ID."
            });
        }

        const result = await pool.query(
            `UPDATE service_requests
             SET
                request_status = 'Cancelled',
                updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $1
               AND user_id = $2
               AND request_status NOT IN (
                   'Ready for Pickup',
                   'Completed',
                   'Cancelled'
               )
             RETURNING request_id, request_status`,
            [requestId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({
                success: false,
                message: "Request cannot be cancelled or was not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Service request cancelled successfully.",
            request: result.rows[0]
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