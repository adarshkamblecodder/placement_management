const express = require("express");
const { requireAdmin } = require("../../../../shared/middleware/auth");
const { addMessage } = require("../../../../shared/middleware/flash");
const { recordAuditLog } = require("../../../../shared/services/audit.service");
const { getMailDiagnostics } = require("../../../../config/mail");
const { sendMail, verifySmtpConnection } = require("../../../../shared/utils/mailer");
const { hashDjangoPassword, verifyDjangoPassword } = require("../../../auth/services/djangoPbkdf2.service");
const { validatePasswordPolicy } = require("../../../auth/validations/passwordPolicy");
const { getPasswordHasherConfig } = require("../../../auth/services/credentials.service");
const {
  Student,
  Company,
  PlacementDrive,
  Shortlist,
  ShortlistStudent,
  StudentRoundResult,
  InterviewRound,
  Application,
  Placement,
  StudentLoginMeta,
  StudentProfile,
  AuthUser,
  Job,
} = require("../../../../db/models");

const router = express.Router();
router.use(requireAdmin);

router.get("/settings/", async (req, res) => {
  const studentCount = await Student.count();
  const companyCount = await Company.count();
  const mailDiagnostics = getMailDiagnostics();
  
  res.render("tracker/settings.html", {
    studentCount,
    companyCount,
    mailDiagnostics,
  });
});

router.post("/settings/test-email/", async (req, res) => {
  try {
    const to = String(req.body?.email || req.session?.user?.email || "").trim();
    if (!to) {
      addMessage(req, { type: "danger", text: "Enter an email address to send the test message." });
      return res.redirect("/settings/");
    }

    const verify = await verifySmtpConnection();
    if (!verify.ok) {
      addMessage(req, { type: "danger", text: "SMTP check failed: " + (verify.error || "Unknown error") });
      return res.redirect("/settings/");
    }

    const result = await sendMail({
      to,
      subject: "Placement Portal — SMTP Test",
      text: "SMTP is working. Student login credential emails can now be delivered.",
      html: "<p><strong>SMTP is working.</strong> Student login credential emails can now be delivered.</p>",
    });

    if (!result.ok) {
      addMessage(req, { type: "danger", text: "Test email failed: " + (result.error || result.reason || "Unknown error") });
    } else {
      addMessage(req, { type: "success", text: `Test email sent to ${to}. Check inbox and spam folder.` });
    }
  } catch (err) {
    console.error("[SMTP TEST ERROR]", err);
    addMessage(req, { type: "danger", text: "SMTP test error: " + (err?.message || "Unexpected error. Check server logs.") });
  }

  return res.redirect("/settings/");
});

router.post("/settings/delete-all-students/", async (req, res) => {
  try {
    // Due to foreign key constraints, we should delete dependent records first or use CASCADE if set up.
    // Assuming Student is heavily linked to Shortlists, Placements, Applications, LoginMeta, Profile
    await ShortlistStudent.destroy({ where: {} });
    await StudentRoundResult.destroy({ where: {} });
    await Application.destroy({ where: {} });
    await Placement.destroy({ where: {} });
    await StudentLoginMeta.destroy({ where: {} });
    await StudentProfile.destroy({ where: {} });
    
    const count = await Student.count();
    await Student.destroy({ where: {} });

    // Optionally delete AuthUsers linked to students (role=student)
    await AuthUser.destroy({ where: { role: 'student' } });

    recordAuditLog({ adminId: req.session?.user?.id ?? "system", action: "DELETE_ALL_STUDENTS", targetTable: "tracker_student", details: `Admin deleted all ${count} students and related data.` });
    addMessage(req, { type: "success", text: `Successfully wiped ${count} students from the database.` });
  } catch (error) {
    console.error("Error deleting all students:", error);
    addMessage(req, { type: "danger", text: "Failed to delete all students. Check console for details." });
  }
  res.redirect("/settings/");
});

router.post("/settings/delete-all-companies/", async (req, res) => {
  try {
    const count = await Company.count();

    // Delete in FK-safe order:
    // 1. shortlist_students  (FK → shortlists)
    // 2. student_round_results (FK → interview_rounds)
    // 3. interview_rounds    (FK → placement_drives)
    // 4. shortlists          (FK → placement_drives)  ← was missing before (S-01 fix)
    // 5. placement_drives    (FK → tracker_company)
    // 6. tracker_application (FK → tracker_company)
    // 7. tracker_job         (FK → tracker_company)   ← was missing before (S-01 fix)
    // 8. tracker_company
    await ShortlistStudent.destroy({ where: {} });
    await StudentRoundResult.destroy({ where: {} });
    await InterviewRound.destroy({ where: {} });
    await Shortlist.destroy({ where: {} });         // S-01 FIX: must come before PlacementDrive
    await PlacementDrive.destroy({ where: {} });
    await Application.destroy({ where: {} });
    await Job.destroy({ where: {} });               // S-01 FIX: must come before Company
    await Company.destroy({ where: {} });

    await recordAuditLog({
      adminId: req.session?.user?.id ?? "system",
      action: "DELETE_ALL_COMPANIES",
      targetTable: "tracker_company",
      details: `Admin deleted all ${count} companies and all related drives, shortlists, rounds, and jobs.`,
    });
    addMessage(req, { type: "success", text: `Successfully wiped ${count} companies and all their drives, shortlists, and jobs from the database.` });
  } catch (error) {
    console.error("Error deleting all companies:", error);
    addMessage(req, { type: "danger", text: "Failed to delete all companies. Check console for details." });
  }
  res.redirect("/settings/");
});

