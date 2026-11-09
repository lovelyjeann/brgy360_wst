
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAdmin } = require("../middleware/authMiddleware");

// ==========================================
// PUBLIC: Get all published announcements
// ==========================================
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                announcement_id,
                headline,
                category,
                target_audience,
                urgency,
                feed_summary,
                announcement_content,
                publication_status,
                published_at,
                created_at,
                updated_at
             FROM announcements
             WHERE publication_status = 'Published'
             ORDER BY
                CASE WHEN urgency = 'Critical' THEN 0 ELSE 1 END,
                published_at DESC,
                announcement_id DESC`
        );

        return res.status(200).json({
            success: true,
            announcements: result.rows
        });

    } catch (error) {
        console.error("Get public announcements error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving announcements."
        });
    }
});


// ==========================================
// ADMIN: Get all announcements
// Includes unpublished records
// ==========================================
router.get("/admin/all", isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM announcements
             ORDER BY created_at DESC, announcement_id DESC`
        );

        return res.status(200).json({
            success: true,
            announcements: result.rows
        });

    } catch (error) {
        console.error("Get all announcements error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving announcements."
        });
    }
});


// ==========================================
// ADMIN: Create announcement
// ==========================================
router.post("/", isAdmin, async (req, res) => {
    try {
        const {
            headline,
            category,
            target_audience,
            urgency,
            feed_summary,
            announcement_content,
            publication_status
        } = req.body;

        if (
            !headline ||
            !category ||
            !target_audience ||
            !announcement_content
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required announcement fields."
            });
        }

        const allowedStatuses = ["Published", "Unpublished"];

        const status = allowedStatuses.includes(publication_status)
            ? publication_status
            : "Unpublished";

        const publishedAt = status === "Published"
            ? new Date()
            : null;

        const result = await pool.query(
            `INSERT INTO announcements (
                headline,
                category,
                target_audience,
                urgency,
                feed_summary,
                announcement_content,
                publication_status,
                published_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING announcement_id`,
            [
                String(headline).trim(),
                String(category).trim(),
                String(target_audience).trim(),
                urgency === "Critical" ? "Critical" : "Standard",
                feed_summary || null,
                String(announcement_content).trim(),
                status,
                publishedAt
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Announcement created successfully.",
            announcement_id: result.rows[0].announcement_id
        });

    } catch (error) {
        console.error("Create announcement error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while creating announcement."
        });
    }
});


// ==========================================
// ADMIN: Update announcement
// ==========================================
router.put("/:announcementId", isAdmin, async (req, res) => {
    try {
        const announcementId = Number(req.params.announcementId);

        if (!Number.isInteger(announcementId) || announcementId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement ID."
            });
        }

        const {
            headline,
            category,
            target_audience,
            urgency,
            feed_summary,
            announcement_content,
            publication_status
        } = req.body;

        if (
            !headline ||
            !category ||
            !target_audience ||
            !announcement_content
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required announcement fields."
            });
        }

        const existingResult = await pool.query(
            `SELECT publication_status, published_at
             FROM announcements
             WHERE announcement_id = $1`,
            [announcementId]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found."
            });
        }

        const existing = existingResult.rows[0];
        const allowedStatuses = ["Published", "Unpublished"];

        const status = allowedStatuses.includes(publication_status)
            ? publication_status
            : existing.publication_status;

        let publishedAt = existing.published_at;

        if (status === "Unpublished") {
            publishedAt = null;
        } else if (
            !publishedAt ||
            existing.publication_status !== "Published"
        ) {
            publishedAt = new Date();
        }

        await pool.query(
            `UPDATE announcements
             SET
                headline = $1,
                category = $2,
                target_audience = $3,
                urgency = $4,
                feed_summary = $5,
                announcement_content = $6,
                publication_status = $7,
                published_at = $8
             WHERE announcement_id = $9`,
            [
                String(headline).trim(),
                String(category).trim(),
                String(target_audience).trim(),
                urgency === "Critical" ? "Critical" : "Standard",
                feed_summary || null,
                String(announcement_content).trim(),
                status,
                publishedAt,
                announcementId
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Announcement updated successfully."
        });

    } catch (error) {
        console.error("Update announcement error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating announcement."
        });
    }
});


// ==========================================
// ADMIN: Update announcement status and urgency
// ==========================================
router.patch("/:announcementId/status", isAdmin, async (req, res) => {
    try {
        const announcementId = Number(req.params.announcementId);
        const { publication_status, urgency } = req.body;

        if (!Number.isInteger(announcementId) || announcementId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement ID."
            });
        }

        const allowedStatuses = ["Published", "Unpublished"];
        const allowedUrgencies = ["Critical", "Standard"];

        if (
            !allowedStatuses.includes(publication_status) &&
            !allowedUrgencies.includes(urgency)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement status or urgency."
            });
        }

        const existingResult = await pool.query(
            `SELECT
                announcement_id,
                publication_status,
                urgency
             FROM announcements
             WHERE announcement_id = $1`,
            [announcementId]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found."
            });
        }

        const current = existingResult.rows[0];

        const nextStatus = allowedStatuses.includes(publication_status)
            ? publication_status
            : current.publication_status;

        const nextUrgency = allowedUrgencies.includes(urgency)
            ? urgency
            : current.urgency;

        if (
            nextStatus === "Published" &&
            current.publication_status === "Published"
        ) {
            await pool.query(
                `UPDATE announcements
                 SET
                    publication_status = $1,
                    urgency = $2
                 WHERE announcement_id = $3`,
                [
                    nextStatus,
                    nextUrgency,
                    announcementId
                ]
            );

        } else {
            const publishedAt = nextStatus === "Published"
                ? new Date()
                : null;

            await pool.query(
                `UPDATE announcements
                 SET
                    publication_status = $1,
                    urgency = $2,
                    published_at = $3
                 WHERE announcement_id = $4`,
                [
                    nextStatus,
                    nextUrgency,
                    publishedAt,
                    announcementId
                ]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Announcement updated successfully."
        });

    } catch (error) {
        console.error("Update announcement status error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating announcement."
        });
    }
});


module.exports = router;
