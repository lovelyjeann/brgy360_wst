
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAdmin } = require("../middleware/authMiddleware");

// ==========================================
// PUBLIC: Get all published announcements
// Accessible to guests and logged-in residents
// ==========================================
router.get("/", async (req, res) => {
    try {
        const [announcements] = await pool.query(
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
            announcements
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
        const [announcements] = await pool.query(
            `SELECT *
             FROM announcements
             ORDER BY created_at DESC, announcement_id DESC`
        );

        return res.status(200).json({
            success: true,
            announcements
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

        const [result] = await pool.query(
            `INSERT INTO announcements (
                headline,
                category,
                target_audience,
                urgency,
                feed_summary,
                announcement_content,
                publication_status,
                published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
            announcement_id: result.insertId
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
        const { announcementId } = req.params;

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

        const [existing] = await pool.query(
            `SELECT publication_status, published_at
             FROM announcements
             WHERE announcement_id = ?`,
            [announcementId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found."
            });
        }

        const allowedStatuses = ["Published", "Unpublished"];

        const status = allowedStatuses.includes(publication_status)
            ? publication_status
            : existing[0].publication_status;

        let publishedAt = existing[0].published_at;

        if (status === "Unpublished") {
            publishedAt = null;
        } else if (!publishedAt || existing[0].publication_status !== "Published") {
            publishedAt = new Date();
        }

        await pool.query(
            `UPDATE announcements
             SET
                headline = ?,
                category = ?,
                target_audience = ?,
                urgency = ?,
                feed_summary = ?,
                announcement_content = ?,
                publication_status = ?,
                published_at = ?
             WHERE announcement_id = ?`,
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
        const { announcementId } = req.params;
        const { publication_status, urgency } = req.body;

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

        const [existing] = await pool.query(
            `SELECT announcement_id, publication_status, urgency
             FROM announcements
             WHERE announcement_id = ?`,
            [announcementId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found."
            });
        }

        const current = existing[0];

        const nextStatus = allowedStatuses.includes(publication_status)
            ? publication_status
            : current.publication_status;

        const nextUrgency = allowedUrgencies.includes(urgency)
            ? urgency
            : current.urgency;

        let publishedAt = null;

        if (nextStatus === "Published") {
            publishedAt = current.publication_status === "Published"
                ? undefined
                : new Date();
        }

        if (publishedAt === undefined) {
            await pool.query(
                `UPDATE announcements
                 SET publication_status = ?, urgency = ?
                 WHERE announcement_id = ?`,
                [nextStatus, nextUrgency, announcementId]
            );
        } else {
            await pool.query(
                `UPDATE announcements
                 SET publication_status = ?, urgency = ?, published_at = ?
                 WHERE announcement_id = ?`,
                [nextStatus, nextUrgency, publishedAt, announcementId]
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
