const express = require("express");
const { Op } = require("sequelize");
const { Company, PlacementDrive, InterviewRound, Job, Shortlist, ShortlistStudent, StudentRoundResult } = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");
const { addMessage } = require("../../../../shared/middleware/flash");
const { notifyNewJobPosted } = require("../../../../shared/services/notification.service");
const { recordAuditLog } = require("../../../../shared/services/audit.service");

const router = express.Router();
router.use(requireAdmin);

function parseDrives(body) {
  if (body && body.drives) {
    const d = body.drives;
    if (Array.isArray(d)) return d;
    if (typeof d === "object") return Object.values(d);
  }

  const drives = {};
  for (const key of Object.keys(body)) {
    const m = key.match(/^drives\[(\d+)\]\[(\w+)\]$/);
    if (!m) continue;
    const [, idx, field] = m;
    if (!drives[idx]) drives[idx] = {};
    drives[idx][field] = body[key];
  }
  return Object.values(drives);
}

function validateDrive(drive, idx, { requireFutureDate } = { requireFutureDate: true }) {
  const errors = [];
  const label = `Drive #${Number(idx) + 1}`;

  if (!drive.jobRole || !drive.jobRole.trim())
    errors.push(`${label}: Job Role is required.`);

  if (!drive.driveLocation || !String(drive.driveLocation).trim())
    errors.push(`${label}: Drive Location is required.`);

  if (!drive.interviewDate)
    errors.push(`${label}: Interview Date is required.`);
  else {
    const dt = new Date(drive.interviewDate);
    if (Number.isNaN(dt.getTime())) {
      errors.push(`${label}: Interview Date is invalid.`);
    } else if (requireFutureDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dt.setHours(0, 0, 0, 0);
      if (dt < today) errors.push(`${label}: Interview Date must be today or a future date.`);
    }
  }

  const openings = Number(drive.numberOfOpenings);
  if (!drive.numberOfOpenings || isNaN(openings) || openings < 1)
    errors.push(`${label}: Number of Openings must be at least 1.`);

  const cgpa = Number(drive.minCGPA);
  if (drive.minCGPA === undefined || drive.minCGPA === "" || isNaN(cgpa))
    errors.push(`${label}: Min CGPA is required.`);
  else if (cgpa < 0 || cgpa > 10)
    errors.push(`${label}: Min CGPA must be between 0.0 and 10.0.`);

  return errors;
}

router.get("/companies/", async (req, res) => {
  const { q } = req.query;
  const where = {};
  if (q) where.name = { [Op.iLike]: `%${q}%` };

  const companies = await Company.findAll({ where });

  for (const company of companies) {
    // S-07 FIX: replaced company.countTracker_jobs() with an explicit Job.count()
    // query. The auto-generated Sequelize counter method name derives from the
    // model's internal table name ("tracker_job" → "countTracker_jobs") and is
    // a fragile implementation detail — if the model name ever changes this
    // throws a silent TypeError. An explicit count is readable and stable.
    const jobCount   = await Job.count({ where: { company_id: company.id } });
    const driveCount = await company.countDrives();
    company.job_count   = jobCount;
    company.drive_count = driveCount;
  }

  // JSON response for dynamic search (fetch requests)
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({
      companies: companies.map(c => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        hr_contact: c.hr_contact,
        tier: c.tier,
        rating: c.rating,
        website: c.website,
        drive_count: c.drive_count || 0,
      }))
    });
  }

  return res.render("tracker/companies/list.html", {
    object_list: companies,
    query: req.query,
  });
});

router.get("/companies/add/", (req, res) => {
  return res.render("tracker/companies/add.html", {
    company: {},
    drives: [],
    errors: [],
  });
});

