
const transporter = require("../config/emailConfig");

async function sendApprovalEmail(email, fullName) {
    const mailOptions = {
        from: `"Brgy360 Admin" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Brgy360 - Your Registration Has Been Approved!",
        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                color: #333;
                line-height: 1.6;
            ">

                <h2 style="color: #15803d;">
                    Welcome to Brgy360!
                </h2>

                <p>Hello ${fullName},</p>

                <p>
                    Good news! Your resident registration has been
                    successfully verified and approved by your
                    barangay administrator.
                </p>

                <p>
                    You may now log in to your Brgy360 account
                    using your registered email address and
                    the password you created during registration.
                </p>

                <div style="text-align: center; margin: 30px 0;">
                    <a
                        href="${process.env.FRONTEND_URL}/login.html"
                        style="
                            display: inline-block;
                            background-color: #15803d;
                            color: #ffffff;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: bold;
                        "
                    >
                        Log In to Brgy360
                    </a>
                </div>

                <p>
                    If you did not register for a Brgy360 account,
                    please contact your barangay administrator.
                </p>

                <p>
                    Regards,<br>
                    <strong>Brgy360 Admin</strong>
                </p>

            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = sendApprovalEmail;