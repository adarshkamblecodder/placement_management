const express = require("express");
const { Op } = require("sequelize");
const { Job, Company, Application, Student } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");

const router = express.Router();
router.use(requireAdmin);

router.get("/jobs/:id/", async (req, res) => {
  const job = await Job.findByPk(req.params.id, {
    include: [{ model: Company }],
  });
  if (!job) return res.status(404).send("Drive Not Found");

  const applications = await Application.findAll({
    where: { job_id: job.id },
    order: [["id", "DESC"]],
  });

  const studentIds = applications.map((a) => a.student_id);
  const students = await Student.findAll({
    where: { student_id: { [Op.in]: studentIds } },
  });

  const studentMap = {};
  students.forEach((s) => (studentMap[s.student_id] = s));

  const applicationsWithStudents = applications.map((app) => {
    return {
      ...app.toJSON(),
      student: studentMap[app.student_id] || { name: "Unknown", student_id: app.student_id },
    };
  });

  const availableStudents = await Student.findAll({
    where: {
      student_id: { [Op.notIn]: studentIds.length ? studentIds : ["__dummy__"] },
    },
    order: [
      ["year", "DESC"],
      ["branch", "ASC"],
      ["cgpa", "DESC"],
    ],
  });

  return res.render("tracker/job_dashboard.html", {
    job,
    applications: applicationsWithStudents,
    availableStudents,
  });
});

router.post("/jobs/:id/shortlist/", async (req, res) => {
  const job = await Job.findByPk(req.params.id);
  if (!job) return res.status(404).send("Drive Not Found");

  let studentIds = req.body.student_ids || [];
  if (!Array.isArray(studentIds)) {
    studentIds = [studentIds];
  }

  for (const student_id of studentIds) {
    if (student_id) {
      // BUG-07 FIX: use "Applied" — "Shortlisted" is not in VALID_STATUSES for Application,
      // and the application edit form would silently ignore an unrecognised status value.
      await Application.create({
        job_id: job.id,
        company_id: job.company_id,
        student_id: student_id,
        status: "Applied",
        applied_date: new Date(),
      });
    }
  }

  return res.redirect(`/jobs/${job.id}/`);
});

router.post("/jobs/:job_id/applications/:app_id/update/", async (req, res) => {
  const app = await Application.findByPk(req.params.app_id);
  if (!app) return res.status(404).send("Application Not Found");

  // Job.belongsTo(Company) in models/index.js has no `as` alias, so Sequelize
  // exposes the eager-loaded company as job.Company (JS class name accessor).
  // Using `as: "tracker_company"` (the DB table name) would throw an
  // EagerLoadingError because no matching association alias exists.
  const job = await Job.findByPk(req.params.job_id, {
    include: [{ model: Company }],
  });
  const { status, notes } = req.body;

  await app.update({
    status: status || app.status,
    notes: notes || app.notes,
  });

  if (status === "Selected") {
    const student = await Student.findByPk(app.student_id);
    if (student) {
      const companyName = job?.Company?.name || "Unknown Company";
      await student.update({
        placement_status:  "Placed",
        placement_company: companyName,
        placement_package: job.package_lpa || student.placement_package,
        // S-05 FIX: always use the current calendar year as placement_year.
        // student.year holds the academic year ("1","2","3","4") which is not
        // a valid placement year and corrupts the Placed Students / Reports filters.
        placement_year:    new Date().getFullYear().toString(),
      });
    }
  }

  return res.redirect(`/jobs/${req.params.job_id}/`);
});

router.post("/jobs/:job_id/applications/:app_id/delete/", async (req, res) => {
  const app = await Application.findByPk(req.params.app_id);
  if (app) {
    await app.destroy();
  }
  return res.redirect(`/jobs/${req.params.job_id}/`);
});

module.exports = router;