router.post("/companies/add/", async (req, res) => {
  const { name, industry, website, hr_contact } = req.body;
  const drives = parseDrives(req.body);

  const errors = [];
  if (!name || !name.trim()) errors.push("Company Name is required.");

  drives.forEach((drive, i) => {
    errors.push(...validateDrive(drive, i, { requireFutureDate: true }));
  });

  if (errors.length > 0) {
    return res.render("tracker/companies/add.html", {
      company: { name, industry, website, hr_contact },
      drives,
      errors,
    });
  }

  const company = await Company.create({ name, industry, website, hr_contact });

  for (const drive of drives) {
    const createdDrive = await PlacementDrive.create({
      companyId: company.id,
      jobRole: drive.jobRole,
      jobDescription: drive.jobDescription || null,
      driveLocation: drive.driveLocation || null,
      interviewDate: drive.interviewDate,
      numberOfOpenings: Number(drive.numberOfOpenings),
      minCGPA: Number(drive.minCGPA),
      eligibleBranches: drive.eligibleBranches || null,
      packageLPA: drive.packageLPA ? Number(drive.packageLPA) : null,
      driveStatus: drive.driveStatus || "upcoming",
    });
    notifyNewJobPosted({ drive: createdDrive, company });
  }

  addMessage(req, { type: "success", text: `Company "${company.name}" added successfully!` });
  return res.redirect("/companies/");
});

router.get("/companies/:id/", async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).send("Company not found");

  const drives = await PlacementDrive.findAll({
    where: { companyId: company.id },
    include: [{ model: InterviewRound, as: 'rounds' }],
    order: [
      ["interviewDate", "ASC"],
      [{ model: InterviewRound, as: 'rounds' }, "order", "ASC"]
    ],
  });

  const drivesJson = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (const drive of drives) {
    const d = drive.toJSON();
    const shortlistCount = await Shortlist.count({ where: { driveId: drive.id } });
    d.hasShortlist = shortlistCount > 0;

    // Auto-derive driveStatus from interviewDate — keeps it accurate without manual updates
    if (drive.interviewDate) {
      const dt = new Date(drive.interviewDate); dt.setHours(0, 0, 0, 0);
      if (dt.getTime() === today.getTime()) d.driveStatus = "ongoing";
      else if (dt < today) d.driveStatus = "completed";
      else d.driveStatus = "upcoming";
      // Persist auto-derived status to DB if it changed
      if (d.driveStatus !== drive.driveStatus) {
        drive.update({ driveStatus: d.driveStatus }).catch(() => {});
      }
    }

    drivesJson.push(d);
  }

  // Sort drives by status group: upcoming → ongoing → completed.
  // Within each group keep the existing interviewDate ASC order from the SQL query.
  const STATUS_ORDER = { upcoming: 0, ongoing: 1, completed: 2 };
  drivesJson.sort((a, b) => {
    const ga = STATUS_ORDER[a.driveStatus] ?? 2;
    const gb = STATUS_ORDER[b.driveStatus] ?? 2;
    if (ga !== gb) return ga - gb;
    // Same group — preserve original interviewDate ASC order (stable sort in V8 ≥ Node 11)
    return 0;
  });

  const driveStats = {
    total:     drivesJson.length,
    upcoming:  drivesJson.filter((d) => d.driveStatus === "upcoming").length,
    ongoing:   drivesJson.filter((d) => d.driveStatus === "ongoing").length,
    completed: drivesJson.filter((d) => d.driveStatus === "completed").length,
  };

  const jobs = await company.getTracker_jobs({ order: [["createdAt", "DESC"]] });

  return res.render("tracker/companies/detail.html", { company, drives: drivesJson, jobs, driveStats });
});

