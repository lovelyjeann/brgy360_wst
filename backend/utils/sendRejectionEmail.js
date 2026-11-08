
const transporter = require("../config/emailConfig");

async function sendRejectionEmail(email, fullName, reason) {
    const mailOptions = {
        from: `"Brgy360 Admin" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Brgy360 - Registration Update",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Brgy360 Registration Update</h2>

                <p>Hello ${fullName},</p>

                <p>
                    Thank you for registering with Brgy360.
                    After reviewing your registration, we regret to inform
                    you that your application has not been approved.
                </p>

                <p><strong>Reason for rejection:</strong></p>

                <div style="
                    background-color: #f5f5f5;
                    padding: 15px;
                    border-left: 4px solid #dc2626;
                    margin: 20px 0;
                ">
                    ${reason}
                </div>

                <p>
                    If you believe this decision was made in error,
                    or if you would like to correct your registration,
                    please contact your barangay administrator.
                </p>

                <p>
                    Regards,<br>
                    Brgy360 Admin
                </p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = sendRejectionEmail;
