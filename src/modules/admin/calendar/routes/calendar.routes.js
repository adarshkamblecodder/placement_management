const express = require("express");
const { Op } = require("sequelize");
const { PlacementDrive, Company, Shortlist, ShortlistStudent } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");

const router = express.Router();
router.use(requireAdmin);

// ─── Calendar Page (GET) ────────────────────────────────────────────────────
router.get("/admin/calendar/", async (req, res) => {
  // year/month for initial render — defaults to current month
  const now   = new Date();
  const year  = parseInt(req.query.year,  10) || now.getFullYear();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1; // 1-based

  // Fetch all drives for the selected year so the calendar can mark every
  // date that has at least one drive without a separate API call per cell.
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  const drives = await PlacementDrive.findAll({
    where: { interviewDate: { [Op.between]: [yearStart, yearEnd] } },
    include: [{ model: Company, as: "company" }],
    order: [["interviewDate", "ASC"], ["id", "ASC"]],
  });

  // Auto-derive driveStatus from interviewDate
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const drivesJson = drives.map((d) => {
    const obj = d.toJSON();
    if (obj.interviewDate) {
      const dt = new Date(obj.interviewDate); dt.setHours(0, 0, 0, 0);
      if (dt.getTime() === today.getTime()) obj.driveStatus = "ongoing";
      else if (dt < today)                  obj.driveStatus = "completed";
      else                                   obj.driveStatus = "upcoming";
    }
    return obj;
  });

  // Group drive IDs by date string "YYYY-MM-DD" for fast lookup in template
  const byDate = {};
  for (const d of drivesJson) {
    const key = d.interviewDate;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(d);
  }

  return res.render("tracker/drive_calendar.html", {
    year,
    month,
    drivesJson,
    byDateJson: JSON.stringify(byDate),
    totalDrives: drivesJson.length,
    upcomingCount:  drivesJson.filter(d => d.driveStatus === "upcoming").length,
    ongoingCount:   drivesJson.filter(d => d.driveStatus === "ongoing").length,
    completedCount: drivesJson.filter(d => d.driveStatus === "completed").length,
  });
});

// ─── API: Drives for a specific date (JSON) ─────────────────────────────────
// Used by the calendar JS to populate the detail panel without a page reload.
router.get("/admin/calendar/drives-on-date/", async (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: "Invalid date format. Use YYYY-MM-DD." });
  }

  const drives = await PlacementDrive.findAll({
    where: { interviewDate: date },
    include: [{ model: Company, as: "company" }],
    order: [["id", "ASC"]],
  });

  // Enrich each drive: shortlist count + already-shortlisted student count
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const enriched = await Promise.all(drives.map(async (d) => {
    const obj = d.toJSON();

    // Auto-derive status
    const dt = new Date(obj.interviewDate); dt.setHours(0, 0, 0, 0);
    if (dt.getTime() === today.getTime()) obj.driveStatus = "ongoing";
    else if (dt < today)                  obj.driveStatus = "completed";
    else                                   obj.driveStatus = "upcoming";

    // Count shortlisted students
    const shortlists = await Shortlist.findAll({
      where: { driveId: d.id },
      attributes: ["id"],
    });
    const shortlistIds = shortlists.map(s => s.id);
    let shortlistedCount = 0;
    if (shortlistIds.length > 0) {
      shortlistedCount = await ShortlistStudent.count({
        where: { shortlistId: { [Op.in]: shortlistIds } },
      });
    }

    obj.shortlistedCount  = shortlistedCount;
    obj.shortlistCount    = shortlists.length;
    return obj;
  }));

  return res.json({ success: true, date, drives: enriched });
});

// ─── API: All drive dates for a given year (for year-view dot rendering) ────
router.get("/admin/calendar/drive-dates/", async (req, res) => {
  const year = parseInt(req.query.year, 10);
  if (!year) return res.status(400).json({ success: false, error: "year is required." });

  const drives = await PlacementDrive.findAll({
    where: { interviewDate: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } },
    attributes: ["id", "interviewDate", "driveStatus", "jobRole"],
    include: [{ model: Company, as: "company", attributes: ["name"] }],
    order: [["interviewDate", "ASC"]],
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const byDate = {};
  for (const d of drives) {
    const key = d.interviewDate;
    const dt  = new Date(key); dt.setHours(0, 0, 0, 0);
    let status = d.driveStatus;
    if (dt.getTime() === today.getTime()) status = "ongoing";
    else if (dt < today)                  status = "completed";
    else                                   status = "upcoming";

    if (!byDate[key]) byDate[key] = [];
    byDate[key].push({ id: d.id, companyName: d.company?.name, jobRole: d.jobRole, driveStatus: status });
  }

  return res.json({ success: true, year, byDate });
});

module.exports = router;
