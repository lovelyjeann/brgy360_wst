
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const sendConcernResolvedEmail = require("../utils/sendConcernResolvedEmail");
const { isResident, isAdmin } = require("../middleware/authMiddleware");

// ======================================================
// RESIDENT SUBMITS A CONCERN
// ======================================================
router.post("/", isResident, async (req, res) => {
    try {
        const {
            concern_title,
            category,
            urgency_level,
            sitio_area,
            exact_location,
            detailed_description,
            reporter_name,
            reporter_contact,
            photo_name,
            photo_data
        } = req.body;

        // Validate required concern details.
        if (
            !concern_title ||
            !category ||
            !urgency_level ||
            !sitio_area ||
            !exact_location ||
            !detailed_description
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required concern details."
            });
        }

        const userId = req.session.user.id;

        // Insert concern into PostgreSQL.
        const insertResult = await pool.query(
            `INSERT INTO concerns (
                user_id,
                reporter_name,
                reporter_contact,
                concern_title,
                category,
                urgency_level,
                sitio_area,
                exact_location,
                detailed_description,
                photo_name,
                photo_data,
                concern_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12
            )
            RETURNING concern_id`,
            [
                userId,
                reporter_name || req.session.user.full_legal_name || null,
                reporter_contact || null,
                concern_title.trim(),
                category.trim(),
                urgency_level.trim(),
                sitio_area.trim(),
                exact_location.trim(),
                detailed_description.trim(),
                photo_name || null,
                photo_data || null,
                "Pending"
            ]
        );

        const concernId = insertResult.rows[0].concern_id;

        // Create an admin notification.
        try {
            const residentName =
                req.session.user.full_legal_name || "A resident";

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
                    "admin",
                    null,
                    "new_concern",
                    "New Community Concern",
                    `${residentName} reported a concern: ${concern_title.trim()}.`,
                    "concerns",
                    String(concernId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create concern notification:",
                notificationError
            );
        }

        // Create a notification for the resident.
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
                    userId,
                    "concern_submitted",
                    "Concern Submitted",
                    `Your concern "${concern_title.trim()}" has been submitted successfully and is now Pending.`,
                    "concerns",
                    String(concernId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create resident concern notification:",
                notificationError
            );
        }

        return res.status(201).json({
            success: true,
            message: "Concern submitted successfully.",
            concern_id: concernId,
            ticket_ref: `TCK-${String(concernId).padStart(4, "0")}`
        });

    } catch (error) {
        console.error("Resident concern submission error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while submitting concern."
        });
    }
});


// ======================================================
// ADMIN LOGS A CONCERN FROM A WALK-IN REPORTER
// ======================================================
router.post("/walk-in", isAdmin, async (req, res) => {
    try {
        const {
            concern_title,
            category,
            urgency_level,
            sitio_area,
            exact_location,
            detailed_description,
            reporter_name,
            reporter_contact
        } = req.body;

        // Validate required fields.
        if (
            !concern_title ||
            !category ||
            !urgency_level ||
            !sitio_area ||
            !exact_location ||
            !detailed_description ||
            !reporter_name ||
            !reporter_contact
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required concern and reporter details."
            });
        }

        const insertResult = await pool.query(
            `INSERT INTO concerns (
                user_id,
                reporter_name,
                reporter_contact,
                concern_title,
                category,
                urgency_level,
                sitio_area,
                exact_location,
                detailed_description,
                concern_status
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
            RETURNING concern_id`,
            [
                null,
                reporter_name.trim(),
                reporter_contact.trim(),
                concern_title.trim(),
                category.trim(),
                urgency_level.trim(),
                sitio_area.trim(),
                exact_location.trim(),
                detailed_description.trim(),
                "Pending"
            ]
        );

        const concernId = insertResult.rows[0].concern_id;

        return res.status(201).json({
            success: true,
            message: "Walk-in concern logged successfully.",
            concern_id: concernId
        });

    } catch (error) {
        console.error("Log walk-in concern error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error while logging concern."
        });
    }
});


