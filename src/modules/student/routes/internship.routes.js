const express = require("express");
const multer  = require("multer");
const path    = require("path");
const crypto  = require("crypto");
const fs      = require("fs");

const { requireStudent }  = require("../middleware/requireStudent");
const { verifyCsrf }      = require("../../../shared/middleware/csrf");
const { addMessage }      = require("../../../shared/middleware/flash");
const { getUploadConfig } = require("../../../config/upload");
const { Student, Internship } = require("../../../db/models");
const { recordAuditLog }  = require("../../../shared/services/audit.service");

const router = express.Router();
const cfg    = getUploadConfig();

// ── Ensure certificate upload dir exists ────────────────────────────────────
try { fs.mkdirSync(cfg.certificatesDir, { recursive: true }); } catch (_) {}

// ── Multer for certificate files ─────────────────────────────────────────────
const CERT_TYPES = new Set(cfg.allowedCertificateMime);

const certStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cfg.certificatesDir),
  filename: (req, file, cb) => {
    const uid    = String(req.session?.user?.id || "anon");
    const safeExt = (path.extname(file.originalname || "").toLowerCase() || ".pdf").slice(0, 6);
    cb(null, `${uid}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`);
  },
});

const certUpload = multer({
  storage: certStorage,
  limits: { fileSize: cfg.maxCertificateBytes },
  fileFilter: (_req, file, cb) => {
    if (CERT_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, JPG, and PNG files are allowed for certificates."));
  },
});

// ── Helper: get current student from session ─────────────────────────────────
async function getStudent(req) {
  return Student.findOne({ where: { user_id: req.session.user.id } });
}

// ── Helper: compute duration string from two DATEONLY strings ────────────────
function computeDuration(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s) || isNaN(e) || e < s) return null;
  let years  = e.getFullYear() - s.getFullYear();
  let months = e.getMonth()    - s.getMonth();
  let days   = e.getDate()     - s.getDate();
  if (days < 0) { months--; days += new Date(e.getFullYear(), e.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  const parts = [];
  if (years  > 0) parts.push(`${years} year${years  > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  if (days   > 0) parts.push(`${days} day${days   > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" ") : "Less than a day";
}

// ── Helper: build safe internship payload from req.body ──────────────────────
function buildPayload(body, studentId) {
  const startDate = body.startDate || null;
  const endDate   = body.endDate   || null;
  return {
    studentId,
    status:          body.status          || "Completed",
    companyName:     (body.companyName    || "").trim(),
    internshipType:  body.internshipType  || "Technical",
    domain:          (body.domain         || "").trim(),
    role:            (body.role           || "").trim(),
    startDate,
    endDate,
    duration:        (startDate && endDate) ? computeDuration(startDate, endDate) : null,
    workMode:        body.workMode        || "On-site",
    description:     (body.description   || "").trim() || null,
    projectTitle:    (body.projectTitle   || "").trim() || null,
    responsibilities:(body.responsibilities || "").trim() || null,
    skillsUsed:      (body.skillsUsed    || "").trim() || null,
    outcome:         (body.outcome       || "").trim() || null,
    certificateNumber:    (body.certificateNumber    || "").trim() || null,
    certificateIssueDate: body.certificateIssueDate  || null,
    mentorName:      (body.mentorName    || "").trim() || null,
    mentorContact:   (body.mentorContact || "").trim() || null,
    stipendReceived: body.stipendReceived === "true" || body.stipendReceived === true,
    stipendAmount:   body.stipendAmount  ? Number(body.stipendAmount)  : null,
    ppoOffered:      body.ppoOffered     === "true" || body.ppoOffered === true,
    ppoPackage:      body.ppoPackage     ? Number(body.ppoPackage)     : null,
  };
}

// ── Validate required fields ─────────────────────────────────────────────────
function validate(body, file, isNew) {
  const errors = [];
  if (!body.companyName?.trim())   errors.push("Company Name is required.");
  if (!body.domain?.trim())        errors.push("Domain / Technology is required.");
  if (!body.role?.trim())          errors.push("Internship Role is required.");
  if (!body.startDate)             errors.push("Start Date is required.");
  if (!body.endDate)               errors.push("End Date is required.");
  if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate))
    errors.push("End Date cannot be before Start Date.");
  // Certificate is mandatory on new records; on edit it is only required
  // when the existing record has no certificate yet.
  if (isNew && !file)
    errors.push("Internship Certificate is required.");
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/internships/          — list all internships
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/internships/", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const internships = await Internship.findAll({
      where:  { studentId: student.student_id },
      order:  [["startDate", "DESC"]],
    });

    return res.render("tracker/student_internships.html", {
      student,
      internships: internships.map(i => i.toJSON()),
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/internships/add/      — blank add form
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/internships/add/", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");
    return res.render("tracker/student_internship_form.html", {
      student,
      internship: null,
      formAction: "/student/internships/add/",
      formTitle:  "Add Internship",
      errors: [],
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /student/internships/add/      — create
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/student/internships/add/",
  requireStudent,
  (req, res, next) => {
    certUpload.single("certificateFile")(req, res, (err) => {
      if (err) {
        addMessage(req, { type: "danger", text: err.message || "Certificate upload failed." });
        return res.redirect("/student/internships/add/");
      }
      next();
    });
  },
  verifyCsrf,
  async (req, res, next) => {
    try {
      const student = await getStudent(req);
      if (!student) return res.redirect("/login/");

      const errors = validate(req.body, req.file, true);
      if (errors.length) {
        errors.forEach(e => addMessage(req, { type: "danger", text: e }));
        return res.redirect("/student/internships/add/");
      }

      const payload = buildPayload(req.body, student.student_id);
      if (req.file) {
        payload.certificateFile = `certificates/${req.file.filename}`;
      }

      await Internship.create(payload);
      await recordAuditLog({
        adminId: student.student_id,
        action: "STUDENT_INTERNSHIP_ADDED",
        targetTable: "tracker_internship",
        targetId: student.student_id,
        details: `Student "${student.name}" added internship at "${payload.companyName}" as ${payload.role} (${payload.status}).`,
      });
      addMessage(req, { type: "success", text: "Internship added successfully." });
      return res.redirect("/student/internships/");
    } catch (err) { return next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/internships/:id/      — view detail
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/internships/:id/", requireStudent, async (req, res, next) => {
  try {
    const student     = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const internship = await Internship.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!internship) return res.status(404).send("Internship not found.");

    return res.render("tracker/student_internship_detail.html", {
      student,
      internship: internship.toJSON(),
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/internships/:id/edit/ — pre-filled edit form
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/internships/:id/edit/", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const internship = await Internship.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!internship) return res.status(404).send("Internship not found.");

    // Block editing once admin has verified
    if (internship.verificationStatus === "Verified") {
      addMessage(req, {
        type: "warning",
        text: "This internship has been verified by the admin and can no longer be edited.",
      });
      return res.redirect("/student/internships/");
    }

    return res.render("tracker/student_internship_form.html", {
      student,
      internship: internship.toJSON(),
      formAction: `/student/internships/${internship.id}/edit/`,
      formTitle:  "Edit Internship",
      errors: [],
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /student/internships/:id/edit/ — update
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/student/internships/:id/edit/",
  requireStudent,
  (req, res, next) => {
    certUpload.single("certificateFile")(req, res, (err) => {
      if (err) {
        addMessage(req, { type: "danger", text: err.message || "Certificate upload failed." });
        return res.redirect(`/student/internships/${req.params.id}/edit/`);
      }
      next();
    });
  },
  verifyCsrf,
  async (req, res, next) => {
    try {
      const student = await getStudent(req);
      if (!student) return res.redirect("/login/");

      const internship = await Internship.findOne({
        where: { id: req.params.id, studentId: student.student_id },
      });
      if (!internship) return res.status(404).send("Internship not found.");

      // Block editing once admin has verified
      if (internship.verificationStatus === "Verified") {
        addMessage(req, {
          type: "warning",
          text: "This internship has been verified by the admin and can no longer be edited.",
        });
        return res.redirect("/student/internships/");
      }

      const errors = validate(req.body, req.file, !internship.certificateFile);
      if (errors.length) {
        errors.forEach(e => addMessage(req, { type: "danger", text: e }));
        return res.redirect(`/student/internships/${internship.id}/edit/`);
      }

      const payload = buildPayload(req.body, student.student_id);

      // Keep existing certificate if no new file uploaded
      if (req.file) {
        // Delete old certificate file if present
        if (internship.certificateFile) {
          const oldPath = path.join(cfg.mediaRoot, internship.certificateFile);
          try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (_) {}
        }
        payload.certificateFile = `certificates/${req.file.filename}`;
      } else {
        payload.certificateFile = internship.certificateFile;
      }

      // Preserve admin verification state — students cannot change it
      payload.verificationStatus  = internship.verificationStatus;
      payload.verificationRemarks = internship.verificationRemarks;

      await internship.update(payload);
      await recordAuditLog({
        adminId: student.student_id,
        action: "STUDENT_INTERNSHIP_UPDATED",
        targetTable: "tracker_internship",
        targetId: student.student_id,
        details: `Student "${student.name}" updated internship at "${payload.companyName}" as ${payload.role}.`,
      });
      addMessage(req, { type: "success", text: "Internship updated successfully." });
      return res.redirect("/student/internships/");
    } catch (err) { return next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /student/internships/:id/delete/ — delete with ownership check
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/student/internships/:id/delete/",
  requireStudent,
  verifyCsrf,
  async (req, res, next) => {
    try {
      const student = await getStudent(req);
      if (!student) return res.redirect("/login/");

      const internship = await Internship.findOne({
        where: { id: req.params.id, studentId: student.student_id },
      });
      if (!internship) {
        addMessage(req, { type: "danger", text: "Internship not found." });
        return res.redirect("/student/internships/");
      }

      // Block deletion once admin has verified
      if (internship.verificationStatus === "Verified") {
        addMessage(req, {
          type: "warning",
          text: "This internship has been verified by the admin and cannot be deleted.",
        });
        return res.redirect("/student/internships/");
      }

      // Delete certificate file from disk
      if (internship.certificateFile) {
        const filePath = path.join(cfg.mediaRoot, internship.certificateFile);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
      }

      await internship.destroy();
      await recordAuditLog({
        adminId: student.student_id,
        action: "STUDENT_INTERNSHIP_DELETED",
        targetTable: "tracker_internship",
        targetId: student.student_id,
        details: `Student "${student.name}" deleted internship at "${internship.companyName}" as ${internship.role}.`,
      });
      addMessage(req, { type: "success", text: "Internship deleted." });
      return res.redirect("/student/internships/");
    } catch (err) { return next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/internships/:id/certificate — serve certificate file inline
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/internships/:id/certificate", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const internship = await Internship.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!internship || !internship.certificateFile)
      return res.status(404).send("Certificate not found.");

    const filePath = path.join(cfg.mediaRoot, internship.certificateFile);
    if (!fs.existsSync(filePath)) return res.status(404).send("Certificate file missing.");

    const ext = path.extname(internship.certificateFile).toLowerCase();
    const mime = ext === ".pdf" ? "application/pdf"
               : ext === ".png" ? "image/png"
               : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="certificate${ext}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) { return next(err); }
});

module.exports = router;
