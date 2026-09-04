const express = require("express");
const { Op } = require("sequelize");
const { Student } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/placed/", async (req, res) => {
  const { q, branch, year } = req.query;

  const where = { placement_status: "Placed" };

  if (q) {
    where[Op.and] = [
      {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { student_id: { [Op.like]: `%${q}%` } },
          { placement_company: { [Op.like]: `%${q}%` } },
        ],
      },
    ];
  }
  if (branch) where.branch = branch;
  // BUG-10 FIX: filter by placement_year (e.g. "2025", "2026"), not the academic year
  // field Student.year (which holds "1"/"2"/"3"/"4"). The year dropdown is populated
  // from placement_year values, matching how reports.routes.js works.
  if (year) where.placement_year = year;

  const students = await Student.findAll({
    where,
    order: [["placement_year", "DESC"], ["branch", "ASC"], ["name", "ASC"]],
  });

  const yearsRaw = await Student.findAll({
    attributes: ["placement_year"],
    where: { placement_status: "Placed", placement_year: { [Op.not]: null, [Op.ne]: "" } },
    group: ["placement_year"],
    order: [["placement_year", "DESC"]],
  });
  const years = yearsRaw.map((r) => r.placement_year).filter(Boolean);

  // Always show all known branches in the filter dropdown — not just branches
  // that happen to have a placed student. If AIDS or MBA have no placements yet
  // the filter should still be visible so the TPO can select it (returns 0 rows,
  // which is a valid and informative result).
  const ALL_BRANCHES = ["CS", "AIML", "AIDS", "MBA"];

  // Also include any branch found in the placed-student rows that isn't in the
  // hardcoded list (future-proofing for new departments added later).
  const branchesRaw = await Student.findAll({
    attributes: ["branch"],
    where: { placement_status: "Placed", branch: { [Op.not]: null, [Op.ne]: "" } },
    group: ["branch"],
  });
  const dbBranches = branchesRaw.map((r) => r.branch).filter(Boolean);
  const branches = [...new Set([...ALL_BRANCHES, ...dbBranches])];

  const totalPlaced = students.length;
  const avgPackage = totalPlaced > 0
    ? (students.reduce((sum, s) => sum + (Number(s.placement_package) || 0), 0) / totalPlaced).toFixed(2)
    : 0;
  const highestPackage = totalPlaced > 0
    ? Math.max(...students.map((s) => Number(s.placement_package) || 0)).toFixed(2)
    : 0;

  return res.render("tracker/placed_list.html", {
    object_list: students,
    years,
    branches,
    query: req.query,
    total_placed: totalPlaced,
    avg_package: avgPackage,
    highest_package: highestPackage,
  });
});

// ─── Export Placed Students (Excel / CSV) ──────────────────────────────────
router.get("/placed/export/", async (req, res) => {
  const XLSX = require("xlsx");
  const { q, branch, year, format } = req.query;

  const where = { placement_status: "Placed" };
  if (q) {
    where[Op.and] = [{
      [Op.or]: [
        { name:              { [Op.like]: `%${q}%` } },
        { student_id:        { [Op.like]: `%${q}%` } },
        { placement_company: { [Op.like]: `%${q}%` } },
      ],
    }];
  }
  if (branch) where.branch = branch;
  // BUG-10 FIX: use placement_year to match the list-page filter
  if (year) where.placement_year = year;

  const students = await Student.findAll({
    where,
    order: [["year", "DESC"], ["branch", "ASC"], ["name", "ASC"]],
  });

  const rows = students.map((s, i) => ({
    "S.No":            i + 1,
    "Student ID":      s.student_id || "",
    "Full Name":       s.name || "",
    "Branch":          s.branch || "",
    "Academic Year":   s.year || "",
    "CGPA":            s.cgpa != null ? Number(s.cgpa) : "",
    "Email":           s.email || "",
    "Phone":           s.phone_number || "",
    "Company":         s.placement_company || "",
    "Package (LPA)":   s.placement_package != null ? Number(s.placement_package) : "",
    "Placement Year":  s.placement_year || "",
  }));

  const isCsv = format === "csv";
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Placed Students");

  const filename = `placed_students_${year || "all"}_${branch || "all"}`;

  if (isCsv) {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  return res.send(buffer);
});

module.exports = router;