// ======================================================
// RESIDENT RETRIEVES THEIR OWN CONCERNS
// ======================================================
router.get("/my", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const result = await pool.query(
            `SELECT
                c.concern_id,
                c.user_id,
                c.reporter_name,
                c.reporter_contact,
                c.concern_title,
                c.category,
                c.urgency_level,
                c.sitio_area,
                c.exact_location,
                c.detailed_description,
                c.concern_status,
                c.date_submitted,
                c.updated_at,
                c.resolution_notes,
                c.resolved_at,
                u.full_legal_name,
                u.email,
                u.mobile_number,
                u.address
             FROM concerns c
             LEFT JOIN users u ON c.user_id = u.user_id
             WHERE c.user_id = $1
             ORDER BY c.date_submitted DESC, c.concern_id DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            concerns: result.rows
        });

    } catch (error) {
        console.error("Get resident concerns error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving your concerns."
        });
    }
});


// ======================================================
// ADMIN UPDATES A CONCERN'S STATUS
// ======================================================
router.patch("/:id/status", isAdmin, async (req, res) => {
    try {
        const concernId = req.params.id;
        const { concern_status, resolution_notes } = req.body;

        const allowedStatuses = [
            "Pending",
            "In Progress",
            "Resolved"
        ];

        if (!allowedStatuses.includes(concern_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid concern status."
            });
        }

        // Get the concern and owner's email before updating.
        const concernResult = await pool.query(
            `SELECT
                c.concern_id,
                c.user_id,
                c.concern_title,
                c.concern_status,
                c.reporter_contact,
                u.email
             FROM concerns c
             LEFT JOIN users u ON c.user_id = u.user_id
             WHERE c.concern_id = $1`,
            [concernId]
        );

        if (concernResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Concern not found."
            });
        }

        const concern = concernResult.rows[0];

        const wasNotResolved =
            concern.concern_status !== "Resolved";

        const statusChanged =
            concern.concern_status !== concern_status;

        // Update the concern.
        await pool.query(
            `UPDATE concerns
             SET concern_status = $1,
                 resolution_notes = $2,
                 resolved_at = CASE
                     WHEN $3 = 'Resolved'
                     THEN CURRENT_TIMESTAMP
                     ELSE NULL
                 END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE concern_id = $4`,
            [
                concern_status,
                resolution_notes || null,
                concern_status,
                concernId
            ]
        );

        // Notify the resident when their concern status changes.
        if (concern.user_id && statusChanged) {
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
                        concern.user_id,
                        concern_status === "Resolved"
                            ? "concern_resolved"
                            : "concern_status_changed",
                        concern_status === "Resolved"
                            ? "Concern Resolved"
                            : "Concern Status Updated",
                        `Your concern "${concern.concern_title}" has been updated to "${concern_status}".`,
                        "concerns",
                        String(concern.concern_id)
                    ]
                );
            } catch (notificationError) {
                console.error(
                    "Failed to create resident concern notification:",
                    notificationError
                );
            }
        }

        // Send email only when the concern first becomes Resolved.
        if (concern_status === "Resolved" && wasNotResolved) {
            const recipientEmail = concern.email;

            if (recipientEmail) {
                try {
                    await sendConcernResolvedEmail(
                        recipientEmail,
                        concern.concern_title,
                        concern.concern_id,
                        resolution_notes
                    );

                    console.log(
                        "Resolution email sent to:",
                        recipientEmail
                    );
                } catch (emailError) {
                    console.error(
                        "Resolution email failed:",
                        emailError
                    );
                }
            } else {
                console.log(
                    "No resident email found for concern:",
                    concernId
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Concern status updated successfully."
        });

    } catch (error) {
        console.error("Update concern status error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating concern status."
        });
    }
});


// ======================================================
// ADMIN RETRIEVES ALL CONCERNS
// ======================================================
router.get("/", isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                c.concern_id,
                c.user_id,
                c.reporter_name,
                c.reporter_contact,
                c.concern_title,
                c.category,
                c.date_submitted,
                c.urgency_level,
                c.sitio_area,
                c.exact_location,
                c.detailed_description,
                c.photo_name,
                c.photo_data,
                c.concern_status,
                c.updated_at,
                c.resolution_notes,
                c.resolved_at,
                u.full_legal_name,
                u.mobile_number,
                u.email,
                u.address
             FROM concerns c
             LEFT JOIN users u
                ON c.user_id = u.user_id
             ORDER BY c.date_submitted DESC, c.concern_id DESC`
        );

        return res.status(200).json({
            success: true,
            concerns: result.rows
        });

    } catch (error) {
        console.error("Get concerns error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving concerns."
        });
    }
});


module.exports = router;
