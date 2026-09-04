const express = require("express");
const { Op } = require("sequelize");
const {
  Student,
  StudentProfile,
  AuditLog,
  Resume,
} = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");
const { computeCompletion } = require("../../../student/services/studentProfile.service");

const router = express.Router();
router.use(requireAdmin);

// Action label map — converts DB action codes into human-readable labels
const ACTION_LABELS = {
  STUDENT_PROFILE_UPDATED:   { label: "Profile Updated",     icon: "fa-user-edit",     color: "primary" },
  STUDENT_RESUME_UPLOADED:   { label: "Resume Uploaded",     icon: "fa-file-upload",   color: "success" },
  STUDENT_PROJECT_ADDED:     { label: "Project Added",       icon: "fa-diagram-project", color: "info" },
  STUDENT_PROJECT_UPDATED:   { label: "Project Updated",     icon: "fa-diagram-project", color: "info" },
  STUDENT_INTERNSHIP_ADDED:  { label: "Internship Added",    icon: "fa-laptop-code",   color: "warning" },
  STUDENT_INTERNSHIP_UPDATED:{ label: "Internship Updated",  icon: "fa-laptop-code",   color: "warning" },
};

const STUDENT_ACTIONS = Object.keys(ACTION_LABELS);

// ─── Notifications / Student Activity Feed (GET) ──────────────────────────
router.get("/admin/notifications/", async (req, res) => {
  const { branch, q, min_completion, action_filter, page } = req.query;

  // ── Student list (left panel) ─────────────────────────────────────────
  const studentWhere = {};
  if (branch) studentWhere.branch = branch;
  if (q) {
    studentWhere[Op.or] = [
      { name:       { [Op.like]: `%${q}%` } },
      { student_id: { [Op.like]: `%${q}%` } },
      { email:      { [Op.like]: `%${q}%` } },
    ];
  }

  const students = await Student.findAll({
    where: studentWhere,
    include: [
      { model: StudentProfile, as: "profile" },
      { model: Resume, as: "resumes", where: { isActive: true }, required: false },
    ],
    order: [["student_id", "ASC"]],
  });

  const studentListWithCompletion = students.map((s) => {
    const activeResume = s.resumes && s.resumes[0];
    const completion = computeCompletion({ student: s, profile: s.profile, activeResume });

    const missingFields = [];
    if (!s.profile_photo) missingFields.push("Photo");
    if (!activeResume && !s.resume_link) missingFields.push("Resume");
    if (!s.skills) missingFields.push("Skills");
    if (!s.date_of_birth) missingFields.push("DoB");
    if (!s.phone_number) missingFields.push("Phone");
    if (s.profile && !s.profile.tenthPercentage) missingFields.push("10th %");
    if (s.profile && !s.profile.twelfthPercentage) missingFields.push("12th %");

    return {
      student_id:       s.student_id,
      name:             s.name,
      email:            s.email,
      branch:           s.branch,
      year:             s.year,
      placement_status: s.placement_status,
      completion,
      missingFields,
    };
  });

  const filteredStudents = min_completion
    ? studentListWithCompletion.filter((s) => s.completion >= Number(min_completion))
    : studentListWithCompletion;

  // ── Activity feed (right panel) ───────────────────────────────────────
  const ITEMS_PER_PAGE = 30;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const activityWhere = {
    action: { [Op.in]: STUDENT_ACTIONS },
  };
  if (action_filter && STUDENT_ACTIONS.includes(action_filter)) {
    activityWhere.action = action_filter;
  }

  // Count AFTER applying the filter so totalPages matches the filtered result set.
  const totalActivity = await AuditLog.count({ where: activityWhere });
  const totalPages    = Math.max(1, Math.ceil(totalActivity / ITEMS_PER_PAGE));
  // Clamp page so an out-of-range value (e.g. bookmarked stale URL) doesn't
  // return an empty page instead of the last valid page.
  const safePage      = Math.min(currentPage, totalPages);
  const activityLogs  = await AuditLog.findAll({
    where: activityWhere,
    order: [["timestamp", "DESC"]],
    limit:  ITEMS_PER_PAGE,
    offset: (safePage - 1) * ITEMS_PER_PAGE,
  });

  const activityFeed = activityLogs.map((log) => ({
    id:         log.id,
    studentId:  log.admin_id,   // we store studentId in admin_id for student events
    action:     log.action,
    label:      ACTION_LABELS[log.action]?.label  || log.action,
    icon:       ACTION_LABELS[log.action]?.icon   || "fa-bell",
    color:      ACTION_LABELS[log.action]?.color  || "secondary",
    details:    log.details,
    timestamp:  log.timestamp,
  }));

  return res.render("tracker/notifications.html", {
    students:            filteredStudents,
    query:               req.query,
    totalCount:          students.length,
    highCompletionCount: studentListWithCompletion.filter((s) => s.completion >= 80).length,
    lowCompletionCount:  studentListWithCompletion.filter((s) => s.completion < 50).length,
    activityFeed,
    totalActivity,
    currentPage:  safePage,
    totalPages,
    actionLabels:        ACTION_LABELS,
    action_filter:       action_filter || "",
  });
});

module.exports = router;
