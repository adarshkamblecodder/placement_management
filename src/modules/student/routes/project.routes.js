const express = require("express");
const { requireStudent }  = require("../middleware/requireStudent");
const { verifyCsrf }      = require("../../../shared/middleware/csrf");
const { addMessage }      = require("../../../shared/middleware/flash");
const { Student, StudentProject } = require("../../../db/models");
const { recordAuditLog }  = require("../../../shared/services/audit.service");

const router = express.Router();

// ── Helper: get current student ──────────────────────────────────────────
async function getStudent(req) {
  return Student.findOne({ where: { user_id: req.session.user.id } });
}

// ── Helper: compute duration string ──────────────────────────────────────
function computeDuration(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s) || isNaN(e) || e < s) return null;
  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days  = e.getDate()  - s.getDate();
  if (days   < 0) { months--; days  += new Date(e.getFullYear(), e.getMonth(), 0).getDate(); }
  if (months < 0) { years--;  months += 12; }
  const parts = [];
  if (years  > 0) parts.push(`${years} year${years  > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  if (days   > 0) parts.push(`${days} day${days   > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" ") : "Less than a day";
}

// ── Helper: build payload from req.body ───────────────────────────────────
function buildPayload(body, studentId) {
  const { startDate, endDate } = body;
  return {
    studentId,
    projectType:          body.projectType === "LIVE" ? "LIVE" : "NORMAL",
    title:                (body.title               || "").trim(),
    domain:               (body.domain              || "").trim() || null,
    description:          (body.description         || "").trim() || null,
    technologiesUsed:     (body.technologiesUsed    || "").trim() || null,
    role:                 (body.role                || "").trim() || null,
    startDate:            startDate  || null,
    endDate:              endDate    || null,
    duration:             (startDate && endDate) ? computeDuration(startDate, endDate) : ((body.duration || "").trim() || null),
    projectStatus:        ["Ongoing","Completed","On Hold"].includes(body.projectStatus) ? body.projectStatus : "Completed",
    projectUrl:           (body.projectUrl          || "").trim() || null,
    githubUrl:            (body.githubUrl           || "").trim() || null,
    teamSize:             body.teamSize ? Number(body.teamSize) : null,
    teamMembers:          (body.teamMembers         || "").trim() || null,
    clientOrOrganization: (body.clientOrOrganization|| "").trim() || null,
  };
}

// ── Validate ──────────────────────────────────────────────────────────────
function validate(body) {
  const errors = [];
  if (!body.title?.trim())       errors.push("Project Title is required.");
  if (!body.projectType || !["LIVE","NORMAL"].includes(body.projectType))
    errors.push("Project Type is required — select Live Project or Normal Project.");
  if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate))
    errors.push("End Date cannot be before Start Date.");
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/projects/         — list
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/projects/", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const projects = await StudentProject.findAll({
      where:  { studentId: student.student_id },
      order:  [["createdAt", "DESC"]],
    });

    return res.render("tracker/student_projects.html", {
      student,
      projects: projects.map(p => p.toJSON()),
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/projects/add/     — blank form
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/projects/add/", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");
    return res.render("tracker/student_project_form.html", {
      student,
      project:    null,
      formAction: "/student/projects/add/",
      formTitle:  "Add Project",
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /student/projects/add/     — create
// ═══════════════════════════════════════════════════════════════════════════
router.post("/student/projects/add/", requireStudent, verifyCsrf, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const errors = validate(req.body);
    if (errors.length) {
      errors.forEach(e => addMessage(req, { type: "danger", text: e }));
      return res.redirect("/student/projects/add/");
    }

    await StudentProject.create(buildPayload(req.body, student.student_id));
    await recordAuditLog({
      adminId: student.student_id,
      action: "STUDENT_PROJECT_ADDED",
      targetTable: "tracker_student_project",
      targetId: student.student_id,
      details: `Student "${student.name}" added a ${req.body.projectType === "LIVE" ? "Live" : "Academic"} project: "${req.body.title}".`,
    });
    addMessage(req, { type: "success", text: "Project added successfully." });
    return res.redirect("/student/projects/");
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET  /student/projects/:id/edit/  — pre-filled edit form
// ═══════════════════════════════════════════════════════════════════════════
router.get("/student/projects/:id/edit/", requireStudent, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const project = await StudentProject.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!project) return res.status(404).send("Project not found.");

    return res.render("tracker/student_project_form.html", {
      student,
      project:    project.toJSON(),
      formAction: `/student/projects/${project.id}/edit/`,
      formTitle:  "Edit Project",
    });
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /student/projects/:id/edit/  — update
// ═══════════════════════════════════════════════════════════════════════════
router.post("/student/projects/:id/edit/", requireStudent, verifyCsrf, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const project = await StudentProject.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!project) return res.status(404).send("Project not found.");

    const errors = validate(req.body);
    if (errors.length) {
      errors.forEach(e => addMessage(req, { type: "danger", text: e }));
      return res.redirect(`/student/projects/${project.id}/edit/`);
    }

    await project.update(buildPayload(req.body, student.student_id));
    await recordAuditLog({
      adminId: student.student_id,
      action: "STUDENT_PROJECT_UPDATED",
      targetTable: "tracker_student_project",
      targetId: student.student_id,
      details: `Student "${student.name}" updated project: "${req.body.title}".`,
    });
    addMessage(req, { type: "success", text: "Project updated successfully." });
    return res.redirect("/student/projects/");
  } catch (err) { return next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /student/projects/:id/delete/  — delete
// ═══════════════════════════════════════════════════════════════════════════
router.post("/student/projects/:id/delete/", requireStudent, verifyCsrf, async (req, res, next) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.redirect("/login/");

    const project = await StudentProject.findOne({
      where: { id: req.params.id, studentId: student.student_id },
    });
    if (!project) {
      addMessage(req, { type: "danger", text: "Project not found." });
      return res.redirect("/student/projects/");
    }

    await project.destroy();
    await recordAuditLog({
      adminId: student.student_id,
      action: "STUDENT_PROJECT_DELETED",
      targetTable: "tracker_student_project",
      targetId: student.student_id,
      details: `Student "${student.name}" deleted project: "${project.title}" (${project.projectType}).`,
    });
    addMessage(req, { type: "success", text: "Project deleted." });
    return res.redirect("/student/projects/");
  } catch (err) { return next(err); }
});

module.exports = router;
