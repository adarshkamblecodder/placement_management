const express = require("express");
const { Op } = require("sequelize");
const {
  Shortlist,
  ShortlistStudent,
  PlacementDrive,
  Company,
  Student,
  InterviewRound,
} = require("../../../../db/models");
const { requireAdmin } = require("../../../../shared/middleware/auth");
const { addMessage } = require("../../../../shared/middleware/flash");
const { notifyStudentShortlisted } = require("../../../../shared/services/notification.service");
const { recordAuditLog } = require("../../../../shared/services/audit.service");

const router = express.Router();
router.use(requireAdmin);

// ─── Save / Create Shortlist (POST) ────────────────────────────────────────
router.post("/shortlists/save", async (req, res) => {
  try {
    const { name, driveId, studentIds } = req.body;

    if (!name || !driveId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, error: "Please select at least one student and a target placement drive." });
    }

    const drive = await PlacementDrive.findByPk(Number(driveId), {
      include: [{ model: Company, as: "company" }],
    });

    if (!drive) {
      return res.status(404).json({ success: false, error: "Selected Placement Drive not found." });
    }

    // Backend guard: shortlisting is not permitted for completed drives
    if (drive.driveStatus === "completed") {
      return res.status(403).json({ success: false, error: "This action is unavailable for completed drives." });
    }

    // numberOfOpenings is the FINAL OFFER cap, not the shortlist cap.
    // A TPO shortlists many more students than openings so the company
    // can eliminate through rounds and fill exactly the openings they need.
    const openings = Number(drive.numberOfOpenings);
    const openingsWarning = (Number.isFinite(openings) && openings > 0 && studentIds.length < openings)
      ? `Note: You shortlisted ${studentIds.length} student(s) but the drive has ${openings} opening(s). Consider shortlisting more candidates.`
      : null;

    const shortlist = await Shortlist.create({
      name: String(name).trim(),
      driveId: Number(driveId),
    });

    const entries = studentIds.map((sid) => ({
      shortlistId: shortlist.id,
      studentId: String(sid),
    }));

    await ShortlistStudent.bulkCreate(entries, { ignoreDuplicates: true });

    // Check CGPA eligibility for each student — build warnings list
    const cgpaWarnings = [];
    if (drive.minCGPA > 0) {
      const studentRecords = await Student.findAll({
        where: { student_id: { [Op.in]: studentIds } },
        attributes: ["student_id", "name", "cgpa"],
      });
      studentRecords.forEach(s => {
        if (s.cgpa !== null && s.cgpa !== undefined && Number(s.cgpa) < drive.minCGPA) {
          cgpaWarnings.push(`${s.name || s.student_id} (CGPA ${Number(s.cgpa).toFixed(2)} < required ${drive.minCGPA})`);
        }
      });
    }

    // Send email notification to shortlisted students and collect results
    const students = await Student.findAll({
      where: { student_id: { [Op.in]: studentIds } },
    });

    let emailsSent = 0;
    let emailsFailed = 0;
    const emailPromises = students.map(async (student) => {
      if (!student.email) { emailsFailed++; return; }
      const result = await notifyStudentShortlisted({
        student,
        drive,
        company: drive.company,
        shortlistName: shortlist.name,
      });
      if (result && result.ok) {
        emailsSent++;
      } else if (result && result.skipped) {
        // SMTP not configured — don't count as a failure
      } else {
        emailsFailed++;
        console.error(`Shortlist email failed for ${student.email}:`, result?.error || "unknown");
      }
    });
    await Promise.all(emailPromises);

    await recordAuditLog({
      adminId: req.session?.user?.id,
      action: "CREATE_SHORTLIST",
      targetTable: "tracker_shortlist",
      targetId: shortlist.id,
      details: `Created shortlist "${shortlist.name}" with ${studentIds.length} candidate(s) for drive "${drive.jobRole}" (${drive.company?.name}). Emails sent: ${emailsSent}, failed: ${emailsFailed}`,
    });

    return res.json({
      success: true,
      shortlistId: shortlist.id,
      emailsSent,
      emailsFailed,
      totalStudents: studentIds.length,
      openings: Number(drive.numberOfOpenings) || null,
      openingsWarning,
      cgpaWarnings: cgpaWarnings.length > 0 ? cgpaWarnings : null,
    });
  } catch (err) {
    console.error("Shortlist save error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Shortlists Index / List (GET) ─────────────────────────────────────────
router.get("/shortlists", async (req, res) => {
  const { StudentRoundResult, InterviewRound } = require("../../../../db/models");
  const { fn, col, literal } = require("sequelize");

  const shortlists = await Shortlist.findAll({
    include: [
      {
        model: PlacementDrive,
        as: "drive",
        include: [
          { model: Company, as: "company" },
          { model: InterviewRound, as: "rounds", required: false },
        ],
      },
      {
        model: Student,
        as: "students",
        through: { attributes: ["status", "statusNote"] },
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  // Build a summary per shortlist: status counts + per-round pass counts
  const enriched = await Promise.all(shortlists.map(async (sl) => {
    const slJson   = sl.toJSON();
    const students = slJson.students || [];
    const rounds   = slJson.drive?.rounds || [];

    // Status summary
    const summary = {
      total: students.length, shortlisted: 0, absent: 0,
      rejected: 0, selected: 0, offerDeclined: 0, withdrawn: 0,
    };
    students.forEach((s) => {
      const st = s.shortlist_student?.status || "Shortlisted";
      if      (st === "Shortlisted")    summary.shortlisted++;
      else if (st === "Absent")         summary.absent++;
      else if (st === "Rejected")       summary.rejected++;
      else if (st === "Selected")       summary.selected++;
      else if (st === "Offer Declined") summary.offerDeclined++;
      else if (st === "Withdrawn")      summary.withdrawn++;
    });

    // Per-round pass counts — one grouped query per shortlist
    const roundStats = [];
    if (rounds.length > 0 && students.length > 0) {
      const studentIds = students.map(s => s.student_id);
      const roundIds   = rounds.map(r => r.id);

      const results = await StudentRoundResult.findAll({
        attributes: ["roundId", "result"],
        where: {
          roundId:   { [Op.in]: roundIds },
          studentId: { [Op.in]: studentIds },
        },
        raw: true,
      });

      // Count per round
      const passMap = {};
      const failMap = {};
      results.forEach(r => {
        if (r.result === "Passed" || r.result === "Qualified") {
          passMap[r.roundId] = (passMap[r.roundId] || 0) + 1;
        } else if (r.result === "Rejected") {
          failMap[r.roundId] = (failMap[r.roundId] || 0) + 1;
        }
      });

      rounds
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach(r => {
          roundStats.push({
            order:     r.order,
            roundName: r.roundName,
            passed:    passMap[r.id] || 0,
            rejected:  failMap[r.id] || 0,
          });
        });
    }

    // Auto-derive drive status from interviewDate
    const interviewDate = slJson.drive?.interviewDate;
    let driveStatus = "upcoming";
    if (interviewDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(interviewDate);
      if (d < today) driveStatus = "completed";
      else if (d.toDateString() === today.toDateString()) driveStatus = "ongoing";
    }

    return { ...slJson, summary, roundStats, driveStatus };
  }));

  // Sort shortlists by drive status group: upcoming → ongoing → completed.
  // Uses the same STATUS_ORDER priority as the company-detail Placement Drives list
  // so ordering is consistent across both views. Within each group the existing
  // creation-date DESC order from the SQL query is preserved (V8 stable sort).
  const STATUS_ORDER = { upcoming: 0, ongoing: 1, completed: 2 };
  enriched.sort((a, b) => {
    const ga = STATUS_ORDER[a.driveStatus] ?? 2;
    const gb = STATUS_ORDER[b.driveStatus] ?? 2;
    return ga - gb;
  });

  return res.render("tracker/shortlists/index.html", { shortlists: enriched });
});

// ─── Edit Shortlist (GET / POST) ───────────────────────────────────────────
router.get("/shortlists/:shortlistId/edit", async (req, res) => {
  const shortlist = await Shortlist.findByPk(req.params.shortlistId, {
    include: [
      { model: PlacementDrive, as: "drive", include: [{ model: Company, as: "company" }] },
    ],
  });
  if (!shortlist) return res.status(404).send("Shortlist not found");
  return res.render("tracker/shortlists/edit.html", { shortlist });
});

router.post("/shortlists/:shortlistId/edit", async (req, res) => {
  const shortlist = await Shortlist.findByPk(req.params.shortlistId);
  if (!shortlist) return res.status(404).send("Shortlist not found");

  const { name } = req.body;
  if (!name || !name.trim()) {
    addMessage(req, { type: "danger", text: "Shortlist name cannot be empty." });
    return res.redirect(`/shortlists/${shortlist.id}/edit`);
  }

  await shortlist.update({ name: name.trim() });
  addMessage(req, { type: "success", text: "Shortlist name updated." });
  return res.redirect("/shortlists");
});

// ─── Remove Student from Shortlist (POST) ──────────────────────────────────
// BUG-15 FIX: check the row exists before destroying — ShortlistStudent.destroy()
// returns 0 silently on a miss, which would otherwise flash a false success message.
router.post("/shortlists/:shortlistId/remove-student/:studentId", async (req, res) => {
  const entry = await ShortlistStudent.findOne({
    where: {
      shortlistId: Number(req.params.shortlistId),
      studentId: req.params.studentId,
    },
  });

  if (!entry) {
    addMessage(req, { type: "warning", text: "Student was not found in this shortlist." });
    return res.redirect("/shortlists");
  }

  await entry.destroy();
  addMessage(req, { type: "success", text: "Student removed from shortlist." });
  return res.redirect("/shortlists");
});

// ─── Add Student to Existing Shortlist (POST JSON) ─────────────────────────
router.post("/shortlists/:shortlistId/add-student", async (req, res) => {
  try {
    const shortlistId = Number(req.params.shortlistId);
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, error: "studentId is required." });
    }

    const shortlist = await Shortlist.findByPk(shortlistId, {
      include: [{ model: PlacementDrive, as: "drive", include: [{ model: Company, as: "company" }] }],
    });
    if (!shortlist) {
      return res.status(404).json({ success: false, error: "Shortlist not found." });
    }

    const student = await Student.findByPk(String(studentId));
    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found." });
    }

    // Check if already in this shortlist
    const existing = await ShortlistStudent.findOne({
      where: { shortlistId, studentId: String(studentId) },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: `${student.name || studentId} is already in this shortlist.` });
    }

    await ShortlistStudent.create({
      shortlistId,
      studentId: String(studentId),
      status: "Shortlisted",
    });

    // Send notification email
    let emailSent = false;
    if (student.email && shortlist.drive) {
      const result = await notifyStudentShortlisted({
        student,
        drive: shortlist.drive,
        company: shortlist.drive.company,
        shortlistName: shortlist.name,
      });
      emailSent = Boolean(result?.ok);
    }

    await recordAuditLog({
      adminId: req.session?.user?.id,
      action: "ADD_STUDENT_TO_SHORTLIST",
      targetTable: "shortlist_students",
      targetId: String(shortlistId),
      details: `Added student "${student.name}" (${studentId}) to shortlist "${shortlist.name}". Email sent: ${emailSent}`,
    });

    return res.json({
      success: true,
      emailSent,
      student: {
        student_id: student.student_id,
        name: student.name,
        branch: student.branch,
        cgpa: student.cgpa,
        email: student.email,
      },
    });
  } catch (err) {
    console.error("add-student error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Update ShortlistStudent Status (POST JSON) ─────────────────────────────
// Used for: Mark Absent, Mark Withdrawn, Confirm Offer (→ Placed), Decline Offer
router.post("/shortlists/:shortlistId/student/:studentId/status", async (req, res) => {
  try {
    const shortlistId = Number(req.params.shortlistId);
    const studentId   = String(req.params.studentId);
    const { status, statusNote } = req.body;

    const ALLOWED = ["Shortlisted", "Absent", "Rejected", "Selected", "Offer Declined", "Withdrawn"];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status: "${status}".` });
    }

    const entry = await ShortlistStudent.findOne({ where: { shortlistId, studentId } });
    if (!entry) {
      return res.status(404).json({ success: false, error: "Student not found in this shortlist." });
    }

    await entry.update({
      status,
      statusNote: statusNote || null,
    });

    // If TPO confirms offer → mark student as Placed globally
    if (status === "Selected") {
      const shortlist = await Shortlist.findByPk(shortlistId, {
        include: [{ model: PlacementDrive, as: "drive", include: [{ model: Company, as: "company" }] }],
      });
      const drive = shortlist?.drive;
      await Student.update(
        {
          placement_status:  "Placed",
          placement_company: drive?.company?.name || null,
          placement_package: drive?.packageLPA    || null,
          placement_year:    new Date().getFullYear().toString(),
        },
        { where: { student_id: studentId } }
      );
    }

    // If offer declined → revert student to Not Placed (they are still available for other drives)
    if (status === "Offer Declined") {
      await Student.update(
        { placement_status: "Not Placed" },
        { where: { student_id: studentId, placement_status: "Placed" } }
      );
    }

    await recordAuditLog({
      adminId: req.session?.user?.id,
      action: "UPDATE_SHORTLIST_STUDENT_STATUS",
      targetTable: "shortlist_students",
      targetId: String(shortlistId),
      details: `Student "${studentId}" status set to "${status}" in shortlist ${shortlistId}. Note: ${statusNote || "—"}`,
    });

    return res.json({ success: true, status });
  } catch (err) {
    console.error("update-status error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
