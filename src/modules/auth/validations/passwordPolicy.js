function validatePasswordPolicy(pw) {
  const s = String(pw || "");
  const errors = [];
  if (s.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(s)) errors.push("Password must contain an uppercase letter.");
  if (!/[a-z]/.test(s)) errors.push("Password must contain a lowercase letter.");
  if (!/[0-9]/.test(s)) errors.push("Password must contain a number.");
  if (!/[^A-Za-z0-9]/.test(s)) errors.push("Password must contain a special character.");
  return errors;
}

module.exports = { validatePasswordPolicy };
