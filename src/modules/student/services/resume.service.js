const fs = require("fs");
const path = require("path");
const { Resume, Student } = require("../../../db/models");
const { getUploadConfig } = require("../../../config/upload");

function ensureUploadDirs() {
  const cfg = getUploadConfig();
  for (const dir of [cfg.mediaRoot, cfg.photosDir, cfg.resumesDir]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
}

async function authorizeResumeAccess(session, resumeId) {
  const u = session?.user;
  if (!u) return null;

  const resume = await Resume.findByPk(Number(resumeId));
  if (!resume) return null;

  if (u.isStaff) return resume;

  const student = await Student.findOne({ where: { user_id: u.id } });
  if (!student) return null;
  if (student.student_id !== resume.studentId) return null;
  return resume;
}

async function rotateActiveResume(studentId) {
  await Resume.update(
    { isActive: false },
    { where: { studentId, isActive: true } }
  );
}

async function recordUploadedResume({ studentId, file }) {
  await rotateActiveResume(studentId);
  return Resume.create({
    studentId,
    storagePath: `resumes/${file.filename}`.replace(/\\/g, "/"),
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    isActive: true,
  });
}

function resumeAbsolutePath(resume) {
  const cfg = getUploadConfig();
  return path.join(cfg.mediaRoot, resume.storagePath);
}

async function deleteResume(resume) {
  const filePath = resumeAbsolutePath(resume);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
  await resume.destroy();
}

module.exports = {
  ensureUploadDirs,
  authorizeResumeAccess,
  recordUploadedResume,
  resumeAbsolutePath,
  deleteResume,
};
