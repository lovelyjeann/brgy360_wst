
const pool = require("../database/db");
const crypto = require("crypto");
const sendSetupEmail = require("../utils/sendSetupEmail");
const sendApprovalEmail = require("../utils/sendApprovalEmail");
const sendRejectionEmail = require("../utils/sendRejectionEmail");

// ==========================================
// 1. GET RESIDENTS PENDING VERIFICATION
// ==========================================
const getPendingResidents = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                user_id,
                full_legal_name,
                gender,
                civil_status,
                date_of_birth,
                mobile_number,
                email,
                address,
                sitio_purok,
                id_type,
                id_card_number,
                id_file_path,
                residency_proof_type,
                residency_proof_path,
                verification_status
             FROM users
             WHERE verification_status = $1
             ORDER BY user_id DESC`,
            ["Pending"]
        );

        const residents = result.rows;

        return res.status(200).json({
            success: true,
            count: residents.length,
            residents
        });

    } catch (error) {
        console.error("Get pending residents error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving pending residents."
        });
    }
};


// ==========================================
// 2. GET ALL RESIDENTS FOR ADMIN VERIFICATION
// ==========================================
const getAllResidents = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                user_id,
                full_legal_name,
                gender,
                civil_status,
                date_of_birth,
                mobile_number,
                email,
                address,
                sitio_purok,
                id_type,
                id_card_number,
                id_file_path,
                residency_proof_type,
                residency_proof_path,
                CASE
                    WHEN password_hash IS NOT NULL
                         AND password_hash <> ''
                    THEN TRUE
                    ELSE FALSE
                END AS has_password,
                verification_status,
                verification_notes,
                reviewed_at
             FROM users
             ORDER BY user_id DESC`
        );

        const residents = result.rows;

        return res.status(200).json({
            success: true,
            count: residents.length,
            residents
        });

    } catch (error) {
        console.error("Get all residents error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving residents."
        });
    }
};


