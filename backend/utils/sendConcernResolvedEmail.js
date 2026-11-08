
const transporter = require("../config/emailConfig");

async function sendConcernResolvedEmail(
    email,
    concernTitle,
    concernId,
    resolutionNotes
) {
    const ticketReference = `TCK-${String(concernId).padStart(4, "0")}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your Brgy360 Concern Has Been Resolved!",
        text: `Hello,

Your concern "${concernTitle}" (${ticketReference}) has been marked as Resolved.

Resolution notes:
${resolutionNotes || "No additional notes were provided."}

Thank you,
Brgy360 Admin`
    };

    return transporter.sendMail(mailOptions);
}

module.exports = sendConcernResolvedEmail;
