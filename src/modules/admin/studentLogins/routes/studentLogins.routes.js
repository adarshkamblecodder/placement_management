const express = require("express");
const { Op } = require("sequelize");
const { Student, AuthUser, StudentLoginMeta } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");
const {
  hashDjangoPassword,
  parseDjangoPBKDF2,
} = require("../../../auth/services/djangoPbkdf2.service");
const { sendMail } = require("../../../../shared/utils/mailer");
const { randomToken, sha256Hex } = require("../../../../shared/utils/security");
const { validatePasswordPolicy } = require("../../../auth/validations/passwordPolicy");

const router = express.Router();
router.use(requireAdmin);

async function getPasswordHasherConfig() {
  const firstUser = await AuthUser.findOne({ attributes: ["password"], order: [["id", "ASC"]] });
  const fallback = { digest: "sha256", iterations: 1200000, saltLength: 22 };
  if (!firstUser?.password) return fallback;
  const parsed = parseDjangoPBKDF2(firstUser.password);
  if (!parsed) return fallback;
  return { digest: parsed.digest, iterations: parsed.iterations, saltLength: String(parsed.salt).length };
}

function buildTempPassword(studentId) {
  // Strip everything except alphanumerics so special chars in the student ID
  // (e.g. slashes, spaces, dashes) don't accidentally break the password policy.
  const safeId = String(studentId || "").replace(/[^A-Za-z0-9]/g, "");
  const base = `Pm@${safeId}9`;
  if (base.length >= 8) return base;
  // Pad to guarantee the policy (≥8 chars, upper, lower, digit, special) is met.
  return (base + "Ab@9Xy1").slice(0, Math.max(12, base.length));
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

// Username is the student's email address (unique, user-friendly)
function buildCredentialEmail({ student, email, tempPassword, loginUrl }) {
  const subject = "Placement Portal Login Credentials";
  const name = student.name || email;
  const text = `Hello ${name},

Your student account has been created successfully for the Placement Management System.

Login Details:
--------------------------------
Login URL: ${loginUrl}
Username: ${email}
Password: ${tempPassword}
--------------------------------

For security purposes, please change your password after your first login.

Regards,
Training & Placement Cell
`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your student account has been created for the Placement Management System.</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 12px; font-weight: bold;">Login URL</td><td style="padding: 6px 12px;"><a href="${loginUrl}">${loginUrl}</a></td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold;">Username</td><td style="padding: 6px 12px;">${email}</td></tr>
        <tr><td style="padding: 6px 12px; font-weight: bold;">Password</td><td style="padding: 6px 12px;">${tempPassword}</td></tr>
      </table>
      <p>Please change your password after your first login.</p>
      <p>Regards,<br>Training &amp; Placement Cell</p>
    </div>
  `;
  return { subject, text, html };
}

async function hashTempPassword(tempPassword) {
  const cfg = await getPasswordHasherConfig();
  return hashDjangoPassword(tempPassword, {
    iterations: cfg.iterations,
    digest: cfg.digest,
    saltLength: cfg.saltLength,
  });
}

// Creates or updates the auth_user for a student.
// Username is set to the student's email address.
async function ensureAuthUserForStudent(student, studentId, tempPassword) {
  let authUser = null;

  if (student.user_id) {
    authUser = await AuthUser.findByPk(student.user_id);
  }

  if (!authUser) {
    // Find by email (the new username) or the old student-id username
    authUser = await AuthUser.findOne({
      where: { [Op.or]: [{ username: student.email }, { email: student.email }, { username: studentId }] },
    });
  }

  const hashedPassword = await hashTempPassword(tempPassword);

  if (authUser) {
    await authUser.update({
      username: student.email,   // email is the username
      email: student.email,
      password: hashedPassword,
      is_active: true,
    });
    if (!student.user_id) {
      await student.update({ user_id: authUser.id });
    }
  } else {
    authUser = await AuthUser.create({
      username: student.email,   // email is the username
      email: student.email,
      password: hashedPassword,
      is_staff: false,
      is_superuser: false,
      is_active: true,
      first_name: "",
      last_name: "",
      date_joined: new Date(),
    });
    await student.update({ user_id: authUser.id });
  }

  await StudentLoginMeta.upsert({
    studentId,
    authUserId: authUser.id,
    isFirstLogin: true,
  });

  return authUser;
}

// ─── Create or Re-send Login ────────────────────────────────────────────────
// If login already exists, we resend credentials to the same email — no rejection.
router.post("/:studentId/create", async (req, res) => {
  try {
    const studentId = String(req.params.studentId);
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });

    if (!student.email) {
      return res.status(400).json({ success: false, message: "Student email is missing. Add email first." });
    }

    const tempPassword = buildTempPassword(studentId);
    const pwErrors = validatePasswordPolicy(tempPassword);
    if (pwErrors.length > 0) {
      return res.status(500).json({ success: false, message: "Default password policy mismatch." });
    }

    // Always ensure the auth user exists (creates or resets password)
    await ensureAuthUserForStudent(student, studentId, tempPassword);

    const loginUrl = `${getBaseUrl(req)}/login/`;
    const { subject, text, html } = buildCredentialEmail({
      student,
      email: student.email,
      tempPassword,
      loginUrl,
    });
    const mailResult = await sendMail({ to: student.email, subject, text, html });

    const emailSent = Boolean(mailResult.ok);

    // Persist email-sent status
    await StudentLoginMeta.update({ emailSent }, { where: { studentId } });

    const responsePayload = {
      success: true,
      emailSent,
      reset: false,
      message: emailSent
        ? `Credentials emailed to ${student.email}.`
        : `Login created. Email could not be sent — share the credentials below manually.`,
      username: student.email,
      email: student.email,
      loginUrl,
      mailError: mailResult.error || mailResult.reason || null,
    };

    if (!emailSent) {
      responsePayload.tempPassword = tempPassword;
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error("create login error:", err);
    return res.status(500).json({ success: false, message: err.message || "Could not create student login." });
  }
});

// ─── Resend: send a password-reset link ─────────────────────────────────────
router.post("/:studentId/resend", async (req, res) => {
  try {
    const studentId = String(req.params.studentId);
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    if (!student.email) return res.status(400).json({ success: false, message: "Student email is missing." });
    if (!student.user_id) return res.status(400).json({ success: false, message: "Login not created yet." });

    const meta = await StudentLoginMeta.findOne({ where: { studentId } });
    if (!meta) return res.status(404).json({ success: false, message: "Login meta not found." });

    const token = randomToken(24);
    const tokenHash = sha256Hex(token);
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await meta.update({ passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: expires });

    const resetUrl = `${getBaseUrl(req)}/student/reset-password/?studentId=${encodeURIComponent(
      studentId
    )}&token=${encodeURIComponent(token)}`;

    const subject = "Placement Portal Password Reset";
    const text = `Hello ${student.name || student.email},\n\nUse the link below to set a new password (valid for 15 minutes):\n${resetUrl}\n\nYour username is your email address: ${student.email}\n\nRegards,\nTraining & Placement Cell\n`;
    const mailResult = await sendMail({ to: student.email, subject, text });

    if (!mailResult.ok) {
      return res.status(502).json({
        success: false,
        message: "Could not send reset email. Check SMTP settings in .env.",
        mailError: mailResult.error || mailResult.reason || null,
      });
    }

    await StudentLoginMeta.update({ emailSent: true }, { where: { studentId } });

    return res.json({ success: true, message: "Reset link sent." });
  } catch (err) {
    console.error("resend error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
