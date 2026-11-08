
const transporter = require("../config/emailConfig");

// Escape user-provided text before inserting it into HTML.
function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

// Validate email recipient.
function validateEmail(email) {
    if (!email || typeof email !== "string") {
        throw new Error("A valid recipient email address is required.");
    }

    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error("Invalid recipient email address.");
    }

    return normalizedEmail;
}

// Email notification when a proposal is approved.
async function sendProposalApprovalEmail(email, fullName, projectTitle) {
    const recipient = validateEmail(email);
    const safeName = escapeHtml(fullName || "Community Member");
    const safeTitle = escapeHtml(projectTitle || "Community Project Proposal");

    const mailOptions = {
        from: `"Brgy360 Admin" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: "Brgy360 - Your Project Proposal Has Been Approved!",
        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                color: #333;
                line-height: 1.6;
            ">
                <h2 style="color: #15803d;">
                    Your Proposal Has Been Approved!
                </h2>

                <p>Hello ${safeName},</p>

                <p>
                    We are pleased to inform you that your project proposal
                    has been reviewed and approved by the Barangay Council.
                </p>

                <p>
                    <strong>Project Title:</strong> ${safeTitle}
                </p>

                <p>
                    Thank you for taking the initiative to contribute
                    to the development of our community.
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

// Email notification when a proposal is rejected.
async function sendProposalRejectionEmail(
    email,
    fullName,
    projectTitle,
    councilNotes
) {
    const recipient = validateEmail(email);
    const safeName = escapeHtml(fullName || "Community Member");
    const safeTitle = escapeHtml(projectTitle || "Community Project Proposal");
    const safeNotes = escapeHtml(councilNotes).replace(/\r?\n/g, "<br>");

    if (!String(councilNotes || "").trim()) {
        throw new Error(
            "Barangay Council Review Notes & Disposition are required for rejected proposals."
        );
    }

    const mailOptions = {
        from: `"Brgy360 Admin" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: "Brgy360 - Update on Your Project Proposal",
        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                color: #333;
                line-height: 1.6;
            ">
                <h2 style="color: #b91c1c;">
                    Proposal Status: Rejected
                </h2>

                <p>Hello ${safeName},</p>

                <p>
                    Thank you for submitting your project proposal.
                    After careful review, the Barangay Council has
                    decided not to approve the proposal at this time.
                </p>

                <p>
                    <strong>Project Title:</strong> ${safeTitle}
                </p>

                <div style="
                    background-color: #f9fafb;
                    border-left: 4px solid #b91c1c;
                    padding: 16px;
                    margin: 20px 0;
                ">
                    <h3 style="margin-top: 0; color: #333;">
                        Barangay Council Review Notes &amp; Disposition
                    </h3>

                    <p>${safeNotes}</p>
                </div>

                <p>
                    We appreciate your effort and encourage you
                    to consider the Council's feedback when preparing
                    future community project proposals.
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

module.exports = {
    sendProposalApprovalEmail,
    sendProposalRejectionEmail
};
