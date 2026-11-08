
const transporter = require("../config/emailConfig");

async function sendPickupReadyEmail(email, fullName, documentType, requestId) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Brgy360 - Your Document Is Ready for Pickup!",
        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                color: #333;
                line-height: 1.6;
            ">
                <h2 style="color: #15803d;">
                    Your Document Is Ready!
                </h2>

                <p>Hello ${fullName},</p>

                <p>
                    Good news! Your requested document has been
                    processed and is now ready for pickup at your
                    Barangay Hall.
                </p>

                <div style="
                    background: #f0fdf4;
                    padding: 16px;
                    border-radius: 8px;
                    margin: 20px 0;
                ">
                    <p><strong>Document:</strong> ${documentType}</p>
                    <p><strong>Request Reference:</strong> REQ-${requestId}</p>
                    <p><strong>Status:</strong> Ready for Pickup</p>
                </div>

                <p>
                    Please visit your Barangay Hall to claim your
                    document. Kindly bring a valid identification
                    document for verification.
                </p>

                <p>
                    If you have questions, please contact your
                    barangay administration.
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

module.exports = sendPickupReadyEmail;
