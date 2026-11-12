
const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs/promises");

// ==========================================
// HELPER: REMOVE UPLOADED FILES
// ==========================================
async function removeUploadedFiles(req) {
    try {
        const uploadedFiles = Object.values(req.files || {}).flat();

        await Promise.all(
            uploadedFiles.map(async (file) => {
                if (file && file.path) {
                    try {
                        await fs.unlink(file.path);
                    } catch (error) {
                        if (error.code !== "ENOENT") {
                            console.error("File cleanup error:", error.message);
                        }
                    }
                }
            })
        );
    } catch (error) {
        console.error("Upload cleanup error:", error.message);
    }
}

// ==========================================
// HELPER: VALIDATE EMAIL
// ==========================================
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==========================================
// HELPER: CREATE LOGIN SESSION
// ==========================================
function createLoginSession(req, res, user, successMessage) {
    if (!req.session) {
        return res.status(500).json({
            success: false,
            message: "Login session is unavailable."
        });
    }

    req.session.regenerate((error) => {
        if (error) {
            console.error("Session regeneration error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not create login session."
            });
        }

        req.session.user = user;

        req.session.save((saveError) => {
            if (saveError) {
                console.error("Session save error:", saveError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not save login session."
                });
            }

            return res.status(200).json({
                success: true,
                message: successMessage,
                user: req.session.user
            });
        });
    });
}

