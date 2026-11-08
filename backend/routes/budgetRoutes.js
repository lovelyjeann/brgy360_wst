const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const { isAdmin } = require("../middleware/authMiddleware");

// GET all budget records (public and admin)
router.get("/", async (req, res) => {
    try {
        const [records] = await pool.query(`
            SELECT
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
            ORDER BY fiscal_year DESC, budget_id DESC
        `);

        res.json({
            success: true,
            records
        });
    } catch (error) {
        console.error("Fetch budget records error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch budget records."
        });
    }
});

// ADD budget record (admin only)
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

        const [result] = await pool.query(
            `INSERT INTO budget_records (
                fiscal_year,
                quarter,
                budget_category,
                allocated_budget,
                actual_spending,
                record_status,
                budget_description,
                remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

        const [records] = await pool.query(
            "SELECT * FROM budget_records WHERE budget_id = ?",
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Budget record added successfully.",
            record: records[0]
        });
    } catch (error) {
        console.error("Add budget record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add budget record."
        });
    }
});

// UPDATE budget record (admin only)
router.put("/:budgetId", isAdmin, async (req, res) => {
    try {
        const { budgetId } = req.params;

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

        const [result] = await pool.query(
            `UPDATE budget_records
             SET
                fiscal_year = ?,
                quarter = ?,
                budget_category = ?,
                allocated_budget = ?,
                actual_spending = ?,
                record_status = ?,
                budget_description = ?,
                remarks = ?
             WHERE budget_id = ?`,
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

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Budget record not found."
            });
        }

        const [records] = await pool.query(
            "SELECT * FROM budget_records WHERE budget_id = ?",
            [budgetId]
        );

        res.json({
            success: true,
            message: "Budget record updated successfully.",
            record: records[0]
        });
    } catch (error) {
        console.error("Update budget record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update budget record."
        });
    }
});

// DELETE budget record (admin only)
router.delete("/:budgetId", isAdmin, async (req, res) => {
    try {
        const { budgetId } = req.params;

        const [result] = await pool.query(
            "DELETE FROM budget_records WHERE budget_id = ?",
            [budgetId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Budget record not found."
            });
        }

        res.json({
            success: true,
            message: "Budget record deleted successfully."
        });
    } catch (error) {
        console.error("Delete budget record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete budget record."
        });
    }
});

module.exports = router;
