const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const { requireLogin } = require("../../../shared/middleware/auth");
const { verifyCsrf } = require("../../../shared/middleware/csrf");
const { addMessage } = require("../../../shared/middleware/flash");
const { getUploadConfig } = require("../../../config/upload");
const { requireStudent } = require("../middleware/requireStudent");
const { ensureUploadDirs } = require("../services/resume.service");
const c = require("../controllers/studentProfile.controller");

ensureUploadDirs();

const cfg = getUploadConfig();

// ─── Multer for profile_photo ───────────────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cfg.photosDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || "").toLowerCase().slice(0, 6);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt || ".jpg"}`;
    cb(null, name);
  },
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: cfg.maxPhotoBytes },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for profile photo."));
  },
});

// ─── Multer for resume ──────────────────────────────────────────────────
const RESUME_TYPES = new Set(cfg.allowedResumeMime);

const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cfg.resumesDir),
  filename: async (req, file, cb) => {
    // Use the actual student_id for the filename, not the AuthUser integer id
    try {
      const { Student } = require("../../../db/models");
      const student = await Student.findOne({ where: { user_id: req.session?.user?.id } });
      const studentId = student?.student_id || String(req.session?.user?.id || "anon");
      const safeExt = (path.extname(file.originalname || "").toLowerCase() || ".pdf").slice(0, 6);
      const name = `${studentId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
      cb(null, name);
    } catch (err) {
      cb(err);
    }
  },
});
const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: cfg.maxResumeBytes },
  fileFilter: (_req, file, cb) => {
    if (RESUME_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF, DOC, and DOCX files are allowed."));
  },
});

const router = express.Router();

router.get("/student/profile/", requireStudent, c.getProfilePage);

router.post(
  "/student/profile/",
  requireStudent,
  (req, res, next) => {
    photoUpload.single("profile_photo")(req, res, (err) => {
      if (err) {
        addMessage(req, {
          type: "danger",
          text: err.message || "Profile photo upload failed.",
        });
        return res.redirect("/student/profile/");
      }
      next();
    });
  },
  verifyCsrf,
  c.postProfile
);

router.post(
  "/student/profile/resume/upload",
  requireStudent,
  (req, res, next) => {
    resumeUpload.single("resume")(req, res, (err) => {
      if (err) {
        addMessage(req, {
          type: "danger",
          text: err.message || "Resume upload failed.",
        });
        return res.redirect("/student/profile/");
      }
      next();
    });
  },
  verifyCsrf,
  c.postResumeUpload
);

router.get("/student/profile/resume/:id/preview", requireLogin, c.getResumePreview);
router.get("/student/profile/resume/:id/download", requireLogin, c.getResumeDownload);
router.post("/student/profile/resume/:id/delete", requireStudent, c.postResumeDelete);
router.get("/student/interview-rounds/", requireStudent, c.getInterviewRoundsPage);

// ─── My Profile (edit form) ─────────────────────────────────────────────
router.get("/student/my-profile/", requireStudent, c.getMyProfilePage);

router.post(
  "/student/my-profile/",
  requireStudent,
  (req, res, next) => {
    photoUpload.single("profile_photo")(req, res, (err) => {
      if (err) {
        addMessage(req, {
          type: "danger",
          text: err.message || "Profile photo upload failed.",
        });
        return res.redirect("/student/my-profile/");
      }
      next();
    });
  },
  verifyCsrf,
  c.postProfile
);

module.exports = router;
