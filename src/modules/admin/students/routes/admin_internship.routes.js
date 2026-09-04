const express = require("express");
const { requireAdmin } = require("../../../../shared/middleware/auth");
const { verifyCsrf }   = require("../../../../shared/middleware/csrf");
const { addMessage }   = require("../../../../shared/middleware/flash");
const { Student, Internship } = require("../../../../db/models");
const path = require("path");
const fs   = require("fs");
const { getUploadConfig } = require("../../../../config/upload");

const router = express.Router();
router.use(requireAdmin);

const cfg = getUploadConfig();

// ═══════════════════════════════════════════════════════════════════════════
// GET /students/:pk/internships/  — admin summary list of a student's internships
// ═══════════════════════════════════════════════════════════════════════════
router.get("/students/:pk/internships/", async (req, res, next) => {
  try {
    const student = await Student.findByPk(String(req.params.pk));
    if (!student) return res.status(404).send("Student not found.");

    const internships = await Internship.findAll({
      where: { studentId: student.student_id },
      order: [["startDate", "DESC"]],
    });

    return res.render("tracker/admin_student_internships.html", {
      student: student.toJSON(),
      internships: internships.map(i => i.toJSON()),
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /students/:pk/internships/:id/ — admin full detail view
// ═══════════════════════════════════════════════════════════════════════════
router.get("/students/:pk/internships/:id/", async (req, res, next) => {
  try {
    const student = await Student.findByPk(String(req.params.pk));
    if (!student) return res.status(404).send("Student not found.");

    const internship = await Internship.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!internship) return res.status(404).send("Internship not found.");

    return res.render("tracker/admin_internship_detail.html", {
      student: student.toJSON(),
      internship: internship.toJSON(),
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /students/:pk/internships/:id/verify/ — set verification status + remarks
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/students/:pk/internships/:id/verify/",
  verifyCsrf,
  async (req, res, next) => {
    try {
      const student = await Student.findByPk(String(req.params.pk));
      if (!student) return res.status(404).send("Student not found.");

      const internship = await Internship.findOne({
        where: { id: req.params.id, studentId: student.student_id },
      });
      if (!internship) return res.status(404).send("Internship not found.");

      const { verificationStatus, verificationRemarks } = req.body;
      const allowed = ["Pending", "Verified", "Rejected"];
      if (!allowed.includes(verificationStatus)) {
        addMessage(req, { type: "danger", text: "Invalid verification status." });
        return res.redirect(`/students/${student.student_id}/internships/${internship.id}/`);
      }

      // Once verified, the status is locked — no further changes allowed
      if (internship.verificationStatus === "Verified") {
        addMessage(req, {
          type: "warning",
          text: "This internship is already verified and cannot be changed.",
        });
        return res.redirect(`/students/${student.student_id}/internships/${internship.id}/`);
      }

      await internship.update({
        verificationStatus,
        verificationRemarks: (verificationRemarks || "").trim() || null,
      });

      addMessage(req, {
        type: "success",
        text: `Internship marked as ${verificationStatus}.`,
      });
      return res.redirect(`/students/${student.student_id}/internships/${internship.id}/`);
    } catch (err) { return next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// GET /students/:pk/internships/:id/certificate — serve certificate inline (admin)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/students/:pk/internships/:id/certificate", async (req, res, next) => {
  try {
    const internship = await Internship.findOne({
      where: { id: req.params.id, studentId: String(req.params.pk) },
    });
    if (!internship || !internship.certificateFile)
      return res.status(404).send("Certificate not found.");

    const filePath = path.join(cfg.mediaRoot, internship.certificateFile);
    if (!fs.existsSync(filePath)) return res.status(404).send("Certificate file missing.");

    const ext  = path.extname(internship.certificateFile).toLowerCase();
    const mime = ext === ".pdf" ? "application/pdf"
               : ext === ".png" ? "image/png"
               : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="certificate${ext}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /students/:pk/internships/:id/certificate/download — force-download (admin)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/students/:pk/internships/:id/certificate/download", async (req, res, next) => {
  try {
    const internship = await Internship.findOne({
      where: { id: req.params.id, studentId: String(req.params.pk) },
    });
    if (!internship || !internship.certificateFile)
      return res.status(404).send("Certificate not found.");

    const filePath = path.join(cfg.mediaRoot, internship.certificateFile);
    if (!fs.existsSync(filePath)) return res.status(404).send("Certificate file missing.");

    const ext = path.extname(internship.certificateFile).toLowerCase();
    const downloadName = `${String(req.params.pk)}_internship_${req.params.id}_certificate${ext}`;
    return res.download(filePath, downloadName);
  } catch (err) { return next(err); }
});

module.exports = router;
