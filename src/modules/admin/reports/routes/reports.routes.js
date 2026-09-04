const express = require("express");
const { Op } = require("sequelize");
const { Student, Internship, StudentProject } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/reports/", async (req, res) => {
  const { year: y, branch: b, package: p } = req.query;
  const { fn, col } = require("sequelize");

  const placedWhere = { placement_status: "Placed" };
  const allWhere = {};

  if (y) {
    placedWhere.placement_year = y;
    allWhere.placement_year = y;
  }
  if (b) {
    placedWhere.branch = b;
    allWhere.branch = b;
  }
  if (p) {
    placedWhere.placement_package = { [Op.gte]: Number(p) };
  }

  const placedStudents = await Student.findAll({ where: placedWhere });
  const allStudents = await Student.findAll({ where: allWhere });

  const yearsObjects = await Student.findAll({
    attributes: ["placement_year"],
    where: { placement_year: { [Op.not]: null, [Op.ne]: "" } },
    group: ["placement_year"],
    order: [["placement_year", "ASC"]],
  });
  const years = yearsObjects.map((o) => o.placement_year).filter(Boolean);

  // BUG-09 FIX: merge into a single branch key using Op.and — the original code had two
  // `branch` keys in the same object literal, so JS silently dropped the first one
  // ([Op.not]: null), allowing null-branch rows to appear in the dropdown.
  const branchesObjects = await Student.findAll({
    attributes: ["branch"],
    where: { branch: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }] } },
    group: ["branch"],
  });
  const branches = branchesObjects.map((o) => o.branch).filter(Boolean);

  const total_p = placedStudents.length;

  let placed_count, not_placed_count, total_students_scope;

  if (y) {
    const yearStudents = await Student.findAll({ where: { placement_year: y } });
    placed_count = yearStudents.filter((s) => s.placement_status === "Placed").length;
    const total_in_year = yearStudents.length;
    not_placed_count = Math.max(0, total_in_year - placed_count);
    total_students_scope = total_in_year;
  } else {
    placed_count = await Student.count({ where: { placement_status: "Placed" } });
    not_placed_count = await Student.count({ where: { placement_status: "Not Placed" } });
    total_students_scope = placed_count + not_placed_count;
  }

  let totalPackage = 0;
  for (const s of placedStudents) {
    if (s.placement_package) totalPackage += Number(s.placement_package);
  }
  const avg_package = total_p > 0 ? totalPackage / total_p : 0;

  // S-08 FIX: same duplicate-key pattern as BUG-04 — two separate keys `[Op.not]`
  // and `[Op.ne]` in a single object literal causes JS to silently drop the first
  // one. Merged into Op.and so both conditions are applied.
  const chartBranchesObjects = await Student.findAll({
    attributes: ["branch"],
    where: { branch: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }] } },
    group: ["branch"],
    order: [["branch", "ASC"]],
  });
  let branches_all = chartBranchesObjects.map((o) => o.branch).filter(Boolean);

  if (b) {
    branches_all = branches_all.filter((br) => br === b);
  }

  const bar_placed = [];
  const bar_not_placed = [];

  for (const br of branches_all) {
    const brPlacedWhere = { branch: br, placement_status: "Placed" };
    if (y) brPlacedWhere.placement_year = y;

    const pCount = await Student.count({ where: brPlacedWhere });
    bar_placed.push(pCount);

    const npCount = await Student.count({ where: { branch: br, placement_status: "Not Placed" } });
    bar_not_placed.push(npCount);
  }

  // ── Internship & Live Project Stats ───────────────────────────────────────
  const internshipCompleted = await Internship.count({ where: { status: "Completed" } });
  const internshipOngoing   = await Internship.count({ where: { status: "Ongoing" } });
  const studentsWithInternship = await Internship.count({
    distinct: true,
    col: "studentId",
    where: { status: { [Op.in]: ["Completed", "Ongoing"] } },
  });
  const stipendInterns = await Internship.count({ where: { stipendReceived: true } });
  const ppoInterns     = await Internship.count({ where: { ppoOffered: true } });

  const studentsWithLiveProject = await StudentProject.count({
    distinct: true,
    col: "studentId",
    where: { projectType: "LIVE" },
  });
  const liveProjectsTotal   = await StudentProject.count({ where: { projectType: "LIVE" } });
  const normalProjectsTotal = await StudentProject.count({ where: { projectType: "NORMAL" } });

  return res.render("tracker/reports.html", {
    students: placedStudents,
    years,
    branches,
    f_year: y || "",
    f_branch: b || "",
    f_package: p || "",
    total_placements: total_p,
    avg_package,
    placed_count,
    not_placed_count,
    total_students_scope,
    chart_branches: JSON.stringify(branches_all),
    chart_branch_placed: JSON.stringify(bar_placed),
    chart_branch_not_placed: JSON.stringify(bar_not_placed),
    // Internship stats
    internshipCompleted,
    internshipOngoing,
    studentsWithInternship,
    stipendInterns,
    ppoInterns,
    // Live project stats
    studentsWithLiveProject,
    liveProjectsTotal,
    normalProjectsTotal,
  });
});

router.get("/reports/export/", async (req, res) => {
  const XLSX = require("xlsx");
  const { year: y, branch: b, package: p } = req.query;

  const placedWhere = { placement_status: "Placed" };
  if (y) placedWhere.placement_year = y;
  if (b) placedWhere.branch = b;
  if (p) placedWhere.placement_package = { [Op.gte]: Number(p) };

  const placedStudents = await Student.findAll({
    where: placedWhere,
    order: [["placement_year", "DESC"], ["branch", "ASC"], ["name", "ASC"]],
  });

  const exportRows = placedStudents.map((s, idx) => ({
    "S.No": idx + 1,
    "Student ID": s.student_id,
    "Full Name": s.name || "",
    "Branch": s.branch || "",
    "Academic Year": s.year || "",
    "CGPA": s.cgpa != null ? Number(s.cgpa) : "",
    "Email": s.email || "",
    "Company Name": s.placement_company || "",
    "Package (LPA)": s.placement_package != null ? Number(s.placement_package) : "",
    "Placement Year": s.placement_year || "",
    "Status": s.placement_status || "Placed",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Placement Report");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="placement_report_${y || 'all'}_${b || 'all'}.xlsx"`);
  return res.send(buffer);
});

module.exports = router;