router.post("/companies/:id/drives/add/", async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).send("Company not found");

  let eligibleBranches = req.body.eligibleBranches;
  if (Array.isArray(eligibleBranches)) eligibleBranches = eligibleBranches.join(',');

  let technicalSkills = req.body.technicalSkills;
  if (Array.isArray(technicalSkills)) technicalSkills = technicalSkills.join(',');

  const drive = {
    jobRole: req.body.jobRole,
    jobDescription: req.body.jobDescription,
    driveLocation: req.body.driveLocation,
    interviewDate: req.body.interviewDate,
    numberOfOpenings: req.body.numberOfOpenings,
    minCGPA: req.body.minCGPA,
    eligibleBranches: eligibleBranches,
    technicalSkills: technicalSkills,
    packageLPA: req.body.packageLPA,
    driveStatus: req.body.driveStatus,
  };

  const errors = validateDrive(drive, 0, { requireFutureDate: true });
  if (errors.length > 0) {
    errors.forEach((e) => addMessage(req, { type: "danger", text: e }));
    return res.redirect(`/companies/${company.id}/`);
  }

  const createdDrive = await PlacementDrive.create({
    companyId: company.id,
    jobRole: drive.jobRole,
    jobDescription: drive.jobDescription || null,
    driveLocation: drive.driveLocation || null,
    interviewDate: drive.interviewDate,
    numberOfOpenings: Number(drive.numberOfOpenings),
    minCGPA: Number(drive.minCGPA),
    eligibleBranches: drive.eligibleBranches || null,
    technicalSkills: drive.technicalSkills || null,
    packageLPA: drive.packageLPA ? Number(drive.packageLPA) : null,
    driveStatus: drive.driveStatus || "upcoming",
  });

  notifyNewJobPosted({ drive: createdDrive, company });

  addMessage(req, { type: "success", text: "Placement Drive added successfully!" });
  return res.redirect(`/companies/${company.id}/`);
});

router.post("/companies/:id/drives/:driveId/edit/", async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).send("Company not found");

  const drive = await PlacementDrive.findOne({
    where: { id: req.params.driveId, companyId: req.params.id },
  });
  if (!drive) {
    addMessage(req, { type: "danger", text: "Drive not found." });
    return res.redirect(`/companies/${company.id}/`);
  }

  // Backend guard: completed drives cannot be edited
  if (drive.driveStatus === "completed") {
    addMessage(req, { type: "danger", text: "This action is unavailable for completed drives." });
    return res.redirect(`/companies/${company.id}/`);
  }

  let eligibleBranches = req.body.eligibleBranches;
  if (Array.isArray(eligibleBranches)) eligibleBranches = eligibleBranches.join(',');

  let technicalSkills = req.body.technicalSkills;
  if (Array.isArray(technicalSkills)) technicalSkills = technicalSkills.join(',');

  const updatedDriveData = {
    jobRole: req.body.jobRole,
    jobDescription: req.body.jobDescription,
    driveLocation: req.body.driveLocation,
    interviewDate: req.body.interviewDate,
    numberOfOpenings: req.body.numberOfOpenings,
    minCGPA: req.body.minCGPA,
    eligibleBranches: eligibleBranches,
    technicalSkills: technicalSkills,
    packageLPA: req.body.packageLPA,
    driveStatus: req.body.driveStatus,
  };

  const errors = validateDrive(updatedDriveData, 0, { requireFutureDate: false });
  if (errors.length > 0) {
    errors.forEach((e) => addMessage(req, { type: "danger", text: e }));
    return res.redirect(`/companies/${company.id}/`);
  }

  await drive.update({
    jobRole: updatedDriveData.jobRole,
    jobDescription: updatedDriveData.jobDescription || null,
    driveLocation: updatedDriveData.driveLocation || null,
    interviewDate: updatedDriveData.interviewDate,
    numberOfOpenings: Number(updatedDriveData.numberOfOpenings),
    minCGPA: Number(updatedDriveData.minCGPA),
    eligibleBranches: updatedDriveData.eligibleBranches || null,
    technicalSkills: updatedDriveData.technicalSkills || null,
    packageLPA: updatedDriveData.packageLPA ? Number(updatedDriveData.packageLPA) : null,
    driveStatus: updatedDriveData.driveStatus || "upcoming",
  });

  addMessage(req, { type: "success", text: "Placement Drive updated successfully!" });
  return res.redirect(`/companies/${company.id}/`);
});