router.post("/settings/delete-student-by-id/", async (req, res) => {
  const studentId = String(req.body?.student_id || "").trim();

  if (!studentId) {
    addMessage(req, { type: "danger", text: "No Student ID provided." });
    return res.redirect("/settings/");
  }

  const student = await Student.findByPk(studentId);
  if (!student) {
    addMessage(req, { type: "danger", text: `No student found with ID "${studentId}".` });
    return res.redirect("/settings/");
  }

  const tx = await Student.sequelize.transaction();
  try {
    await StudentRoundResult.destroy({ where: { studentId: student.student_id }, transaction: tx });
    await ShortlistStudent.destroy({ where: { studentId: student.student_id }, transaction: tx });
    await Application.destroy({ where: { student_id: student.student_id }, transaction: tx });
    await Placement.destroy({ where: { student_id: student.student_id }, transaction: tx });

    if (student.user_id) {
      await StudentLoginMeta.destroy({ where: { authUserId: student.user_id }, transaction: tx });
    } else {
      await StudentLoginMeta.destroy({ where: { studentId: student.student_id }, transaction: tx });
    }

    await StudentProfile.destroy({ where: { studentId: student.student_id }, transaction: tx });
    await Student.destroy({ where: { student_id: student.student_id }, transaction: tx });

    if (student.user_id) {
      await AuthUser.destroy({ where: { id: student.user_id }, transaction: tx });
    }

    await tx.commit();
    await recordAuditLog({
      adminId: req.session?.user?.id ?? "system",
      action: "DELETE_STUDENT_BY_ID",
      targetTable: "tracker_student",
      targetId: student.student_id,
      details: `Admin deleted student "${student.name}" (ID: ${student.student_id}) and all related data.`,
    });
    addMessage(req, { type: "success", text: `Student "${student.name}" (ID: ${studentId}) has been permanently deleted.` });
  } catch (error) {
    await tx.rollback();
    console.error("[DELETE STUDENT BY ID ERROR]", error);
    addMessage(req, { type: "danger", text: "Failed to delete student. Check console for details." });
  }

  return res.redirect("/settings/");
});

// ─── Admin Change Password (GET) ──────────────────────────────────────────
router.get("/admin/change-password/", (req, res) => {
  return res.render("tracker/admin_change_password.html");
});

// ─── Admin Change Password (POST) ─────────────────────────────────────────
router.post("/admin/change-password/", async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body || {};

  if (!current_password || !new_password || !confirm_password) {
    addMessage(req, { type: "danger", text: "All fields are required." });
    return res.redirect("/admin/change-password/");
  }

  if (new_password !== confirm_password) {
    addMessage(req, { type: "danger", text: "New password and confirm password do not match." });
    return res.redirect("/admin/change-password/");
  }

  const errors = validatePasswordPolicy(new_password);
  if (errors.length > 0) {
    errors.forEach((e) => addMessage(req, { type: "danger", text: e }));
    return res.redirect("/admin/change-password/");
  }

  try {
    const adminId = req.session?.user?.id;
    const user = await AuthUser.findByPk(adminId);
    if (!user) {
      addMessage(req, { type: "danger", text: "Admin account not found." });
      return res.redirect("/admin/change-password/");
    }

    const ok = await verifyDjangoPassword(current_password, user.password);
    if (!ok) {
      addMessage(req, { type: "danger", text: "Current password is incorrect." });
      return res.redirect("/admin/change-password/");
    }

    const cfg    = await getPasswordHasherConfig();
    const hashed = await hashDjangoPassword(new_password, {
      iterations: cfg.iterations,
      digest:     cfg.digest,
      saltLength: cfg.saltLength,
    });
    await user.update({ password: hashed });

    await recordAuditLog({
      adminId: req.session?.user?.id,
      action: "ADMIN_PASSWORD_CHANGED",
      targetTable: "auth_user",
      targetId: String(adminId),
      details: `Admin "${user.username}" changed their password.`,
    });

    addMessage(req, { type: "success", text: "Password changed successfully." });
    return res.redirect("/settings/");
  } catch (err) {
    console.error("[ADMIN CHANGE PASSWORD]", err);
    addMessage(req, { type: "danger", text: "Password change failed: " + (err?.message || "Unknown error") });
    return res.redirect("/admin/change-password/");
  }
});

module.exports = router;
