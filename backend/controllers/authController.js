const express = require("express");
const router = express.Router();

const pool = require("../database/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sendPasswordResetEmail = require("../utils/sendPasswordResetEmail");
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

function createLoginSession(
    req,
    res,
    user,
    successMessage,
    rememberMe = null
) {
    const SESSION_24_HOURS = 24 * 60 * 60 * 1000;
    const SESSION_30_DAYS = 30 * 24 * 60 * 60 * 1000;

    req.session.regenerate((error) => {
        if (error) {
            console.error("Session regeneration error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not create login session."
            });
        }

        // true = 30 days
        // false = browser-session cookie
        // null = existing 24-hour behavior (admin)
        if (rememberMe === true) {
            req.session.cookie.maxAge = SESSION_30_DAYS;
        } else if (rememberMe === false) {
            req.session.cookie.maxAge = null;
        } else {
            req.session.cookie.maxAge = SESSION_24_HOURS;
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

        // Check whether this email already belongs to a resident.
        const existingUserResult = await pool.query(
            `SELECT user_id, verification_status
             FROM users
             WHERE LOWER(BTRIM(email)) = $1
             LIMIT 1`,
            [normalizedEmail]
        );

        const passwordHash = await bcrypt.hash(password, 10);

        let newUserId;

        if (existingUserResult.rows.length > 0) {
            const existingUser = existingUserResult.rows[0];

            const currentStatus = String(
                existingUser.verification_status || ""
            ).trim().toLowerCase();

            // Only rejected accounts can submit a new application.
            if (currentStatus !== "rejected") {
                await removeUploadedFiles(req);

                return res.status(409).json({
                    success: false,
                    message: currentStatus === "pending"
                        ? "Your registration is still awaiting verification."
                        : "An account with this email already exists."
                });
            }

            // Reuse the rejected account instead of creating a duplicate.
            const updateResult = await pool.query(
                `UPDATE users
                 SET full_legal_name = $1,
                     gender = $2,
                     civil_status = $3,
                     date_of_birth = $4,
                     mobile_number = $5,
                     email = $6,
                     address = $7,
                     sitio_purok = $8,
                     id_type = $9,
                     id_file_path = $10,
                     residency_proof_type = $11,
                     residency_proof_path = $12,
                     password_hash = $13,
                     verification_status = 'Pending',
                     verification_notes = NULL,
                     reviewed_at = NULL,
                     setup_token_hash = NULL,
                     setup_token_expires_at = NULL
                 WHERE user_id = $14
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
                    passwordHash,
                    existingUser.user_id
                ]
            );

            newUserId = updateResult.rows[0].user_id;

        } else {
            // No existing account: create a new resident record.
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

            newUserId = insertResult.rows[0].user_id;
        }

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
            "Login successful.",
            req.body.rememberMe === true
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
            "Admin login successful.",
            req.body.rememberMe === true
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
            `SELECT verification_status
             FROM users
             WHERE LOWER(BTRIM(email)) = $1
             LIMIT 1`,
            [normalizedEmail]
        );

        const existingUser = existingUserResult.rows[0] || null;

        const currentStatus = existingUser
            ? String(existingUser.verification_status || "")
                .trim()
                .toLowerCase()
            : "";

        // A rejected account may submit a new registration.
        const available =
            !existingUser || currentStatus === "rejected";

        return res.status(200).json({
            success: true,
            available,
            message: available
                ? existingUser
                    ? "Your previous application was rejected. You may submit a new registration using this email."
                    : "Email is available."
                : currentStatus === "pending"
                    ? "Your registration is still awaiting verification."
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
// 7. REQUEST PASSWORD RESET
// ==========================================
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (typeof email !== "string" || !isValidEmail(email.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [residentResult, adminResult] = await Promise.all([
            pool.query(
                `SELECT user_id, full_legal_name, email
                 FROM users
                 WHERE LOWER(BTRIM(email)) = $1
                   AND verification_status = 'Verified'
                   AND password_hash IS NOT NULL
                   AND password_hash <> ''
                 LIMIT 1`,
                [normalizedEmail]
            ),
            pool.query(
                `SELECT admin_id, email
                 FROM admins
                 WHERE LOWER(BTRIM(email)) = $1
                   AND password_hash IS NOT NULL
                   AND password_hash <> ''
                 LIMIT 1`,
                [normalizedEmail]
            )
        ]);

        const accounts = [];

        if (residentResult.rows.length > 0) {
            const resident = residentResult.rows[0];

            accounts.push({
                accountId: resident.user_id,
                accountType: "resident",
                email: resident.email,
                fullName: resident.full_legal_name
            });
        }

        if (adminResult.rows.length > 0) {
            const admin = adminResult.rows[0];

            accounts.push({
                accountId: admin.admin_id,
                accountType: "admin",
                email: admin.email,
                fullName: "Administrator"
            });
        }

        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            console.error("FRONTEND_URL is not configured.");
            return res.status(500).json({
                success: false,
                message: "Unable to process your request right now."
            });
        }

        for (const account of accounts) {
            const token = crypto.randomBytes(32).toString("hex");

            const tokenHash = crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

            // Invalidate previous unused reset links for this account.
            await pool.query(
                `UPDATE password_reset_tokens
                 SET used_at = NOW()
                 WHERE account_id = $1
                   AND account_type = $2
                   AND used_at IS NULL`,
                [account.accountId, account.accountType]
            );

            await pool.query(
                `INSERT INTO password_reset_tokens (
                    account_id,
                    account_type,
                    email,
                    token_hash,
                    expires_at
                )
                VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')`,
                [
                    account.accountId,
                    account.accountType,
                    account.email,
                    tokenHash
                ]
            );

            const resetLink =
                `${frontendUrl.replace(/\/$/, "")}/reset-password.html?token=${token}`;

            try {
                await sendPasswordResetEmail(
                    account.email,
                    account.fullName,
                    resetLink
                );
            } catch (emailError) {
                await pool.query(
                    `DELETE FROM password_reset_tokens
                     WHERE token_hash = $1`,
                    [tokenHash]
                );

                throw emailError;
            }
        }

        // Same response whether the email exists or not.
        return res.status(200).json({
            success: true,
            message:
                "If an account with that email exists, password reset instructions will be sent."
        });

    } catch (error) {
        console.error("Password reset request error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to process your request right now. Please try again."
        });
    }
};


// ==========================================
// 8. VERIFY PASSWORD RESET TOKEN
// ==========================================
const verifyPasswordResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (typeof token !== "string" || !token.trim()) {
            return res.status(400).json({
                success: false,
                valid: false,
                message: "Invalid password reset link."
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token.trim())
            .digest("hex");

        const result = await pool.query(
            `SELECT reset_id
             FROM password_reset_tokens
             WHERE token_hash = $1
               AND expires_at > NOW()
               AND used_at IS NULL
             LIMIT 1`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                valid: false,
                message: "This password reset link is invalid or has expired."
            });
        }

        return res.status(200).json({
            success: true,
            valid: true,
            message: "Password reset link is valid."
        });

    } catch (error) {
        console.error("Password reset token verification error:", error);

        return res.status(500).json({
            success: false,
            valid: false,
            message: "Unable to verify the password reset link."
        });
    }
};


