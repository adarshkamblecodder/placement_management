const { sendMail } = require("../utils/mailer");
const { Student } = require("../../db/models");
const { Op } = require("sequelize");

/**
 * Send notification when a student is shortlisted for a drive.
 * Returns { ok: true } or { ok: false, error } — never throws.
 */
async function notifyStudentShortlisted({ student, drive, company, shortlistName }) {
  try {
    if (!student || !student.email) return { ok: false, error: "no_email" };

    const companyName  = company?.name || drive?.company?.name || "Company";
    const role         = drive?.jobRole        || "Recruitment Drive";
    const driveDate    = drive?.interviewDate  || null;
    const driveLocation = drive?.driveLocation || null;
    const packageLPA   = drive?.packageLPA     || null;
    const minCGPA      = drive?.minCGPA        != null ? drive.minCGPA : null;
    const eligibility  = drive?.eligibleBranches || null;
    const description  = drive?.jobDescription || null;
    const studentName  = student.name || student.student_id;

    const subject = `Congratulations! You Have Been Shortlisted for ${companyName} Placement Drive`;

    // ── Plain-text fallback ──────────────────────────────────────────────
    const lines = [
      `Dear ${studentName},`,
      ``,
      `Congratulations!`,
      ``,
      `We are pleased to inform you that you have been shortlisted for the ${companyName} Placement Drive conducted through the Placement Management System.`,
      ``,
      `── Placement Drive Details ─────────────────────────────`,
      `Company   : ${companyName}`,
      `Job Role  : ${role}`,
    ];
    if (driveDate)   lines.push(`Drive Date: ${driveDate}`);
    if (driveLocation) lines.push(`Drive Location: ${driveLocation}`);
    if (packageLPA)  lines.push(`Package   : ₹${packageLPA} LPA`);
    if (minCGPA != null) lines.push(`Min CGPA  : ${minCGPA}`);
    if (eligibility) lines.push(`Eligibility: ${eligibility}`);
    if (description) lines.push(``, `Drive Overview:`, description);
    lines.push(
      `────────────────────────────────────────────────────`,
      ``,
      `You are shortlisted for the further selection rounds.`,
      ``,
      `Please keep checking your registered email for updates regarding the next round, schedule, instructions, venue/link, and other important information.`,
      ``,
      `The next-round details will be communicated to you through email.`,
      ``,
      `Please ensure that you are available and follow all instructions provided in the subsequent communication.`,
      ``,
      `Regards,`,
      `Placement Cell`,
      `Placement Management System`,
    );
    const text = lines.join("\n");

    // ── HTML version ─────────────────────────────────────────────────────
    const driveRows = [
      `<tr><td style="padding:6px 12px;color:#64748b;font-weight:600;white-space:nowrap;">Company</td><td style="padding:6px 12px;font-weight:700;color:#0f172a;">${companyName}</td></tr>`,
      `<tr style="background:#f8fafc;"><td style="padding:6px 12px;color:#64748b;font-weight:600;white-space:nowrap;">Job Role</td><td style="padding:6px 12px;font-weight:600;color:#0f172a;">${role}</td></tr>`,
    ];
    if (driveDate)
      driveRows.push(`<tr><td style="padding:6px 12px;color:#64748b;font-weight:600;">Drive Date</td><td style="padding:6px 12px;">${driveDate}</td></tr>`);
    if (driveLocation)
      driveRows.push(`<tr style="background:#f8fafc;"><td style="padding:6px 12px;color:#64748b;font-weight:600;">Drive Location</td><td style="padding:6px 12px;">${driveLocation}</td></tr>`);
    if (packageLPA)
      driveRows.push(`<tr style="background:#f8fafc;"><td style="padding:6px 12px;color:#64748b;font-weight:600;">Package</td><td style="padding:6px 12px;font-weight:700;color:#16a34a;">₹${packageLPA} LPA</td></tr>`);
    if (minCGPA != null)
      driveRows.push(`<tr><td style="padding:6px 12px;color:#64748b;font-weight:600;">Min CGPA</td><td style="padding:6px 12px;">${minCGPA}</td></tr>`);
    if (eligibility)
      driveRows.push(`<tr style="background:#f8fafc;"><td style="padding:6px 12px;color:#64748b;font-weight:600;">Eligible Branches</td><td style="padding:6px 12px;">${eligibility}</td></tr>`);

    const descBlock = description
      ? `<div style="margin:20px 0;padding:14px 16px;background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:6px;">
           <div style="font-size:13px;color:#0369a1;font-weight:600;margin-bottom:6px;">Drive Overview</div>
           <div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;">${description}</div>
         </div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#0ea5e9);padding:32px 36px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">🎉</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Congratulations!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">You have been shortlisted for a Placement Drive</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 20px;font-size:15px;color:#334155;">Dear <strong>${studentName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
              We are pleased to inform you that you have been
              <strong style="color:#4f46e5;">shortlisted for the ${companyName} Placement Drive</strong>
              conducted through the Placement Management System.
            </p>

            <!-- Shortlisted badge -->
            <div style="text-align:center;margin:24px 0;">
              <span style="display:inline-block;background:#dcfce7;color:#16a34a;font-size:14px;font-weight:700;padding:10px 24px;border-radius:50px;border:1.5px solid #86efac;letter-spacing:0.04em;">
                ✅ &nbsp;YOU ARE SHORTLISTED FOR FURTHER ROUNDS
              </span>
            </div>

            <!-- Drive details table -->
            <div style="margin-bottom:20px;">
              <div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Placement Drive Details</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px;color:#334155;">
                ${driveRows.join("\n                ")}
              </table>
            </div>

            ${descBlock}

            <!-- Next steps callout -->
            <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin:20px 0;">
              <div style="font-size:14px;font-weight:700;color:#1d4ed8;margin-bottom:8px;">📧 What Happens Next?</div>
              <p style="margin:0 0 8px;font-size:14px;color:#1e40af;line-height:1.6;">
                Please keep checking your registered email for updates regarding the
                <strong>next round, schedule, instructions, venue / meeting link</strong>, and other important information.
              </p>
              <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">
                The next-round details will be communicated to you through email.
              </p>
            </div>

            <p style="font-size:14px;color:#334155;line-height:1.6;margin:20px 0 0;">
              Please ensure that you are available and follow all instructions provided in the subsequent communication.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
              Regards,<br>
              <strong style="color:#334155;">Placement Cell</strong><br>
              Placement Management System
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const result = await sendMail({ to: student.email, subject, text, html });
    return result;
  } catch (err) {
    console.error("Error sending shortlist notification email:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send notification to eligible students when a new placement drive is posted
 */
async function notifyNewJobPosted({ drive, company }) {
  try {
    if (!drive) return;
    const companyName = company?.name || "Company";
    const role = drive.jobRole || "Placement Drive";
    const eligible = drive.eligibleBranches;

    let branchFilter = {};
    if (eligible && typeof eligible === "string" && eligible.trim()) {
      const branches = eligible.split(/[,/ ]+/).map((b) => b.trim().toUpperCase()).filter(Boolean);
      if (branches.length > 0) {
        branchFilter = { branch: { [Op.in]: branches } };
      }
    }

    const students = await Student.findAll({
      where: {
        ...branchFilter,
        email: { [Op.not]: null, [Op.ne]: "" },
      },
    });

    const subject = `New Recruitment Drive: ${role} at ${companyName}`;
    const text = `Dear Student,

A new placement drive has been posted matching your profile:

Company: ${companyName}
Role: ${role}
Date: ${drive.interviewDate || "To be announced"}
Package: ${drive.packageLPA ? `${drive.packageLPA} LPA` : "Not specified"}
Min CGPA: ${drive.minCGPA || "N/A"}
Eligible Branches: ${eligible || "All Branches"}

Login to the Placement Portal to view more details and prepare for the drive.

Best regards,
Training & Placement Cell
`;

    // Send asynchronously in batches or loop without blocking the main request
    for (const s of students) {
      if (s.email) {
        sendMail({ to: s.email, subject, text }).catch((err) => {
          console.error(`Failed to send job alert to ${s.email}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error("Error sending new drive notification emails:", err.message);
  }
}

