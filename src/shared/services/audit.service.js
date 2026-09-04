const { AuditLog } = require("../../db/models");

/**
 * Record an administrative audit log entry
 * @param {Object} params
 * @param {string|number} params.adminId - ID or username of the performing admin
 * @param {string} params.action - Action performed (e.g. UPDATE_PLACEMENT_STATUS, EDIT_STUDENT, DELETE_STUDENT)
 * @param {string} params.targetTable - Target database table (e.g. tracker_student, tracker_placement)
 * @param {string|number} params.targetId - ID of the target resource
 * @param {string|Object} [params.details] - Additional context or metadata
 */
async function recordAuditLog({ adminId, action, targetTable, targetId, details }) {
  try {
    const formattedDetails =
      typeof details === "object" ? JSON.stringify(details) : String(details || "");

    return await AuditLog.create({
      admin_id: String(adminId || "system"),
      action: String(action),
      target_table: String(targetTable),
      target_id: targetId ? String(targetId) : null,
      details: formattedDetails,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Failed to record audit log:", err.message);
  }
}

module.exports = { recordAuditLog };