// ==========================================
// 9. RESET PASSWORD
// ==========================================
const resetPassword = async (req, res) => {
    let client;

    try {
        const { token, password, confirmPassword } = req.body || {};

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

        const passwordHash = await bcrypt.hash(password, 10);

        client = await pool.connect();

        await client.query("BEGIN");

        // Lock the token row to prevent simultaneous reuse.
        const tokenResult = await client.query(
            `SELECT reset_id, account_id, account_type
             FROM password_reset_tokens
             WHERE token_hash = $1
               AND expires_at > NOW()
               AND used_at IS NULL
             FOR UPDATE`,
            [tokenHash]
        );

        if (tokenResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "This password reset link is invalid or has expired."
            });
        }

        const resetRecord = tokenResult.rows[0];

        let updateResult;

        if (resetRecord.account_type === "resident") {
            updateResult = await client.query(
                `UPDATE users
                 SET password_hash = $1
                 WHERE user_id = $2
                 RETURNING user_id`,
                [passwordHash, resetRecord.account_id]
            );
        } else if (resetRecord.account_type === "admin") {
            updateResult = await client.query(
                `UPDATE admins
                 SET password_hash = $1
                 WHERE admin_id = $2
                 RETURNING admin_id`,
                [passwordHash, resetRecord.account_id]
            );
        } else {
            throw new Error("Invalid password reset account type.");
        }

        if (updateResult.rowCount !== 1) {
            throw new Error("Account associated with reset token was not found.");
        }

        // Mark this token and all other outstanding tokens for this
        // account as used.
        await client.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE account_id = $1
               AND account_type = $2
               AND used_at IS NULL`,
            [resetRecord.account_id, resetRecord.account_type]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Your password has been reset successfully. You can now log in."
        });

    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Password reset error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to reset your password. Please try again."
        });

    } finally {
        if (client) {
            client.release();
        }
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
    checkResidentEmail,
    requestPasswordReset,
    verifyPasswordResetToken,
    resetPassword
};
