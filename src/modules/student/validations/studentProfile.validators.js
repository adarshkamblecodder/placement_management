function validateProfilePayload(b = {}) {
  const errors = [];

  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email))) {
    errors.push("Email is invalid.");
  }
  if (b.cgpa !== undefined && b.cgpa !== "") {
    const v = Number(b.cgpa);
    if (!Number.isFinite(v) || v < 0 || v > 10) errors.push("CGPA must be 0-10.");
  }
  for (const k of ["tenthPercentage", "twelfthPercentage"]) {
    if (b[k] !== undefined && b[k] !== "") {
      const v = Number(b[k]);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        errors.push(`${k} must be 0-100.`);
      }
    }
  }
  if (b.backlogs !== undefined && b.backlogs !== "") {
    const v = Number(b.backlogs);
    if (!Number.isInteger(v) || v < 0) {
      errors.push("Backlogs must be a non-negative integer.");
    }
  }
  for (const k of ["linkedin", "github", "portfolioUrl", "resume_link"]) {
    const val = b[k];
    if (val) {
      try {
        const u = new URL(val);
        if (!["http:", "https:"].includes(u.protocol)) {
          errors.push(`${k} must be a valid http(s) URL.`);
        }
      } catch (_) {
        errors.push(`${k} must be a valid URL.`);
      }
    }
  }

  return errors;
}

module.exports = { validateProfilePayload };