router.post("/companies/:id/drives/:driveId/delete/", async (req, res) => {
  const drive = await PlacementDrive.findOne({
    where: { id: req.params.driveId, companyId: req.params.id },
  });

  if (!drive) {
    addMessage(req, { type: "danger", text: "Drive not found." });
    return res.redirect(`/companies/${req.params.id}/`);
  }

  // BUG-01 FIX: cascade-delete all dependent rows before removing the drive
  // to avoid orphan InterviewRound, StudentRoundResult, Shortlist, ShortlistStudent records.
  const tx = await PlacementDrive.sequelize.transaction();
  try {
    const rounds = await InterviewRound.findAll({
      where: { driveId: drive.id },
      attributes: ["id"],
      transaction: tx,
    });
    const roundIds = rounds.map((r) => r.id);

    if (roundIds.length > 0) {
      await StudentRoundResult.destroy({ where: { roundId: roundIds }, transaction: tx });
    }
    await InterviewRound.destroy({ where: { driveId: drive.id }, transaction: tx });

    const shortlists = await Shortlist.findAll({
      where: { driveId: drive.id },
      attributes: ["id"],
      transaction: tx,
    });
    const shortlistIds = shortlists.map((s) => s.id);

    if (shortlistIds.length > 0) {
      await ShortlistStudent.destroy({ where: { shortlistId: shortlistIds }, transaction: tx });
    }
    await Shortlist.destroy({ where: { driveId: drive.id }, transaction: tx });

    await drive.destroy({ transaction: tx });
    await tx.commit();
    addMessage(req, { type: "success", text: "Drive deleted." });
  } catch (err) {
    await tx.rollback();
    console.error("drive delete error:", err);
    addMessage(req, { type: "danger", text: "Could not delete drive." });
  }

  return res.redirect(`/companies/${req.params.id}/`);
});

router.get("/companies/:id/edit/", async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).send("Company not found");

  const drives = await PlacementDrive.findAll({
    where: { companyId: company.id },
    order: [["interviewDate", "ASC"]],
  });

  return res.render("tracker/companies/edit.html", {
    company,
    drives,
    errors: [],
  });
});

router.post("/companies/:id/edit/", async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).send("Company not found");

  const { name, industry, website, hr_contact } = req.body;
  const newDrives = parseDrives(req.body);
  const existingIds = [].concat(req.body["existingDriveIds"] || []);

  let patches = {};
  if (req.body && req.body.existingDrive && typeof req.body.existingDrive === "object") {
    patches = req.body.existingDrive;
  } else {
    for (const key of Object.keys(req.body)) {
      const m = key.match(/^existingDrive\[(\d+)\]\[(\w+)\]$/);
      if (!m) continue;
      const [, id, field] = m;
      if (!patches[id]) patches[id] = {};
      patches[id][field] = req.body[key];
    }
  }

  const errors = [];
  if (!name || !name.trim()) errors.push("Company Name is required.");

  newDrives.forEach((d, i) => errors.push(...validateDrive(d, i, { requireFutureDate: true })));

  Object.entries(patches).forEach(([id, d], i) => {
    errors.push(
      ...validateDrive(d, i, { requireFutureDate: false }).map((e) =>
        e.replace("Drive #1", `Drive (ID ${id})`)
      )
    );
  });

  if (errors.length > 0) {
    const drives = await PlacementDrive.findAll({
      where: { companyId: company.id },
      order: [["interviewDate", "ASC"]],
    });
    return res.render("tracker/companies/edit.html", {
      company: { ...company.toJSON(), name, industry, website, hr_contact },
      drives,
      errors,
    });
  }

  await company.update({ name, industry, website, hr_contact });

  const allDrives = await PlacementDrive.findAll({ where: { companyId: company.id } });
  for (const d of allDrives) {
    if (!existingIds.includes(String(d.id))) {
      await d.destroy();
    }
  }

  for (const [id, patch] of Object.entries(patches)) {
    const d = await PlacementDrive.findOne({ where: { id, companyId: company.id } });
    if (!d) continue;
    await d.update({
      jobRole: patch.jobRole,
      jobDescription: patch.jobDescription || null,
      driveLocation: patch.driveLocation || null,
      interviewDate: patch.interviewDate,
      numberOfOpenings: Number(patch.numberOfOpenings),
      minCGPA: Number(patch.minCGPA),
      eligibleBranches: patch.eligibleBranches || null,
      technicalSkills: patch.technicalSkills || null,
      packageLPA: patch.packageLPA ? Number(patch.packageLPA) : null,
      driveStatus: patch.driveStatus || "upcoming",
    });
  }

  for (const drive of newDrives) {
    await PlacementDrive.create({
      companyId: company.id,
      jobRole: drive.jobRole,
      jobDescription: drive.jobDescription || null,
      driveLocation: drive.driveLocation || null,
      interviewDate: drive.interviewDate,
      numberOfOpenings: Number(drive.numberOfOpenings),
      minCGPA: Number(drive.minCGPA),
      eligibleBranches: drive.eligibleBranches || null,
      technicalSkills: drive.technicalSkills || null,
      packageLPA: drive.packageLPA ? Number(drive.packageLPA) : null,
      driveStatus: drive.driveStatus || "upcoming",
    });
  }

  addMessage(req, { type: "success", text: `Company "${company.name}" updated successfully!` });
  return res.redirect(`/companies/${company.id}/`);
});

