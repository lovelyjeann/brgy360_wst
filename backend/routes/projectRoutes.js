
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAuthenticated, isAdmin } = require("../middleware/authMiddleware");

const ALLOWED_STATUSES = [
    "Planning",
    "Ongoing",
    "Completed",
    "Delayed"
];

function normalizeStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();

    return ALLOWED_STATUSES.find(
        allowed => allowed.toLowerCase() === normalized
    ) || null;
}

// ======================================================
// PUBLIC: GET PROJECTS FOR VISITORS
// ======================================================
router.get("/public", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                project_id,
                project_title,
                location_purok,
                allocated_budget,
                progress_percentage,
                project_scope,
                project_status,
                created_at,
                updated_at
             FROM projects
             ORDER BY created_at DESC, project_id DESC`
        );

        return res.status(200).json({
            success: true,
            projects: result.rows
        });
    } catch (error) {
        console.error("Get public projects error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving public projects."
        });
    }
});

// ======================================================
// GET ALL PROJECTS
// ======================================================
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
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
            projects: result.rows
        });
    } catch (error) {
        console.error("Get projects error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving projects."
        });
    }
});

// ======================================================
// ADMIN: CREATE PROJECT
// ======================================================
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

        const normalizedInitialStatus = normalizeStatus(initial_status);
        const normalizedProjectStatus = normalizeStatus(project_status);

        if (!normalizedInitialStatus || !normalizedProjectStatus) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status."
            });
        }

        const result = await pool.query(
            `INSERT INTO projects (
                project_title,
                location_purok,
                allocated_budget,
                initial_status,
                progress_percentage,
                project_scope,
                target_beneficiaries,
                project_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                String(project_title).trim(),
                String(location_purok).trim(),
                budget,
                normalizedInitialStatus,
                progress,
                String(project_scope).trim(),
                String(target_beneficiaries).trim(),
                normalizedProjectStatus
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project: result.rows[0]
        });

    } catch (error) {
        console.error("Create project error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while creating project."
        });
    }
});

// ======================================================
// ADMIN: UPDATE PROJECT PROGRESS AND STATUS
// ======================================================
router.put("/:id", isAdmin, async (req, res) => {
    try {
        const projectId = Number(req.params.id);

        const {
            progress_percentage,
            project_status
        } = req.body;

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID."
            });
        }

        if (
            progress_percentage === undefined ||
            project_status === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Progress percentage and project status are required."
            });
        }

        const progress = Number(progress_percentage);
        const normalizedStatus = normalizeStatus(project_status);

        if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
            return res.status(400).json({
                success: false,
                message: "Progress must be between 0 and 100."
            });
        }

        if (!normalizedStatus) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status."
            });
        }

        const result = await pool.query(
            `UPDATE projects
             SET
                progress_percentage = $1,
                project_status = $2,
                updated_at = CURRENT_TIMESTAMP
             WHERE project_id = $3
             RETURNING
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
                updated_at`,
            [
                progress,
                normalizedStatus,
                projectId
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project status and progress updated successfully.",
            project: result.rows[0]
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