
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const upload = require("../middleware/uploadMiddleware");
const { isResident, isAdmin } = require("../middleware/authMiddleware");

const {
    sendProposalApprovalEmail,
    sendProposalRejectionEmail
} = require("../utils/sendProposalEmail");

// ======================================================
// NORMALIZE PHILIPPINE MOBILE NUMBERS
// ======================================================
function normalizePhoneNumber(phone) {
    if (!phone) return "";

    let normalized = String(phone).trim().replace(/[\s()-]/g, "");

    if (normalized.startsWith("+63")) {
        normalized = "0" + normalized.slice(3);
    } else if (normalized.startsWith("63")) {
        normalized = "0" + normalized.slice(2);
    } else if (/^9\d{9}$/.test(normalized)) {
        normalized = "0" + normalized;
    }

    return normalized;
}


// ======================================================
// RESIDENT: RETRIEVE THEIR OWN PROPOSALS
// ======================================================
router.get("/mine", isResident, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const result = await pool.query(
            `SELECT
                p.proposal_id,
                p.user_id,
                p.project_title,
                p.sector_category,
                p.location_sitio,
                p.estimated_budget,
                p.proposed_target_timeline,
                p.rationale_community_impact,
                p.guest_full_name,
                p.guest_email,
                p.supporting_documents_path,
                p.fiscal_year,
                p.proposal_status,
                p.council_review_notes,
                p.submitted_at,
                p.reviewed_at,
                u.full_legal_name AS resident_full_name,
                u.email AS resident_email
             FROM project_proposals p
             LEFT JOIN users u
                ON p.user_id = u.user_id
             WHERE p.user_id = $1
             ORDER BY p.submitted_at DESC, p.proposal_id DESC`,
            [userId]
        );

        const formattedProposals = result.rows.map(proposal => ({
            ...proposal,
            tracking_code: `PROP-${proposal.fiscal_year}-${String(proposal.proposal_id).padStart(4, "0")}`,
            proponent:
                proposal.resident_full_name ||
                proposal.guest_full_name ||
                "Community Resident",
            email: proposal.resident_email || proposal.guest_email || ""
        }));

        return res.status(200).json({
            success: true,
            proposals: formattedProposals
        });

    } catch (error) {
        console.error("Fetch resident proposals error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load your proposals."
        });
    }
});


