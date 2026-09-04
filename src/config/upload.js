const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
// Backward-compatible: existing files live under media/, served at /media.
// New uploads also resolve under media/<bucket>/ to keep URLs stable.
const MEDIA_ROOT = path.join(ROOT, "media");

function getUploadConfig() {
  return {
    mediaRoot: MEDIA_ROOT,
    photosDir: path.join(MEDIA_ROOT, "profile_photos"),
    resumesDir: path.join(MEDIA_ROOT, "resumes"),
    certificatesDir: path.join(MEDIA_ROOT, "certificates"),
    publicMediaPrefix: "/media",
    maxResumeBytes: 5 * 1024 * 1024,
    maxPhotoBytes: 5 * 1024 * 1024,
    maxCertificateBytes: 5 * 1024 * 1024,
    allowedResumeMime: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    allowedCertificateMime: [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ],
  };
}

module.exports = { getUploadConfig };
