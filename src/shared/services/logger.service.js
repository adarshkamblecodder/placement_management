/**
 * Structured Logging Service
 * Emits JSON-formatted structured log entries with metadata (actor, action, target, timestamp)
 */
const { recordAuditLog } = require("./audit.service");

function logEvent({ level = "info", action, actorId = null, targetTable = null, targetId = null, details = "", metadata = {} }) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    actorId,
    targetTable,
    targetId: targetId ? String(targetId) : null,
    details,
    metadata,
  };

  // Structured stdout log for log collectors (DataDog, CloudWatch, Stackdriver)
  console.log(JSON.stringify(entry));

  // Persist state-changing actions into the database AuditLog
  if (level === "info" || level === "warn" || level === "audit") {
    if (action && targetTable) {
      recordAuditLog({
        adminId: actorId,
        action,
        targetTable,
        targetId: targetId ? String(targetId) : null,
        details,
      }).catch((err) => {
        console.error("Failed to persist audit log entry:", err.message);
      });
    }
  }

  return entry;
}

module.exports = {
  logEvent,
  info: (opts) => logEvent({ ...opts, level: "info" }),
  warn: (opts) => logEvent({ ...opts, level: "warn" }),
  error: (opts) => logEvent({ ...opts, level: "error" }),
  audit: (opts) => logEvent({ ...opts, level: "audit" }),
};