// ======================================================
// ADMIN: RETRIEVE ALL PROPOSALS
// ======================================================
router.get("/admin/all", isAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                p.proposal_id,
                p.user_id,
                p.project_title,
                p.sector_category,
                p.location_sitio,
                p.estimated_budget,
                p.proposed_target_timeline,
                p.rationale_community_impact,
                p.guest_full_name,
                p.guest_phone,
                p.guest_email,
                p.supporting_documents_path,
                p.fiscal_year,
                p.proposal_status,
                p.council_review_notes,
                p.submitted_at,
                p.reviewed_at,
                u.full_legal_name AS resident_full_name,
                u.email AS resident_email
             FROM project_proposals p
             LEFT JOIN users u
                ON p.user_id = u.user_id
             ORDER BY p.submitted_at DESC, p.proposal_id DESC`
        );

        const formattedProposals = result.rows.map(proposal => ({
            ...proposal,
            tracking_code: `PROP-${proposal.fiscal_year}-${String(proposal.proposal_id).padStart(4, "0")}`,
            proponent:
                proposal.guest_full_name ||
                proposal.resident_full_name ||
                "Community Resident",
            email: proposal.guest_email || proposal.resident_email || ""
        }));

        return res.status(200).json({
            success: true,
            proposals: formattedProposals
        });

    } catch (error) {
        console.error("Fetch admin proposals error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load proposals from the database."
        });
    }
});


// ======================================================
// ADMIN: UPDATE A PROPOSAL'S STATUS
// ======================================================
router.put(
    "/admin/:proposalId/status",
    isAdmin,
    async (req, res) => {
        try {
            const proposalId = Number(req.params.proposalId);
            const { status, councilReviewNotes } = req.body;

            // Validate proposal ID.
            if (!Number.isInteger(proposalId) || proposalId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid proposal ID."
                });
            }

            // Validate proposal status.
            const allowedStatuses = [
                "Pending",
                "Under Review",
                "Approved",
                "Rejected"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid proposal status."
                });
            }

            // Council notes are required only for rejection.
            const notes = String(councilReviewNotes || "").trim();

            if (status === "Rejected" && !notes) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide the Barangay Council Review Notes & Disposition before rejecting this proposal."
                });
            }

            // Retrieve proposal and submitter information.
            const proposalResult = await pool.query(
                `SELECT
                    p.proposal_id,
                    p.user_id,
                    p.project_title,
                    p.proposal_status,
                    p.guest_full_name,
                    p.guest_email,
                    u.full_legal_name AS resident_full_name,
                    u.email AS resident_email
                 FROM project_proposals p
                 LEFT JOIN users u
                    ON p.user_id = u.user_id
                 WHERE p.proposal_id = $1`,
                [proposalId]
            );

            if (proposalResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Proposal not found."
                });
            }

            const proposal = proposalResult.rows[0];
            const previousStatus = proposal.proposal_status;

            // Identify the recipient.
            const recipientEmail =
                proposal.guest_email || proposal.resident_email || "";

            const recipientName =
                proposal.guest_full_name ||
                proposal.resident_full_name ||
                "Community Resident";

            // Update proposal in PostgreSQL.
            await pool.query(
                `UPDATE project_proposals
                 SET
                    proposal_status = $1,
                    council_review_notes = CASE
                        WHEN $2 = 'Rejected' THEN $3
                        WHEN $4 = 'Approved' THEN NULL
                        ELSE council_review_notes
                    END,
                    reviewed_at = CASE
                        WHEN $5 = 'Pending' THEN NULL
                        ELSE NOW()
                    END
                 WHERE proposal_id = $6`,
                [
                    status,
                    status,
                    status === "Rejected" ? notes : null,
                    status,
                    status,
                    proposalId
                ]
            );

            // Notify the resident when their proposal is approved or rejected.
            const shouldNotifyResident =
                proposal.user_id &&
                previousStatus !== status &&
                (status === "Approved" || status === "Rejected");

            if (shouldNotifyResident) {
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
                            proposal.user_id,
                            status === "Approved"
                                ? "proposal_approved"
                                : "proposal_rejected",
                            status === "Approved"
                                ? "Project Proposal Approved"
                                : "Project Proposal Rejected",
                            status === "Approved"
                                ? `Your project proposal "${proposal.project_title}" has been approved by the Barangay Council.`
                                : `Your project proposal "${proposal.project_title}" has been rejected. Council notes: ${notes}`,
                            "proposals",
                            String(proposal.proposal_id)
                        ]
                    );
                } catch (notificationError) {
                    console.error(
                        "Failed to create resident proposal notification:",
                        notificationError
                    );
                }
            }

            // Send email only when entering Approved or Rejected.
            let emailSent = false;
            let emailError = null;

            const shouldSendEmail =
                previousStatus !== status &&
                (status === "Approved" || status === "Rejected");

            if (shouldSendEmail) {
                if (!recipientEmail) {
                    emailError =
                        "The submitter has no registered email address.";
                } else {
                    try {
                        if (status === "Approved") {
                            await sendProposalApprovalEmail(
                                recipientEmail,
                                recipientName,
                                proposal.project_title
                            );
                        } else {
                            await sendProposalRejectionEmail(
                                recipientEmail,
                                recipientName,
                                proposal.project_title,
                                notes
                            );
                        }

                        emailSent = true;

                    } catch (mailError) {
                        console.error(
                            "Proposal notification email error:",
                            mailError
                        );

                        emailError =
                            "Proposal status was updated, but the notification email could not be sent.";
                    }
                }
            }

            return res.status(200).json({
                success: true,
                message: `Proposal status updated to ${status}.`,
                emailSent,
                emailError
            });

        } catch (error) {
            console.error("Update proposal status error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to update proposal status."
            });
        }
    }
);

// ======================================================
// ADMIN: DELETE A PROJECT PROPOSAL
// ======================================================
router.delete("/admin/:proposalId", isAdmin, async (req, res) => {
    try {
        const proposalId = Number(req.params.proposalId);

        // Validate proposal ID.
        if (!Number.isInteger(proposalId) || proposalId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid proposal ID."
            });
        }

        // Delete the proposal from PostgreSQL.
        const result = await pool.query(
            `DELETE FROM project_proposals
             WHERE proposal_id = $1
             RETURNING proposal_id`,
            [proposalId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Proposal not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project proposal deleted successfully.",
            proposalId: result.rows[0].proposal_id
        });

    } catch (error) {
        console.error("Delete project proposal error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete the project proposal."
        });
    }
});

// ======================================================
// SUBMIT A PROJECT PROPOSAL (GUEST OR RESIDENT)
// ======================================================
router.post("/", upload.single("supportingDocument"), async (req, res) => {
    try {
        const {
            projectTitle,
            sectorCategory,
            locationSitio,
            estimatedBudget,
            proposedTimeline,
            rationale
        } = req.body;

        // Identify the form that submitted the proposal.
        const submissionType = String(req.body.submissionType || "")
            .trim()
            .toLowerCase();

        const isLoggedInResident = submissionType === "resident";
        const isGuestSubmission = submissionType === "guest";

        if (!isLoggedInResident && !isGuestSubmission) {
            return res.status(400).json({
                success: false,
                message: "Invalid proposal submission type."
            });
        }

        // Validate resident authentication.
        let residentAccount = null;

        if (isLoggedInResident) {
            if (req.session?.user?.role !== "resident") {
                return res.status(401).json({
                    success: false,
                    message: "Please log in using a resident account."
                });
            }

            const residentResult = await pool.query(
                `SELECT user_id
                 FROM users
                 WHERE user_id = $1`,
                [req.session.user.id]
            );

            residentAccount = residentResult.rows[0];

            if (!residentAccount) {
                return res.status(401).json({
                    success: false,
                    message: "Resident account not found. Please log in again."
                });
            }
        }

        // Validate required project details.
        if (
            !projectTitle?.trim() ||
            !sectorCategory?.trim() ||
            !locationSitio?.trim() ||
            !proposedTimeline?.trim() ||
            !rationale?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required project fields."
            });
        }

        // Resident: user_id only.
        // Guest: guest contact information only.
        let userId = null;
        let guestFullName = null;
        let guestPhone = null;
        let guestEmail = null;

        if (isLoggedInResident) {
            userId = residentAccount.user_id;

        } else {
            guestFullName = String(req.body.fullName || "").trim();
            guestEmail = String(req.body.email || "").trim();
            guestPhone = normalizePhoneNumber(req.body.phone);

            if (!guestFullName || !guestEmail || !guestPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Complete guest contact details are required."
                });
            }

            if (!/^[a-zA-Z\s.'-]+$/.test(guestFullName)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid full name."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address."
                });
            }

            if (!/^09\d{9}$/.test(guestPhone)) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid Philippine mobile number."
                });
            }
        }

        // Validate estimated budget.
        const budget = Number(estimatedBudget);

        if (!Number.isFinite(budget) || budget <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid estimated budget."
            });
        }

        // Validate proposal description.
        if (
            projectTitle.trim().length < 3 ||
            rationale.trim().length < 10
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a more descriptive proposal."
            });
        }

        const documentPath = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        const fiscalYear = new Date().getFullYear();

        // Insert proposal into PostgreSQL.
        const insertResult = await pool.query(
            `INSERT INTO project_proposals (
                user_id,
                project_title,
                sector_category,
                location_sitio,
                estimated_budget,
                proposed_target_timeline,
                rationale_community_impact,
                guest_full_name,
                guest_phone,
                guest_email,
                supporting_documents_path,
                fiscal_year,
                proposal_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13
            )
            RETURNING proposal_id`,
            [
                userId,
                projectTitle.trim(),
                sectorCategory.trim(),
                locationSitio.trim(),
                budget,
                proposedTimeline.trim(),
                rationale.trim(),
                guestFullName,
                guestPhone,
                guestEmail,
                documentPath,
                fiscalYear,
                "Pending"
            ]
        );

        const proposalId = insertResult.rows[0].proposal_id;

        // Determine the proposal submitter's name.
        let submitterName = guestFullName;

        if (isLoggedInResident) {
            const residentResult = await pool.query(
                `SELECT full_legal_name
                 FROM users
                 WHERE user_id = $1`,
                [userId]
            );

            submitterName =
                residentResult.rows[0]?.full_legal_name || "A resident";
        }

        // Create an admin notification for the new proposal.
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
                    "admin",
                    null,
                    "new_project_proposal",
                    "New Project Proposal",
                    `${submitterName} submitted a project proposal: ${projectTitle.trim()}.`,
                    "proposals",
                    String(proposalId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create proposal notification:",
                notificationError
            );
        }

        // Create a notification for the resident who submitted the proposal.
        if (isLoggedInResident && userId) {
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
                        "proposal_submitted",
                        "Project Proposal Submitted",
                        `Your project proposal "${projectTitle.trim()}" has been submitted successfully and is now Pending.`,
                        "proposals",
                        String(proposalId)
                    ]
                );
            } catch (notificationError) {
                console.error(
                    "Failed to create resident proposal notification:",
                    notificationError
                );
            }
        }

        return res.status(201).json({
            success: true,
            message: "Your project proposal was submitted successfully.",
            proposalId,
            trackingCode: `PROP-${fiscalYear}-${String(proposalId).padStart(4, "0")}`
        });

    } catch (error) {
        console.error("Submit project proposal error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to submit your proposal. Please try again."
        });
    }
});


module.exports = router;