/**
 * Send notification when student's placement status is updated
 */
async function notifyPlacementStatusUpdated({ student, status, companyName, packageLPA }) {
  try {
    if (!student || !student.email) return;

    const subject = `Placement Status Update: ${status}`;
    let details = `Status: ${status}`;
    if (companyName) details += `\nCompany: ${companyName}`;
    if (packageLPA) details += `\nPackage: ${packageLPA} LPA`;

    const text = `Dear ${student.name || student.student_id},

Your placement status in the Training & Placement Cell records has been updated.

---------------------------------
${details}
---------------------------------

Please log in to your portal account to review your profile and status details.

Best regards,
Training & Placement Cell
`;

    await sendMail({ to: student.email, subject, text });
  } catch (err) {
    console.error("Error sending placement status update email:", err.message);
  }
}

/**
 * Send notification when an interview is scheduled for a student
 */
async function notifyInterviewScheduled({ student, round, drive, company, date, time, mode, venue }) {
  try {
    if (!student || !student.email) return;

    const companyName = company?.name || drive?.company?.name || "Company";
    const role = drive?.jobRole || "Recruitment Drive";
    const roundName = round?.name || `Round ${round?.roundNumber || 1}`;
    const scheduleDate = date || round?.date || drive?.interviewDate || "To be confirmed";

    const subject = `Interview Scheduled: ${roundName} - ${companyName} (${role})`;
    const text = `Dear ${student.name || student.student_id},

Your interview round has been scheduled:

Company: ${companyName}
Role: ${role}
Round: ${roundName}
Date: ${scheduleDate}
Time: ${time || "As per drive schedule"}
Mode/Venue: ${mode || venue || "Campus Placement Hall / Virtual"}

Please be prepared and log in to the portal for further round instructions.

Best regards,
Training & Placement Cell
`;

    await sendMail({ to: student.email, subject, text });
  } catch (err) {
    console.error("Error sending interview schedule email:", err.message);
  }
}

