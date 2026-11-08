const transporter = require("../config/emailConfig");

async function sendSetupEmail(email, fullName, setupLink) {
    const mailOptions = {
        from: `"Brgy360 Admin" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Brgy360 - Set Up Your Account",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Welcome to Brgy360!</h2>

                <p>Hello ${fullName},</p>

                <p>Your resident registration has been approved.</p>

                <p>Please click the button below to create your Brgy360 password:</p>

                <p style="margin: 30px 0;">
                    <a href="${setupLink}"
                       style="background-color: #2563eb; color: white;
                       padding: 12px 20px; text-decoration: none;
                       border-radius: 6px;">
                       Set Up My Account
                    </a>
                </p>

                <p>This link is valid for 24 hours and can only be used once.</p>

                <p>If you did not expect this email, please contact your barangay administrator.</p>

                <p>Regards,<br>Brgy360 Admin</p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = sendSetupEmail;