
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAdmin } = require("../middleware/authMiddleware");

// GET all Barangay Officials (Public)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                official_id AS id,
                name,
                position,
                term,
                status,
                role,
                contact,
                schedule,
                is_leader AS "isLeader",
                grid_class AS "gridClass",
                display_order AS "displayOrder"
            FROM barangay_officials
            ORDER BY display_order ASC, official_id ASC
        `);

        return res.status(200).json({
            success: true,
            officials: result.rows
        });

    } catch (error) {
        console.error("Error fetching Barangay Officials:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve Barangay Officials."
        });
    }
});


// UPDATE an existing Barangay Official (Admin only)
router.put("/:id", isAdmin, async (req, res) => {
    try {
        const officialId = Number(req.params.id);

        if (!Number.isInteger(officialId) || officialId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid official ID."
            });
        }

        const {
            name,
            position,
            term,
            status,
            role,
            contact,
            schedule,
            isLeader,
            gridClass,
            displayOrder
        } = req.body;

        if (!name || !position) {
            return res.status(400).json({
                success: false,
                message: "Official name and position are required."
            });
        }

        const result = await pool.query(`
            UPDATE barangay_officials
            SET
                name = $1,
                position = $2,
                term = $3,
                status = $4,
                role = $5,
                contact = $6,
                schedule = $7,
                is_leader = $8,
                grid_class = $9,
                display_order = $10,
                updated_at = CURRENT_TIMESTAMP
            WHERE official_id = $11
            RETURNING
                official_id AS id,
                name,
                position,
                term,
                status,
                role,
                contact,
                schedule,
                is_leader AS "isLeader",
                grid_class AS "gridClass",
                display_order AS "displayOrder"
        `, [
            name.trim(),
            position.trim(),
            term || null,
            status || "Active",
            role || null,
            contact || null,
            schedule || null,
            Boolean(isLeader),
            gridClass || null,
            Number.isInteger(Number(displayOrder))
                ? Number(displayOrder)
                : 0,
            officialId
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Barangay Official not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Barangay Official updated successfully.",
            official: result.rows[0]
        });

    } catch (error) {
        console.error("Error updating Barangay Official:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update Barangay Official."
        });
    }
});

module.exports = router;
