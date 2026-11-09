
const pool = require("../database/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

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
        } = req.body;

        if (
            !full_legal_name ||
            !gender ||
            !civil_status ||
            !date_of_birth ||
            !mobile_number ||
            !email ||
            !address ||
            !sitio_purok ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (!req.files || !req.files.id_document || !req.files.id_document[0]) {
            return res.status(400).json({
                success: false,
                message: "Please upload a valid ID document."
            });
        }

        const id_file_path =
            `/uploads/${req.files.id_document[0].filename}`;

        const residency_proof_path =
            req.files.residency_proof_document &&
            req.files.residency_proof_document[0]
                ? `/uploads/${req.files.residency_proof_document[0].filename}`
                : null;

        const proofType =
            residency_proof_type || "No Proof of Residency";

        const normalizedEmail = email.trim().toLowerCase();

        const existingUserResult = await pool.query(
            "SELECT user_id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUserResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        // Save the new resident in PostgreSQL.
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
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, 'Pending'
            )
            RETURNING user_id`,
            [
                full_legal_name,
                gender,
                civil_status,
                date_of_birth,
                mobile_number,
                normalizedEmail,
                address,
                sitio_purok,
                id_type || null,
                id_file_path,
                proofType,
                residency_proof_path,
                password_hash
            ]
        );

        const newUserId = insertResult.rows[0].user_id;

        // Create an admin notification for the new registration.
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
                    "new_registration",
                    "New Resident Registration",
                    `${full_legal_name} has submitted a resident registration and is awaiting verification.`,
                    "residents",
                    String(newUserId)
                ]
            );
        } catch (notificationError) {
            console.error(
                "Failed to create registration notification:",
                notificationError
            );
        }

        return res.status(201).json({
            success: true,
            message: "Registration submitted successfully. Your account is pending verification."
        });

    } catch (error) {
        console.error("Registration error:", error.message);

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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email.trim().toLowerCase()]
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
                message: "Please complete your account setup using the link sent to your email."
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

        req.session.regenerate((error) => {
            if (error) {
                console.error("Session regeneration error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not create login session."
                });
            }

            req.session.user = {
                id: user.user_id,
                email: user.email,
                role: "resident",
                full_legal_name: user.full_legal_name
            };

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
                    message: "Login successful.",
                    user: req.session.user
                });
            });
        });

    } catch (error) {
        console.error("Resident login error:", error.message);

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
        const { token, password, confirmPassword } = req.body || {};

        if (
            typeof token !== "string" ||
            typeof password !== "string" ||
            typeof confirmPassword !== "string" ||
            !token ||
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

        // Hash the token received from the email link.
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // Find an approved resident with a valid, unused token.
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
                message: "This setup link is invalid, expired, or has already been used. Please contact your barangay administrator."
            });
        }

        const userId = residentResult.rows[0].user_id;

        // Hash the resident's new password.
        const passwordHash = await bcrypt.hash(password, 10);

        // Save password and invalidate the setup token.
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
               AND password_hash IS NULL`,
            [passwordHash, userId, tokenHash]
        );

        if (updateResult.rowCount !== 1) {
            return res.status(400).json({
                success: false,
                message: "This setup link is invalid, expired, or has already been used."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Your password has been created successfully. You can now log in to Brgy360."
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
        console.error("Get current user error:", error.message);

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
            `SELECT admin_id, email, password_hash
             FROM admins
             WHERE LOWER(BTRIM(email)) = $1`,
            [normalizedEmail]
        );

        console.log("ADMIN LOGIN EMAIL:", normalizedEmail);
        console.log("ADMIN ACCOUNT FOUND:", adminResult.rows.length > 0);

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

        console.log("ADMIN PASSWORD MATCH:", isPasswordValid);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!req.session) {
            console.error("Admin login failed: session is unavailable.");

            return res.status(500).json({
                success: false,
                message: "Login session is unavailable."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error("Admin session error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not create login session."
                });
            }

            req.session.user = {
                id: admin.admin_id,
                email: admin.email,
                role: "admin"
            };

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Admin session save error:",
                        saveError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Could not save login session."
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Admin login successful.",
                    user: req.session.user
                });
            });
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error during admin login."
        });
    }
};


// ==========================================
// CHECK IF RESIDENT EMAIL IS ALREADY USED
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

        const existingUserResult = await pool.query(
            "SELECT user_id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUserResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                available: false,
                message: "An account with this email already exists."
            });
        }

        return res.status(200).json({
            success: true,
            available: true,
            message: "Email is available."
        });

    } catch (error) {
        console.error("Email availability check error:", error.message);

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