// ==========================================
// 1. RESIDENT REGISTRATION
// ==========================================
const registerResident = async (req, res) => {
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
            password,
            id_type,
            residency_proof_type
        } = req.body || {};

        const requiredFields = [
            full_legal_name,
            gender,
            civil_status,
            date_of_birth,
            mobile_number,
            email,
            address,
            sitio_purok,
            password
        ];

        if (
            requiredFields.some(
                (value) =>
                    typeof value !== "string" || !value.trim()
            )
        ) {
            await removeUploadedFiles(req);

            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!isValidEmail(normalizedEmail)) {
            await removeUploadedFiles(req);

            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (password.length < 8) {
            await removeUploadedFiles(req);

            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (
            !req.files ||
            !req.files.id_document ||
            !req.files.id_document[0]
        ) {
            await removeUploadedFiles(req);

            return res.status(400).json({
                success: false,
                message: "Please upload a valid ID document."
            });
        }

        const idFile = req.files.id_document[0];

        const id_file_path = `/uploads/${idFile.filename}`;

        const residencyFile =
            req.files.residency_proof_document &&
            req.files.residency_proof_document[0]
                ? req.files.residency_proof_document[0]
                : null;

        const residency_proof_path = residencyFile
            ? `/uploads/${residencyFile.filename}`
            : null;

        const proofType =
            typeof residency_proof_type === "string" &&
            residency_proof_type.trim()
                ? residency_proof_type.trim()
                : "No Proof of Residency";

        const existingUserResult = await pool.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(BTRIM(email)) = $1
             LIMIT 1`,
            [normalizedEmail]
        );

        if (existingUserResult.rows.length > 0) {
            await removeUploadedFiles(req);

            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

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
                id_file_path,
                residency_proof_type,
                residency_proof_path,
                password_hash,
                verification_status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, 'Pending'
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
                id_type ? id_type.trim() : null,
                id_file_path,
                proofType,
                residency_proof_path,
                passwordHash
            ]
        );

        const newUserId = insertResult.rows[0].user_id;

        // Notify administrators about the new registration.
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
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    "admin",
                    null,
                    "new_registration",
                    "New Resident Registration",
                    `${full_legal_name.trim()} has submitted a resident registration and is awaiting verification.`,
                    "residents",
                    String(newUserId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Registration notification error:",
                notificationError.message
            );
        }

        return res.status(201).json({
            success: true,
            message:
                "Registration submitted successfully. Your account is pending verification."
        });

    } catch (error) {
        await removeUploadedFiles(req);

        console.error("Registration error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error during registration."
        });
    }
};

// ==========================================
// 2. RESIDENT LOGIN
// ==========================================
const loginResident = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const userResult = await pool.query(
            `SELECT
                user_id,
                full_legal_name,
                email,
                password_hash,
                verification_status
             FROM users
             WHERE LOWER(BTRIM(email)) = $1
             LIMIT 1`,
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = userResult.rows[0];

        if (user.verification_status !== "Verified") {
            return res.status(403).json({
                success: false,
                message: "Your account is pending verification."
            });
        }

        if (!user.password_hash) {
            return res.status(403).json({
                success: false,
                message:
                    "Please complete your account setup using the link sent to your email."
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        return createLoginSession(
            req,
            res,
            {
                id: user.user_id,
                email: user.email,
                role: "resident",
                full_legal_name: user.full_legal_name
            },
            "Login successful."
        );

    } catch (error) {
        console.error("Resident login error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during login."
        });
    }
};

// ==========================================
// 3. SET UP RESIDENT PASSWORD
// ==========================================
const setupResidentPassword = async (req, res) => {
    try {
        const {
            token,
            password,
            confirmPassword
        } = req.body || {};

        if (
            typeof token !== "string" ||
            typeof password !== "string" ||
            typeof confirmPassword !== "string" ||
            !token.trim() ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token.trim())
            .digest("hex");

        // Check whether the setup token is valid.
        const residentResult = await pool.query(
            `SELECT user_id
             FROM users
             WHERE setup_token_hash = $1
               AND setup_token_expires_at > NOW()
               AND verification_status = 'Verified'
               AND password_hash IS NULL
             LIMIT 1`,
            [tokenHash]
        );

        if (residentResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "This setup link is invalid, expired, or has already been used. Please contact your barangay administrator."
            });
        }

        const userId = residentResult.rows[0].user_id;
        const passwordHash = await bcrypt.hash(password, 10);

        // Conditional update ensures the token cannot be reused.
        const updateResult = await pool.query(
            `UPDATE users
             SET password_hash = $1,
                 password_set_at = NOW(),
                 setup_token_hash = NULL,
                 setup_token_expires_at = NULL
             WHERE user_id = $2
               AND setup_token_hash = $3
               AND setup_token_expires_at > NOW()
               AND verification_status = 'Verified'
               AND password_hash IS NULL
             RETURNING user_id`,
            [passwordHash, userId, tokenHash]
        );

        if (updateResult.rowCount !== 1) {
            return res.status(400).json({
                success: false,
                message:
                    "This setup link is invalid, expired, or has already been used."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Your password has been created successfully. You can now log in to Brgy360."
        });

    } catch (error) {
        console.error("Resident password setup error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while setting up your password."
        });
    }
};

// ==========================================
// 4. GET CURRENT LOGGED-IN USER
// ==========================================
const getCurrentUser = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "You are not logged in."
            });
        }

        return res.status(200).json({
            success: true,
            user: req.session.user
        });

    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

// ==========================================
// 5. ADMIN LOGIN
// ==========================================
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const adminResult = await pool.query(
            `SELECT
                admin_id,
                email,
                password_hash
             FROM admins
             WHERE LOWER(BTRIM(email)) = $1
             LIMIT 1`,
            [normalizedEmail]
        );

        if (adminResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const admin = adminResult.rows[0];

        if (
            typeof admin.password_hash !== "string" ||
            !admin.password_hash.trim()
        ) {
            console.error("Admin account has no usable password hash.");

            return res.status(500).json({
                success: false,
                message: "Administrator account password is not configured."
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        return createLoginSession(
            req,
            res,
            {
                id: admin.admin_id,
                email: admin.email,
                role: "admin"
            },
            "Admin login successful."
        );

    } catch (error) {
        console.error("Admin login error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error during admin login."
        });
    }
};

// ==========================================
// 6. CHECK RESIDENT EMAIL AVAILABILITY
// ==========================================
const checkResidentEmail = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter an email address."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const existingUserResult = await pool.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(BTRIM(email)) = $1
             LIMIT 1`,
            [normalizedEmail]
        );

        const available = existingUserResult.rows.length === 0;

        return res.status(200).json({
            success: true,
            available,
            message: available
                ? "Email is available."
                : "An account with this email already exists."
        });

    } catch (error) {
        console.error("Email availability check error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check email availability."
        });
    }
};

// ==========================================
// EXPORT CONTROLLER FUNCTIONS
// ==========================================
module.exports = {
    registerResident,
    loginResident,
    setupResidentPassword,
    getCurrentUser,
    loginAdmin,
    checkResidentEmail
};