const transporter = require("../config/emailConfig");

async function sendPasswordResetEmail(email, fullName, resetLink) {
    const mailOptions = {
        from: `"Brgy360 Admin" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Brgy360 - Password Reset Request",
        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                color: #333;
                line-height: 1.6;
            ">
                <h2 style="color: #15803d;">
                    Password Reset Request
                </h2>

                <p>Hello ${fullName || "Brgy360 User"},</p>

                <p>
                    We received a request to reset your Brgy360 account
                    password. Click the button below to create a new password.
                </p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="
                        display: inline-block;
                        background-color: #15803d;
                        color: #ffffff;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: bold;
                    ">
                        Reset My Password
                    </a>
                </div>

                <p>
                    This link will expire in 15 minutes and can only
                    be used once.
                </p>

                <p>
                    If you did not request a password reset, you can
                    safely ignore this email.
                </p>

                <p>
                    Regards,<br>
                    <strong>Brgy360 Administration</strong>
                </p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = sendPasswordResetEmail;