// ==========================================
// 3. GET RESIDENT COUNTS GROUPED BY SITIO/PUROK
// ==========================================
const getGeographicBreakdown = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sitio_purok,
                COUNT(*) AS registered_residents,
                COUNT(*) FILTER (
                    WHERE verification_status = 'Verified'
                ) AS verified_residents,
                COUNT(*) FILTER (
                    WHERE verification_status = 'Pending'
                ) AS pending_verification
            FROM users
            WHERE verification_status IN ('Verified', 'Pending')
            GROUP BY sitio_purok
            ORDER BY sitio_purok ASC
        `);

        const rows = result.rows;

        const totalRegistered = rows.reduce(
            (total, row) => total + Number(row.registered_residents),
            0
        );

        const totalVerified = rows.reduce(
            (total, row) => total + Number(row.verified_residents),
            0
        );

        const totalPending = rows.reduce(
            (total, row) => total + Number(row.pending_verification),
            0
        );

        const geographicBreakdown = rows.map((row) => {
            const registered = Number(row.registered_residents);
            const verified = Number(row.verified_residents);
            const pending = Number(row.pending_verification);

            return {
                sitio_purok: row.sitio_purok,
                registered_residents: registered,
                verified_residents: verified,
                pending_verification: pending,
                verification_percentage: registered > 0
                    ? Number(((verified / registered) * 100).toFixed(1))
                    : 0
            };
        });

        return res.status(200).json({
            success: true,
            totals: {
                registered_residents: totalRegistered,
                verified_residents: totalVerified,
                pending_verification: totalPending
            },
            geographic_breakdown: geographicBreakdown
        });

    } catch (error) {
        console.error("Get geographic breakdown error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve geographic breakdown."
        });
    }
};


// ==========================================
// 4. APPROVE OR REJECT A RESIDENT
// ==========================================
const updateResidentVerification = async (req, res) => {
    try {
        const { userId } = req.params;
        const { verification_status, verification_notes } = req.body;

        if (!["Verified", "Rejected"].includes(verification_status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be Verified or Rejected."
            });
        }

        // A rejection must include a reason.
        if (
            verification_status === "Rejected" &&
            (
                typeof verification_notes !== "string" ||
                !verification_notes.trim()
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a reason for rejecting this resident."
            });
        }

        // Find the pending resident.
        const residentResult = await pool.query(
            `SELECT
                user_id,
                full_legal_name,
                email
             FROM users
             WHERE user_id = $1
               AND verification_status = 'Pending'`,
            [userId]
        );

        if (residentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Pending resident not found."
            });
        }

        const resident = residentResult.rows[0];

        // Save the admin's decision.
        const updateResult = await pool.query(
            `UPDATE users
             SET verification_status = $1,
                 verification_notes = $2,
                 reviewed_at = NOW()
             WHERE user_id = $3`,
            [
                verification_status,
                verification_status === "Rejected"
                    ? verification_notes.trim()
                    : null,
                userId
            ]
        );

        if (updateResult.rowCount !== 1) {
            return res.status(404).json({
                success: false,
                message: "Resident verification could not be updated."
            });
        }

        // Create a notification for the resident's verification decision.
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
                    resident.user_id,
                    verification_status === "Verified"
                        ? "account_verified"
                        : "account_rejected",
                    verification_status === "Verified"
                        ? "Account Registration Approved"
                        : "Account Registration Rejected",
                    verification_status === "Verified"
                        ? "Your Barangay Pallocan West resident registration has been approved. You may now proceed with your account setup."
                        : `Your resident registration was rejected. Reason: ${verification_notes.trim()}`,
                    "profile",
                    String(resident.user_id)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create account verification notification:",
                notificationError
            );
        }

        // Send the approval email.
        if (verification_status === "Verified") {
            await sendApprovalEmail(
                resident.email,
                resident.full_legal_name
            );
        }

        // Send the rejection email.
        if (verification_status === "Rejected") {
            await sendRejectionEmail(
                resident.email,
                resident.full_legal_name,
                verification_notes.trim()
            );
        }

        return res.status(200).json({
            success: true,
            message: `Resident ${verification_status.toLowerCase()} successfully.`
        });

    } catch (error) {
        console.error("Update resident verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while updating verification."
        });
    }
};


// ==========================================
// 5. ADMIN PRE-REGISTERS A RESIDENT
// ==========================================
const createPreRegisteredResident = async (req, res) => {
    try {
        const {
            full_legal_name,
            gender,
            civil_status,
            date_of_birth,
            mobile_number,
            email,
            address,
            sitio_purok,
            id_type,
            id_card_number,
            residency_proof_type
        } = req.body;

        const requiredFields = {
            full_legal_name,
            gender,
            civil_status,
            date_of_birth,
            mobile_number,
            email,
            address,
            sitio_purok
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([key, value]) =>
                typeof value !== "string" || !value.trim()
            )
            .map(([key]) => key);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required resident information.",
                missingFields
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const existingUserResult = await pool.query(
            "SELECT user_id FROM users WHERE email = $1 LIMIT 1",
            [normalizedEmail]
        );

        if (existingUserResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        const insertResult = await pool.query(
            `INSERT INTO users (
                full_legal_name,
                gender,
                civil_status,
                date_of_birth,
                mobile_number,
                email,
                address,
                sitio_purok,
                id_type,
                id_card_number,
                id_file_path,
                residency_proof_type,
                residency_proof_path,
                password_hash,
                verification_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, NULL, $11, NULL, NULL, 'Pending'
            )
            RETURNING user_id`,
            [
                full_legal_name.trim(),
                gender.trim(),
                civil_status.trim(),
                date_of_birth,
                mobile_number.trim(),
                normalizedEmail,
                address.trim(),
                sitio_purok.trim(),
                typeof id_type === "string" ? id_type.trim() || null : null,
                typeof id_card_number === "string" ? id_card_number.trim() || null : null,
                typeof residency_proof_type === "string"
                    ? residency_proof_type.trim() || null
                    : null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Resident successfully pre-registered.",
            user_id: insertResult.rows[0].user_id
        });

    } catch (error) {
        console.error("Pre-registration error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "This email address is already registered."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to pre-register resident."
        });
    }
};


// ==========================================
// 6. SEND ACCOUNT SETUP EMAIL
// ==========================================
const sendResidentSetupEmail = async (req, res) => {
    const userId = req.params.userId;

    try {
        // Find the resident.
        const residentResult = await pool.query(
            `SELECT
                user_id,
                full_legal_name,
                email,
                verification_status,
                password_hash
             FROM users
             WHERE user_id = $1
             LIMIT 1`,
            [userId]
        );

        if (residentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Resident not found."
            });
        }

        const resident = residentResult.rows[0];

        // Only approved residents can receive a setup link.
        if (resident.verification_status !== "Verified") {
            return res.status(400).json({
                success: false,
                message: "Only approved residents can receive an account setup email."
            });
        }

        // Do not send another setup link if a password already exists.
        if (resident.password_hash) {
            return res.status(400).json({
                success: false,
                message: "This resident has already set up their password."
            });
        }

        // Check frontend URL configuration.
        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            return res.status(500).json({
                success: false,
                message: "FRONTEND_URL is not configured in the backend environment."
            });
        }

        // Generate a secure random token.
        const setupToken = crypto.randomBytes(32).toString("hex");

        // Store only the SHA-256 hash of the token.
        const setupTokenHash = crypto
            .createHash("sha256")
            .update(setupToken)
            .digest("hex");

        // Token expires after 24 hours.
        await pool.query(
            `UPDATE users
             SET setup_token_hash = $1,
                 setup_token_expires_at = NOW() + INTERVAL '24 hours'
             WHERE user_id = $2`,
            [setupTokenHash, userId]
        );

        // Build the account setup link.
        const setupLink =
            `${frontendUrl.replace(/\/$/, "")}/setup-account.html?token=${setupToken}`;

        // Send the email.
        try {
            await sendSetupEmail(
                resident.email,
                resident.full_legal_name,
                setupLink
            );
        } catch (emailError) {
            // Invalidate the token if the email could not be sent.
            await pool.query(
                `UPDATE users
                 SET setup_token_hash = NULL,
                     setup_token_expires_at = NULL
                 WHERE user_id = $1`,
                [userId]
            );

            throw emailError;
        }

        return res.status(200).json({
            success: true,
            message: "Account setup email sent successfully."
        });

    } catch (error) {
        console.error("Send resident setup email error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to send the account setup email. Please try again."
        });
    }
};


// ==========================================
// EXPORT CONTROLLER FUNCTIONS
// ==========================================
module.exports = {
    getPendingResidents,
    getAllResidents,
    updateResidentVerification,
    createPreRegisteredResident,
    sendResidentSetupEmail,
    getGeographicBreakdown
};
