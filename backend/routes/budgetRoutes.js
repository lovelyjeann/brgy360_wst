
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAdmin } = require("../middleware/authMiddleware");

// ======================================================
// GET ALL BUDGET RECORDS (PUBLIC AND ADMIN)
// ======================================================
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                budget_id,
                fiscal_year,
                quarter,
                budget_category,
                allocated_budget,
                actual_spending,
                remaining_budget,
                utilization_rate,
                record_status,
                budget_description,
                remarks,
                created_at,
                updated_at
             FROM budget_records
             ORDER BY fiscal_year DESC, budget_id DESC`
        );

        return res.status(200).json({
            success: true,
            records: result.rows
        });

    } catch (error) {
        console.error("Fetch budget records error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch budget records."
        });
    }
});


// ======================================================
// ADD BUDGET RECORD (ADMIN ONLY)
// ======================================================
router.post("/", isAdmin, async (req, res) => {
    try {
        const {
            fiscal_year,
            quarter,
            budget_category,
            allocated_budget,
            actual_spending,
            record_status,
            budget_description,
            remarks
        } = req.body;

        if (
            !fiscal_year ||
            !quarter ||
            !budget_category ||
            allocated_budget === undefined ||
            !budget_description
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required budget fields."
            });
        }

        const result = await pool.query(
            `INSERT INTO budget_records (
                fiscal_year,
                quarter,
                budget_category,
                allocated_budget,
                actual_spending,
                record_status,
                budget_description,
                remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                fiscal_year,
                quarter,
                budget_category,
                allocated_budget,
                actual_spending ?? 0,
                record_status || "Planned",
                budget_description,
                remarks || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Budget record added successfully.",
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Add budget record error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add budget record."
        });
    }
});


// ======================================================
// UPDATE BUDGET RECORD (ADMIN ONLY)
// ======================================================
router.put("/:budgetId", isAdmin, async (req, res) => {
    try {
        const budgetId = Number(req.params.budgetId);

        if (!Number.isInteger(budgetId) || budgetId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid budget record ID."
            });
        }

        const {
            fiscal_year,
            quarter,
            budget_category,
            allocated_budget,
            actual_spending,
            record_status,
            budget_description,
            remarks
        } = req.body;

        if (
            !fiscal_year ||
            !quarter ||
            !budget_category ||
            allocated_budget === undefined ||
            !budget_description
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required budget fields."
            });
        }

        const result = await pool.query(
            `UPDATE budget_records
             SET
                fiscal_year = $1,
                quarter = $2,
                budget_category = $3,
                allocated_budget = $4,
                actual_spending = $5,
                record_status = $6,
                budget_description = $7,
                remarks = $8
             WHERE budget_id = $9
             RETURNING *`,
            [
                fiscal_year,
                quarter,
                budget_category,
                allocated_budget,
                actual_spending ?? 0,
                record_status || "Planned",
                budget_description,
                remarks || null,
                budgetId
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Budget record not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Budget record updated successfully.",
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Update budget record error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update budget record."
        });
    }
});


// ======================================================
// DELETE BUDGET RECORD (ADMIN ONLY)
// ======================================================
router.delete("/:budgetId", isAdmin, async (req, res) => {
    try {
        const budgetId = Number(req.params.budgetId);

        if (!Number.isInteger(budgetId) || budgetId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid budget record ID."
            });
        }

        const result = await pool.query(
            `DELETE FROM budget_records
             WHERE budget_id = $1`,
            [budgetId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Budget record not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Budget record deleted successfully."
        });

    } catch (error) {
        console.error("Delete budget record error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete budget record."
        });
    }
});


module.exports = router;
