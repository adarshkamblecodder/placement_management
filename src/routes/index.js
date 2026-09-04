/**
 * Route Compatibility Registry
 *
 * This file is intentionally thin. All route logic has been extracted into
 * `src/modules/<domain>/routes/*` and is mounted here at the same URL paths
 * the application has always used. Keeping this file as the single mount
 * point lets us evolve internal structure without breaking external URLs.
 */

const express = require("express");

const { requireAdmin } = require("../shared/middleware/auth");
const { Student, Company } = require("../db/models");

// Domain modules (each exposes `routes`)
const authModule = require("../modules/auth");
const studentModule = require("../modules/student");
const adminModule = require("../modules/admin");
const settingsRoutes = require("../modules/admin/settings/routes/settings.routes.js");

const router = express.Router();

// ─── Root redirect (entry point routing) ────────────────────────────────
router.get("/", (req, res) => {
  const u = req.session?.user;
  if (!u) return res.redirect("/login/");
  if (u.isStaff) return res.redirect("/admin-dashboard/");
  return res.redirect("/student/profile/");
});

router.get("/admin-dashboard/", requireAdmin, async (req, res) => {
  const { q, skills } = req.query;

  const total_students = await Student.count();
  const total_companies = await Company.count();
  const placed_students = await Student.count({
    where: { placement_status: "Placed" },
  });

  const placement_percentage =
    total_students > 0
      ? Math.round((placed_students / total_students) * 100 * 100) / 100
      : 0;

  const deptCounts = { CS: 0, AIML: 0, AIDS: 0, MBA: 0 };
  const deptPlaced = { CS: 0, AIML: 0, AIDS: 0, MBA: 0 };

  const studentsAll = await Student.findAll({ attributes: ["branch", "placement_status"] });
  for (const s of studentsAll) {
    const b = (s.branch || "").toUpperCase().trim();
    if (b) {
      deptCounts[b] = (deptCounts[b] || 0) + 1;
      if (s.placement_status === "Placed") {
        deptPlaced[b] = (deptPlaced[b] || 0) + 1;
      }
    }
  }

  return res.render("tracker/dashboard.html", {
    total_students,
    total_companies,
    placed_students,
    placement_percentage,
    deptCounts,
    deptPlaced,
    search_q: q || "",
    search_skills: skills || "",
  });
});

// Financial Advisory & Planner module
const financialModule = require("../modules/financial");

// ─── Mount module routers (URLs unchanged) ──────────────────────────────
router.use("/", authModule.routes);
router.use("/", studentModule.routes);
router.use("/", studentModule.internshipRoutes);
router.use("/", studentModule.projectRoutes);
router.use("/", financialModule.routes);

// Admin subdomains (each is a self-contained Express router)
router.use("/", adminModule.students.routes);
router.use("/", adminModule.companies.routes);
router.use("/", adminModule.jobs.routes);

router.use("/", adminModule.placed.routes);
router.use("/", adminModule.reports.routes);
router.use("/", adminModule.shortlists.routes);
router.use("/", adminModule.auditLog.routes);
router.use("/", adminModule.notifications.routes);
router.use("/", adminModule.calendar.routes);
router.use("/", settingsRoutes);
router.use("/", require("../modules/admin/students/routes/admin_internship.routes"));

// Mounted under namespaces
router.use("/admin/interview-rounds", adminModule.interviewRounds.routes);
router.use("/admin/student-logins", adminModule.studentLogins.routes);

// ─── 404 catch-all ──────────────────────────────────────────────────────────
// S-10 FIX: Express has no default 404 handler that matches the app's styling.
// Any unmatched URL (broken link, stale bookmark, typo) falls through to here
// and returns a styled error page instead of Express's plain-text default.
router.use((req, res) => {
  // Respect JSON clients (fetch calls that hit a dead endpoint)
  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    return res.status(404).json({ error: "Not found", path: req.path });
  }
  return res.status(404).render("tracker/error.html", {
    status: 404,
    error_title: "404 — Page Not Found",
    error_message: `The path "${req.path}" does not exist. Check the URL or use the sidebar to navigate.`,
  });
});

module.exports = router;