/**
 * Send final result notification (Approved / Placed / Rejected)
 */
async function notifyDriveResult({ student, drive, company, result, remarks, packageLPA }) {
  try {
    if (!student || !student.email) return;

    const companyName = company?.name || drive?.company?.name || "Company";
    const role = drive?.jobRole || "Placement Drive";
    const isApproved = result === "Approved" || result === "Placed" || result === "Selected" || result === "Qualified";

    const subject = isApproved
      ? `Congratulations! Selection Result: ${companyName} - ${role}`
      : `Placement Drive Result: ${companyName} - ${role}`;

    const text = isApproved
      ? `Dear ${student.name || student.student_id},

Congratulations! We are delighted to inform you that you have been SELECTED for the role of "${role}" at ${companyName}${packageLPA ? ` with an offered package of ${packageLPA} LPA` : ""}.

${remarks ? `Feedback/Remarks: ${remarks}\n` : ""}
The Training & Placement Cell congratulates you on this achievement!

Best regards,
Training & Placement Cell
`
      : `Dear ${student.name || student.student_id},

Thank you for participating in the placement process for "${role}" at ${companyName}.

We regret to inform you that your candidacy was not selected in this drive.${remarks ? `\nFeedback: ${remarks}` : ""}

Keep preparing for upcoming opportunities on the Placement Portal.

Best regards,
Training & Placement Cell
`;

    await sendMail({ to: student.email, subject, text });
  } catch (err) {
    console.error("Error sending drive result email:", err.message);
  }
}

module.exports = {
  notifyStudentShortlisted,
  notifyNewJobPosted,
  notifyPlacementStatusUpdated,
  notifyInterviewScheduled,
  notifyDriveResult,
};
