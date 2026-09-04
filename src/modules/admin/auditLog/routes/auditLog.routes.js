const express = require("express");
const { Op } = require("sequelize");
const { AuditLog } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");

const router = express.Router();
router.use(requireAdmin);

const PAGE_SIZE = 50;

router.get("/admin/audit-log/", async (req, res) => {
  const { q, action, table, from, to, page } = req.query;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const where = {};
  if (action) where.action = action;
  if (table)  where.target_table = table;

  // Date range filter
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp[Op.gte] = new Date(from + "T00:00:00");
    if (to)   where.timestamp[Op.lte] = new Date(to   + "T23:59:59");
  }

  if (q) {
    where[Op.or] = [
      { admin_id:    { [Op.like]: `%${q}%` } },
      { target_id:   { [Op.like]: `%${q}%` } },
      { action:      { [Op.like]: `%${q}%` } },
      { details:     { [Op.like]: `%${q}%` } },
    ];
  }

  const total = await AuditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const logs = await AuditLog.findAll({
    where,
    order: [["timestamp", "DESC"], ["id", "DESC"]],
    limit:  PAGE_SIZE,
    offset: (safePage - 1) * PAGE_SIZE,
  });

  // Dropdown option lists
  const actions = await AuditLog.findAll({
    attributes: ["action"],
    group: ["action"],
    order: [["action", "ASC"]],
  }).then((r) => r.map((x) => x.action).filter(Boolean));

  const tables = await AuditLog.findAll({
    attributes: ["target_table"],
    group: ["target_table"],
    order: [["target_table", "ASC"]],
  }).then((r) => r.map((x) => x.target_table).filter(Boolean));

  return res.render("tracker/audit_log.html", {
    logs,
    query:       req.query,
    actions,
    tables,
    total,
    currentPage: safePage,
    totalPages,
    pageSize:    PAGE_SIZE,
  });
});

module.exports = router;
