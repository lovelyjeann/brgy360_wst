
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");

// Public: Get projects for visitors without an account
router.get("/public", async (req, res) => {
    try {
        const [projects] = await pool.query(
            `SELECT
                project_id,
                project_title,
                location_purok,
                allocated_budget,
                progress_percentage,
                project_scope,
                project_status,
                created_at
             FROM projects
             ORDER BY created_at DESC, project_id DESC`
        );

        return res.status(200).json({
            success: true,
            projects
        });

    } catch (error) {
        console.error("Get public projects error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving public projects."
        });
    }
});

// Get all projects
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const [projects] = await pool.query(
            `SELECT
                project_id,
                project_title,
                location_purok,
                allocated_budget,
                initial_status,
                progress_percentage,
                project_scope,
                target_beneficiaries,
                project_status,
                created_at,
                updated_at
             FROM projects
             ORDER BY created_at DESC, project_id DESC`
        );

        return res.status(200).json({
            success: true,
            projects
        });

    } catch (error) {
        console.error("Get projects error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving projects."
        });
    }
});


// Admin creates a new project
router.post("/", isAdmin, async (req, res) => {
    try {
        const {
            project_title,
            location_purok,
            allocated_budget,
            initial_status,
            progress_percentage,
            project_scope,
            target_beneficiaries,
            project_status
        } = req.body;

        // Validate required fields
        if (
            !project_title ||
            !location_purok ||
            allocated_budget === undefined ||
            !initial_status ||
            progress_percentage === undefined ||
            !project_scope ||
            !target_beneficiaries ||
            !project_status
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required project fields."
            });
        }

        const budget = Number(allocated_budget);
        const progress = Number(progress_percentage);

        if (!Number.isFinite(budget) || budget <= 0) {
            return res.status(400).json({
                success: false,
                message: "Allocated budget must be greater than zero."
            });
        }

        if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
            return res.status(400).json({
                success: false,
                message: "Progress must be between 0 and 100."
            });
        }

        const allowedStatuses = [
            "planning",
            "ongoing",
            "completed",
            "delayed"
        ];

        const normalizedInitialStatus = String(initial_status).trim().toLowerCase();
        const normalizedProjectStatus = String(project_status).trim().toLowerCase();

        if (
            !allowedStatuses.includes(normalizedInitialStatus) ||
            !allowedStatuses.includes(normalizedProjectStatus)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status."
            });
        }

        const formatStatus = status =>
            status.charAt(0).toUpperCase() + status.slice(1);

        const [result] = await pool.query(
            `INSERT INTO projects (
                project_title,
                location_purok,
                allocated_budget,
                initial_status,
                progress_percentage,
                project_scope,
                target_beneficiaries,
                project_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(project_title).trim(),
                String(location_purok).trim(),
                budget,
                formatStatus(normalizedInitialStatus),
                progress,
                String(project_scope).trim(),
                String(target_beneficiaries).trim(),
                formatStatus(normalizedProjectStatus)
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project_id: result.insertId
        });

    } catch (error) {
        console.error("Create project error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while creating project."
        });
    }
});

// Admin updates project progress and status
router.put("/:id", isAdmin, async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        const { progress_percentage, project_status } = req.body;

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID."
            });
        }

        const progress = Number(progress_percentage);

        if (
            progress_percentage === undefined ||
            !Number.isFinite(progress) ||
            progress < 0 ||
            progress > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Progress must be between 0 and 100."
            });
        }

        const allowedStatuses = [
            "planning",
            "ongoing",
            "completed",
            "delayed"
        ];

        const normalizedStatus = String(project_status || "").trim().toLowerCase();

        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status."
            });
        }

        const formatStatus = status =>
            status.charAt(0).toUpperCase() + status.slice(1);

        const [result] = await pool.query(
            `UPDATE projects
             SET progress_percentage = ?,
                 project_status = ?
             WHERE project_id = ?`,
            [
                progress,
                formatStatus(normalizedStatus),
                projectId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project updated successfully."
        });

    } catch (error) {
        console.error("Update project error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating project."
        });
    }
});


module.exports = router;