router.get("/companies/:pk/delete/", async (req, res) => {
  const company = await Company.findByPk(req.params.pk);
  if (!company) return res.status(404).send("Not found");
  return res.render("tracker/company_confirm_delete.html", { object: company });
});

router.post("/companies/:pk/delete/", async (req, res) => {
  const company = await Company.findByPk(req.params.pk);
  if (!company) return res.status(404).send("Not found");

  const companyName = company.name;
  const companyId = company.id;

  // BUG-02 FIX: cascade-delete dependent rows for all drives of this company
  // before removing drives and the company itself.
  const drives = await PlacementDrive.findAll({
    where: { companyId: company.id },
    attributes: ["id"],
  });
  const driveIds = drives.map((d) => d.id);

  if (driveIds.length > 0) {
    const rounds = await InterviewRound.findAll({
      where: { driveId: driveIds },
      attributes: ["id"],
    });
    const roundIds = rounds.map((r) => r.id);
    if (roundIds.length > 0) {
      await StudentRoundResult.destroy({ where: { roundId: roundIds } });
    }
    await InterviewRound.destroy({ where: { driveId: driveIds } });

    const shortlists = await Shortlist.findAll({
      where: { driveId: driveIds },
      attributes: ["id"],
    });
    const shortlistIds = shortlists.map((s) => s.id);
    if (shortlistIds.length > 0) {
      await ShortlistStudent.destroy({ where: { shortlistId: shortlistIds } });
    }
    await Shortlist.destroy({ where: { driveId: driveIds } });
  }

  await PlacementDrive.destroy({ where: { companyId: company.id } });
  await company.destroy();

  await recordAuditLog({
    adminId: req.session?.user?.id,
    action: "DELETE_COMPANY",
    targetTable: "tracker_company",
    targetId: companyId,
    details: `Deleted company "${companyName}" and its placement drives`,
  });

  addMessage(req, { type: "success", text: `Company "${companyName}" deleted successfully.` });
  return res.redirect("/companies/");
});

// ─── Delete All Companies (POST bulk action) ──────────────────────────────
router.post("/companies/delete-all/", async (req, res) => {
  const count = await Company.count();
  if (count === 0) {
    addMessage(req, { type: "info", text: "No companies to delete." });
    return res.redirect("/companies/");
  }

  // BUG-02 FIX: wipe all dependent rows in FK order before removing drives and companies.
  const allRounds = await InterviewRound.findAll({ attributes: ["id"] });
  const roundIds  = allRounds.map((r) => r.id);
  if (roundIds.length > 0) {
    await StudentRoundResult.destroy({ where: { roundId: roundIds } });
  }
  await InterviewRound.destroy({ where: {} });

  const allShortlists = await Shortlist.findAll({ attributes: ["id"] });
  const shortlistIds  = allShortlists.map((s) => s.id);
  if (shortlistIds.length > 0) {
    await ShortlistStudent.destroy({ where: { shortlistId: shortlistIds } });
  }
  await Shortlist.destroy({ where: {} });

  await PlacementDrive.destroy({ where: {} });
  await Company.destroy({ where: {} });

  await recordAuditLog({
    adminId: req.session?.user?.id,
    action: "DELETE_ALL_COMPANIES",
    targetTable: "tracker_company",
    details: `Bulk deleted all ${count} companies and all placement drives`,
  });

  addMessage(req, { type: "warning", text: `Successfully deleted all ${count} company records and associated drives.` });
  return res.redirect("/companies/");
});

module.exports = router;
