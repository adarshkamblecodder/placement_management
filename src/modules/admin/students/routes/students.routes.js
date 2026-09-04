const express = require("express");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const {
  Student,
  AuthUser,
  Company,
  PlacementDrive,
  StudentRoundResult,
  InterviewRound,
  ShortlistStudent,
  Application,
  Placement,
  StudentLoginMeta,
} = require("../../../../db/models");
const {
  loadProfileBundle,
  loadDashboardData,
  computeCompletion,
} = require("../../../student/services/studentProfile.service");
const { buildTemplateStudent } = require("../../../student/controllers/studentProfile.controller");
const { requireAdmin, getScopedDepartment } = require("../../../../shared/middleware/auth");
const { verifyCsrf } = require("../../../../shared/middleware/csrf");
const { addMessage } = require("../../../../shared/middleware/flash");
const { recordAuditLog } = require("../../../../shared/services/audit.service");
const { notifyPlacementStatusUpdated } = require("../../../../shared/services/notification.service");

const router = express.Router();
router.use(requireAdmin);

// Multer: in-memory storage for Excel upload (no disk needed)
const excelUpload = multer({ storage: multer.memoryStorage() });

// Valid branch options
const VALID_BRANCHES = ["CS", "AIML", "AIDS", "MBA"];

function buildAdminPlacementStatusForm(student) {
  return {
    placement_status: student.placement_status || "Not Placed",
    placement_company: student.placement_company || "",
    placement_package: student.placement_package || "",
    placement_year: student.placement_year || "",
  };
}

function normaliseGender(raw) {
  if (!raw) return null;
  const g = String(raw).trim().toLowerCase();
  if (g === "m" || g === "male") return "M";
  if (g === "f" || g === "female") return "F";
  if (g === "o" || g === "other") return "O";
  return null;
}

function normaliseBranch(raw) {
  if (!raw) return null;
  const b = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (b === "CS" || b === "COMPUTERSCIENCE" || b === "COMPUTER") return "CS";
  if (b === "AIML" || b === "AI/ML" || b === "ARTIFICIALINTELLIGENCE&MACHINELEARNING") return "AIML";
  if (b === "AIDS" || b === "AI/DS" || b === "AIDATASC" || b === "ARTIFICIALINTELLIGENCE&DATASCIENCE") return "AIDS";
  if (b === "MBA") return "MBA";
  return VALID_BRANCHES.includes(b) ? b : null;
}

function parseDate(raw) {
  if (!raw) return null;
  if (typeof raw === "number") {
    const date = XLSX.SSF.parse_date_code(raw);
    if (!date) return null;
    const y = String(date.y);
    const m = String(date.m).padStart(2, "0");
    const d = String(date.d).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return null;
}

// ─── Combined Student List + Add page (GET) ────────────────────────────────
router.get("/students/", async (req, res) => {
  const {
    q,
    branch: branchFilter,
    skills: skillsFilter,
    driveId,
    sort,
    hasLiveProject,
    minLiveProjects,
    hasCompletedInternship,
    hasOngoingInternship,
    hasResume,
    hasCertifications,
    showAll,
  } = req.query;

  // showAll=1 shows every student including placed ones
  const whereList = showAll === "1" ? {} : { placement_status: { [Op.ne]: "Placed" } };
  const whereStats = {};

  if (q) {
    const qFilter = {
      [Op.or]: [
        { name: { [Op.like]: `%${q}%` } },
        { student_id: { [Op.like]: `%${q}%` } },
      ],
    };
    whereList[Op.or] = qFilter[Op.or];
    whereStats[Op.or] = qFilter[Op.or];
  }
  const scopedDept = getScopedDepartment(req);
  if (scopedDept) {
    whereList.branch = scopedDept;
    whereStats.branch = scopedDept;
  } else if (branchFilter) {
    let branchesArray = [];
    if (Array.isArray(branchFilter)) {
      branchesArray = branchFilter.map(b => String(b).trim()).filter(Boolean);
    } else {
      branchesArray = String(branchFilter).split(',').map(b => b.trim()).filter(Boolean);
    }
    if (branchesArray.length > 0) {
      whereList.branch = { [Op.in]: branchesArray };
      whereStats.branch = { [Op.in]: branchesArray };
    }
  }
  if (skillsFilter) {
    let skillsArray = [];
    if (Array.isArray(skillsFilter)) {
      skillsArray = skillsFilter.map(s => String(s).trim()).filter(Boolean);
    } else {
      skillsArray = String(skillsFilter).split(',').map(s => s.trim()).filter(Boolean);
    }

    // Resolve skill names → numeric IDs (skills stored as CSV of IDs in DB)
    const SKILLS_LOOKUP = [
      'C', 'C++', 'Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'R',
      'React.js', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot', 'ASP.NET', 'HTML5/CSS3', 'Tailwind CSS', 'Bootstrap',
      'MySQL', 'PostgreSQL', 'MongoDB', 'SQLite', 'Redis', 'Oracle', 'Firebase',
      'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Git/GitHub', 'Jenkins', 'CI/CD', 'Linux',
      'Machine Learning', 'Deep Learning', 'AI', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-Learn', 'Data Visualization', 'NLP',
      'DSA', 'OOP', 'System Design', 'RESTful APIs', 'GraphQL', 'Microservices', 'Web3/Blockchain', 'Cybersecurity'
    ];
    const skillNameToId = {};
    SKILLS_LOOKUP.forEach((name, i) => { skillNameToId[name.toLowerCase()] = String(i + 1); });

    // For each skill token: if it's a name resolve to ID, else use as-is
    const resolvedSkills = skillsArray.map(s => {
      const sLower = s.toLowerCase();
      // 1. Exact match
      if (skillNameToId[sLower]) return skillNameToId[sLower];
      // 2. Skill label starts with the token (e.g. "React" → "React.js")
      const startsWithKey = Object.keys(skillNameToId).find(k => k.startsWith(sLower));
      if (startsWithKey) return skillNameToId[startsWithKey];
      // 3. Token starts with skill label (e.g. "reactjs" → "react.js")
      const tokenStartsKey = Object.keys(skillNameToId).find(k => sLower.startsWith(k.replace(/[^a-z0-9]/g, '')));
      if (tokenStartsKey) return skillNameToId[tokenStartsKey];
      // 4. Keep as-is (legacy name string stored in DB)
      return s;
    });

    if (resolvedSkills.length > 0) {
      if (!whereList[Op.and]) whereList[Op.and] = [];
      resolvedSkills.forEach((s) => {
        whereList[Op.and].push({
          [Op.or]: [
            { skills: s },
            // S-09 FIX: replaced Op.iLike (Postgres-only) with Op.like so the
            // query works on any dialect including SQLite used in development/tests.
            // Skill IDs are numeric strings ("1","14","32") — case is irrelevant;
            // Op.like is sufficient and portable.
            { skills: { [Op.like]: `${s},%` } },
            { skills: { [Op.like]: `%,${s}` } },
            { skills: { [Op.like]: `%,${s},%` } },
            // Legacy data stored skill names as plain strings — match those too
            { skills: { [Op.like]: `%${s}%` } },
          ],
        });
      });
    }
  }

  const students = await Student.findAll({ where: whereList, order: [["student_id", "ASC"]] });

  const STANDARD_SKILLS_LIST = [
      'C', 'C++', 'Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'R',
      'React.js', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot', 'ASP.NET', 'HTML5/CSS3', 'Tailwind CSS', 'Bootstrap',
      'MySQL', 'PostgreSQL', 'MongoDB', 'SQLite', 'Redis', 'Oracle', 'Firebase',
      'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Git/GitHub', 'Jenkins', 'CI/CD', 'Linux',
      'Machine Learning', 'Deep Learning', 'AI', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-Learn', 'Data Visualization', 'NLP',
      'DSA', 'OOP', 'System Design', 'RESTful APIs', 'GraphQL', 'Microservices', 'Web3/Blockchain', 'Cybersecurity'
  ];

  // ── Resolve skills display ─────────────────────────────────────────────
  let studentsList = students.map(s => {
    const sJson = s.toJSON();
    if (sJson.skills) {
      const ids = sJson.skills.split(',').map(id => id.trim());
      sJson.skillsDisplay = ids.map(id => {
        if (!isNaN(id) && Number(id) > 0 && Number(id) <= STANDARD_SKILLS_LIST.length) {
          return STANDARD_SKILLS_LIST[Number(id) - 1];
        }
        return id; // Fallback to raw string if it's old data
      }).join(', ');
    } else {
      sJson.skillsDisplay = '';
    }
    return sJson;
  });

  // ── Profile-based counts — two GROUP BY queries, zero N+1 ─────────────
  const { StudentProject, Internship, Resume: ResumeModel, fn, col } = (() => {
    const models = require("../../../../db/models");
    const { fn, col } = require("sequelize");
    return { ...models, fn, col };
  })();

  const allIds = studentsList.map(s => s.student_id);

  let liveProjectSet       = new Set(); // student_ids with ≥1 live completed project
  let completedInternSet   = new Set(); // student_ids with ≥1 completed internship
  let ongoingInternSet     = new Set(); // student_ids with ≥1 ongoing internship
  let activeResumeSet      = new Set(); // student_ids with an active resume

  // project/internship/resume counts per student (for display in table)
  const liveProjectCount   = {};
  const completedInternCount = {};

  if (allIds.length > 0) {
    // Live projects (ALL statuses) — grouped count
    const liveProjRows = await StudentProject.findAll({
      attributes: ["studentId", [fn("COUNT", col("id")), "cnt"]],
      where: { studentId: { [Op.in]: allIds }, projectType: "LIVE" },
      group: ["studentId"],
      raw: true,
    });
    liveProjRows.forEach(r => {
      const cnt = Number(r.cnt);
      if (cnt > 0) liveProjectSet.add(r.studentId);
      liveProjectCount[r.studentId] = cnt;
    });

    // Completed internships — grouped count
    const doneInternRows = await Internship.findAll({
      attributes: ["studentId", [fn("COUNT", col("id")), "cnt"]],
      where: { studentId: { [Op.in]: allIds }, status: "Completed" },
      group: ["studentId"],
      raw: true,
    });
    doneInternRows.forEach(r => {
      const cnt = Number(r.cnt);
      if (cnt > 0) completedInternSet.add(r.studentId);
      completedInternCount[r.studentId] = cnt;
    });

    // Ongoing internships — just need the set
    const ongoingInternRows = await Internship.findAll({
      attributes: ["studentId"],
      where: { studentId: { [Op.in]: allIds }, status: "Ongoing" },
      group: ["studentId"],
      raw: true,
    });
    ongoingInternRows.forEach(r => ongoingInternSet.add(r.studentId));

    // Active resumes
    const resumeRows = await ResumeModel.findAll({
      attributes: ["studentId"],
      where: { studentId: { [Op.in]: allIds }, isActive: true },
      group: ["studentId"],
      raw: true,
    });
    resumeRows.forEach(r => activeResumeSet.add(r.studentId));
  }

  // ── Annotate each student with their profile counts ────────────────────
  studentsList = studentsList.map(s => ({
    ...s,
    liveProjectCount:        liveProjectCount[s.student_id]    || 0,
    completedInternshipCount: completedInternCount[s.student_id] || 0,
    hasActiveResume:         activeResumeSet.has(s.student_id),
  }));

  // ── Profile-based JS filters (AND logic) ───────────────────────────────
  // hasLiveProject=1 means "at least minLiveProjects live completed projects"
  if (hasLiveProject === "1") {
    const threshold = minLiveProjects ? Math.max(1, parseInt(minLiveProjects, 10) || 1) : 1;
    studentsList = studentsList.filter(s => (liveProjectCount[s.student_id] || 0) >= threshold);
  }
  if (hasCompletedInternship === "1") {
    studentsList = studentsList.filter(s => completedInternSet.has(s.student_id));
  }
  if (hasOngoingInternship === "1") {
    studentsList = studentsList.filter(s => ongoingInternSet.has(s.student_id));
  }
  if (hasResume === "1") {
    studentsList = studentsList.filter(s => activeResumeSet.has(s.student_id));
  }
  if (hasCertifications === "1") {
    studentsList = studentsList.filter(s => s.certifications && s.certifications.trim());
  }

  // ── CGPA sort ──────────────────────────────────────────────────────────
  if (sort === "cgpa_asc") {
    studentsList.sort((a, b) => {
      const ca = a.cgpa !== null && a.cgpa !== undefined ? parseFloat(a.cgpa) : -1;
      const cb = b.cgpa !== null && b.cgpa !== undefined ? parseFloat(b.cgpa) : -1;
      return ca - cb;
    });
  } else if (sort === "cgpa_desc") {
    studentsList.sort((a, b) => {
      const ca = a.cgpa !== null && a.cgpa !== undefined ? parseFloat(a.cgpa) : -1;
      const cb = b.cgpa !== null && b.cgpa !== undefined ? parseFloat(b.cgpa) : -1;
      return cb - ca;
    });
  }

  let driveContext = null;
  if (driveId) {
    const drive = await PlacementDrive.findByPk(Number(driveId), {
      include: [{ model: Company, as: "company" }],
    });
    if (drive) {
      driveContext = {
        id: drive.id,
        jobRole: drive.jobRole,
        interviewDate: drive.interviewDate,
        minCGPA: drive.minCGPA,
        numberOfOpenings: drive.numberOfOpenings,
        companyName: drive.company ? drive.company.name : "Unknown Company",
        defaultShortlistName: `${drive.company ? drive.company.name : "Company"} (${drive.interviewDate})`,
      };
    }
  }

  // Also fetch available drives for shortlisting dropdown
  const availableDrives = await PlacementDrive.findAll({
    include: [{ model: Company, as: "company" }],
    order: [["id", "DESC"]],
  });

  const totalStudents = await Student.count({ where: whereStats });
  const placedStudents = await Student.count({ where: { ...whereStats, placement_status: "Placed" } });
  const unplacedStudents = totalStudents - placedStudents;
  const placedPercentage = totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;
  const unplacedPercentage = totalStudents > 0 ? 100 - placedPercentage : 0;

  // Build login status map: student_id → 'none' | 'sent' | 'logged_in'
  const studentIds = studentsList.map(s => s.student_id);
  const loginMetas = await StudentLoginMeta.findAll({
    where: { studentId: studentIds },
    attributes: ["studentId", "isFirstLogin", "emailSent"],
  });
  const metaByStudentId = {};
  for (const m of loginMetas) metaByStudentId[m.studentId] = m;

  const loginStatusMap = {};
  for (const s of studentsList) {
    if (!s.user_id) {
      loginStatusMap[s.student_id] = "none";
    } else {
      const meta = metaByStudentId[s.student_id];
      if (!meta || !meta.emailSent) {
        loginStatusMap[s.student_id] = "no_email";
      } else if (meta.isFirstLogin) {
        loginStatusMap[s.student_id] = "sent";
      } else {
        loginStatusMap[s.student_id] = "logged_in";
      }
    }
  }

  return res.render("tracker/student_list.html", {
    object_list: studentsList,
    query: req.query,
    branches: VALID_BRANCHES,
    driveContext,
    availableDrives,
    showAll: showAll === "1",
    loginStatusMap,
    stats: {
      total: totalStudents,
      placed: placedStudents,
      unplaced: unplacedStudents,
      placedPercentage,
      unplacedPercentage,
    },
  });
});

// ─── Download Sample CSV Format (GET) ──────────────────────────────────────
router.get("/students/sample-csv/", (_req, res) => {
  const sampleHeaders = [
    "Student ID",
    "Full Name",
    "Gender",
    "Email ID",
    "Branch",
    "Current Year",
    "CGPA",
  ];
  const sampleRows = [
    [
      "2024CS001",
      "Aarav Sharma",
      "Male",
      "aarav.sharma@example.com",
      "CS",
      "4",
      "8.85",
    ],
    [
      "2024AI002",
      "Ananya Verma",
      "Female",
      "ananya.verma@example.com",
      "AIML",
      "3",
      "9.10",
    ],
  ];

  const csvContent =
    sampleHeaders.join(",") +
    "\n" +
    sampleRows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="student_import_sample.csv"');
  return res.send(csvContent);
});

// ─── Download Sample Excel Template (GET) ─────────────────────────────────
router.get("/students/sample-excel/", (_req, res) => {
  const templatePath = path.join(__dirname, "../../../../../student_import_template.xlsx");
  return res.download(templatePath, "student_import_template.xlsx", (err) => {
    if (err) {
      return res.status(404).send("Sample Excel template not found.");
    }
  });
});

// ─── Add Single Student (POST from inline form on list page) ───────────────
router.post("/students/add/", async (req, res) => {
  const {
    student_id,
    full_name,
    name,
    gender,
    email,
    branch,
    cgpa,
    year,
    skills,
    backlogs,
    certifications,
  } = req.body;

  const resolvedName = (full_name || name || "").trim();

  const errors = [];
  if (!student_id || !student_id.trim()) errors.push("Student ID is required.");
  if (!resolvedName) errors.push("Full Name is required.");
  if (!email || !email.trim()) errors.push("Email ID is required.");
  if (!branch || !VALID_BRANCHES.includes(branch)) errors.push("Branch must be CS, AIML, AIDS, or MBA.");
  if (!year || !["1", "2", "3", "4"].includes(year.toString())) errors.push("Current Year must be 1, 2, 3, or 4.");
  if (cgpa !== undefined && cgpa !== null && String(cgpa).trim() !== "") {
    if (isNaN(Number(cgpa)) || Number(cgpa) < 0 || Number(cgpa) > 10) {
      errors.push("CGPA must be a number between 0 and 10.");
    }
  }

  if (errors.length > 0) {
    for (const e of errors) addMessage(req, { type: "danger", text: e });
    return res.redirect("/students/");
  }

  try {
    const sid = student_id.trim();
    const existingStudent = await Student.findByPk(sid);
    if (existingStudent) {
      addMessage(req, { type: "danger", text: `Student ID "${sid}" already exists.` });
      return res.redirect("/students/");
    }

    const parsedCgpa =
      cgpa !== undefined && cgpa !== null && String(cgpa).trim() !== ""
        ? Number(cgpa)
        : null;

    await Student.create({
      student_id: sid,
      user_id: null,
      placement_status: "Not Placed",
      name: resolvedName,
      gender: normaliseGender(gender) || null,
      date_of_birth: null,
      email: email.trim(),
      branch,
      year: String(year),
      cgpa: parsedCgpa,
      skills: skills ? skills.trim() : null,
      backlogs: backlogs ? Number(backlogs) : 0,
      certifications: certifications ? certifications.trim() : null,
    });

    await recordAuditLog({
      adminId: req.session?.user?.id,
      action: "ADD_STUDENT",
      targetTable: "tracker_student",
      targetId: sid,
      details: `Added student ${resolvedName} (${sid}), Branch: ${branch}, Year: ${year}`,
    });

    addMessage(req, {
      type: "success",
      text: `Student "${resolvedName}" added successfully! They can add date of birth and phone when they log in.`,
    });
  } catch (err) {
    addMessage(req, { type: "danger", text: "Error adding student: " + err.message });
  }

  return res.redirect("/students/");
});

// ─── Excel Import (POST) ───────────────────────────────────────────────────
router.post("/students/import/", excelUpload.single("excel_file"), verifyCsrf, async (req, res) => {
  if (!req.file) {
    addMessage(req, { type: "danger", text: "No file uploaded. Please choose an Excel file." });
    return res.redirect("/students/");
  }

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false });
  } catch (err) {
    addMessage(req, { type: "danger", text: "Could not parse file. Please upload a valid .xlsx or .csv file." });
    return res.redirect("/students/");
  }

  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

  if (!rows || rows.length === 0) {
    addMessage(req, { type: "danger", text: "The file is empty or has no data rows." });
    return res.redirect("/students/");
  }

  const results = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const getCol = (aliases) => {
      for (const [key, val] of Object.entries(row)) {
        if (aliases.some((a) => key.trim().toLowerCase() === a.toLowerCase())) return val;
      }
      return null;
    };

    const student_id  = getCol(["Student ID", "StudentID", "student_id", "ID"]);
    const full_name   = getCol(["Full Name", "Name", "FullName", "full_name"]);
    const gender_raw  = getCol(["Gender", "gender", "Sex"]);
    const email_raw   = getCol(["Email ID", "Email", "email", "email_id", "Email_id"]);
    const branch_raw  = getCol(["Branch", "branch"]);
    const year_raw    = getCol(["Current Year", "Year", "year"]);
    const cgpa_raw    = getCol(["Last Year CGPA", "CGPA", "cgpa", "last_year_cgpa"]);

    const rowErrors = [];

    if (!student_id) rowErrors.push("Student ID missing");
    if (!full_name)  rowErrors.push("Full Name missing");
    if (!email_raw)  rowErrors.push("Email ID missing");
    if (!branch_raw) rowErrors.push("Branch missing");
    if (!year_raw)   rowErrors.push("Current Year missing");
    if (cgpa_raw === null || cgpa_raw === "") rowErrors.push("CGPA missing");

    const sid = student_id != null ? String(student_id).trim() : null;
    const branch = normaliseBranch(branch_raw);
    const ac_year = year_raw ? String(year_raw).replace(/[^0-9]/g, "") : null;
    const cgpa = parseFloat(cgpa_raw);
    const gender = normaliseGender(gender_raw);

    if (sid && !rowErrors.includes("Student ID missing") && !/^[A-Za-z0-9_-]+$/.test(sid))
      rowErrors.push(`Invalid Student ID format: "${sid}"`);
    if (email_raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email_raw).trim()))
      rowErrors.push(`Invalid email format: "${email_raw}"`);
    if (gender_raw && !gender) rowErrors.push(`Invalid Gender: "${gender_raw}" (use Male, Female, or Other)`);
    if (branch === null && branch_raw) rowErrors.push(`Invalid Branch: "${branch_raw}" (use CS, AIML, AIDS, or MBA)`);
    if (ac_year && !["1", "2", "3", "4"].includes(ac_year)) rowErrors.push(`Invalid Current Year: "${year_raw}" (must be 1, 2, 3, or 4)`);
    if (!isNaN(cgpa) && (cgpa < 0 || cgpa > 10)) rowErrors.push(`CGPA must be 0–10, got: ${cgpa}`);
    if (isNaN(cgpa) && cgpa_raw !== null) rowErrors.push(`Invalid CGPA: "${cgpa_raw}"`);

    if (rowErrors.length > 0) {
      results.skipped++;
      results.errors.push(`Row ${rowNum} (${sid || "?"}): ${rowErrors.join("; ")}`);
      continue;
    }

    const existing = await Student.findByPk(sid);
    if (existing) {
      results.skipped++;
      results.errors.push(`Row ${rowNum}: Student ID "${sid}" already exists — skipped.`);
      continue;
    }

    try {
      await Student.create({
        student_id: sid,
        user_id: null,
        placement_status: "Not Placed",
        name: String(full_name).trim(),
        gender: gender || null,
        date_of_birth: null,
        email: String(email_raw).trim(),
        branch,
        year: ac_year,
        cgpa: isNaN(cgpa) ? null : cgpa,
        skills: null,
        certifications: null,
      });
      results.imported++;
    } catch (err) {
      results.skipped++;
      results.errors.push(`Row ${rowNum} (${sid}): ${err.message}`);
    }
  }

  let msg = `Import complete: ${results.imported} student(s) imported, ${results.skipped} skipped.`;
  addMessage(req, { type: results.skipped > 0 ? "warning" : "success", text: msg });

  await recordAuditLog({
    adminId: req.session?.user?.id,
    action: "BULK_IMPORT_STUDENTS",
    targetTable: "tracker_student",
    details: `${msg}${results.errors.length > 0 ? ` Errors: ${results.errors.slice(0, 5).join("; ")}` : ""}`,
  });

  if (results.errors.length > 0) {
    req.session.importErrors = results.errors;
  }

  return res.redirect("/students/");
});

// ─── Admin Student Placement UpdateView (GET) ──────────────────────────────
router.get("/students/:pk/placement/", async (req, res) => {
  const student = await Student.findByPk(req.params.pk);
  if (!student) return res.status(404).send("Student not found");
  const form = buildAdminPlacementStatusForm(student);
  const companies = await Company.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });
  return res.render("tracker/admin_placement_form.html", { object: student, form, companies });
});

// ─── Admin Student Placement UpdateView (POST) ─────────────────────────────
router.post("/students/:pk/placement/", async (req, res) => {
  const student = await Student.findByPk(req.params.pk);
  if (!student) return res.status(404).send("Student not found");

  const { placement_status, placement_company, placement_package, placement_year } = req.body;

  const newStatus = placement_status || student.placement_status;

  // Validate company exists in DB when Placed
  if (placement_company) {
    const exists = await Company.findOne({ where: { name: placement_company } });
    if (!exists) {
      addMessage(req, { type: "danger", text: `Company "${placement_company}" not found. Please select a valid company from the list.` });
      return res.redirect(`/students/${req.params.pk}/placement/`);
    }
  }

  const previousStatus = student.placement_status;
  await student.update({
    placement_status: newStatus,
    placement_company: placement_company || student.placement_company,
    placement_package: placement_package ? Number(placement_package) : student.placement_package,
    placement_year: placement_year || student.placement_year,
  });

  await recordAuditLog({
    adminId: req.session?.user?.id,
    action: "UPDATE_PLACEMENT_STATUS",
    targetTable: "tracker_student",
    targetId: student.student_id,
    details: `Changed status from "${previousStatus}" to "${newStatus}". Company: "${placement_company || student.placement_company || 'N/A'}", Package: ${placement_package || student.placement_package || 'N/A'} LPA`,
  });

  // Notify student via email about placement status update
  notifyPlacementStatusUpdated({
    student,
    status: newStatus,
    companyName: placement_company || student.placement_company,
    packageLPA: placement_package || student.placement_package,
  });

  return res.redirect(newStatus === "Placed" ? "/placed/" : "/students/");
});

// ─── Admin View Student Profile ────────────────────────────────────────────
router.get("/students/:pk/profile/", async (req, res, next) => {
  try {
    const studentId = String(req.params.pk);
    const bundle = await loadProfileBundle(studentId);
    if (!bundle) return res.status(404).send("Student not found");

    const dash = await loadDashboardData(studentId);
    const completion = computeCompletion({
      student: bundle.student,
      profile: bundle.profile,
      activeResume: bundle.activeResume,
    });

    const templateStudent = buildTemplateStudent(bundle.student);

    // Load structured project records for this student
    const { StudentProject, Internship } = require("../../../../db/models");
    const projectRows = await StudentProject.findAll({
      where: { studentId },
      order: [["createdAt", "DESC"]],
    });
    const studentProjects    = projectRows.map(p => p.toJSON());
    const liveProjectCount   = studentProjects.filter(p => p.projectType === "LIVE").length;
    const normalProjectCount = studentProjects.filter(p => p.projectType === "NORMAL").length;

    // Load structured internship records for this student
    const internshipRows = await Internship.findAll({
      where: { studentId },
      order: [["startDate", "DESC"]],
    });
    const studentInternships = internshipRows.map(i => i.toJSON());

    return res.render("tracker/admin_student_profile.html", {
      student: templateStudent,
      profile: bundle.profile?.toJSON?.() || null,
      activeResume: bundle.activeResume?.toJSON?.() || null,
      resumes: (bundle.resumes || []).map((r) => r.toJSON()),
      dashboard: dash,
      completion,
      studentProjects,
      liveProjectCount,
      normalProjectCount,
      studentInternships,
    });
  } catch (err) {
    return next(err);
  }
});

// ─── Student DeleteView (GET) ──────────────────────────────────────────────
router.get("/students/:pk/delete/", async (req, res) => {
  const student = await Student.findByPk(req.params.pk);
  if (!student) return res.status(404).send("Student not found");
  return res.render("tracker/student_confirm_delete.html", { object: student });
});

// ─── Student DeleteView (POST) ─────────────────────────────────────────────
router.post("/students/:pk/delete/", async (req, res) => {
  const student = await Student.findByPk(req.params.pk);
  if (!student) return res.status(404).send("Student not found");

  const tx = await Student.sequelize.transaction();
  try {
    await StudentRoundResult.destroy({ where: { studentId: student.student_id }, transaction: tx });
    await ShortlistStudent.destroy({ where: { studentId: student.student_id }, transaction: tx });
    await Application.destroy({ where: { student_id: student.student_id }, transaction: tx });
    await Placement.destroy({ where: { student_id: student.student_id }, transaction: tx });

    if (student.user_id) {
      await StudentLoginMeta.destroy({ where: { authUserId: student.user_id }, transaction: tx });
    } else {
      await StudentLoginMeta.destroy({ where: { studentId: student.student_id }, transaction: tx });
    }

    // BUG-06 FIX: also destroy the StudentProfile row so no orphan is left behind
    const { StudentProfile } = require("../../../../db/models");
    await StudentProfile.destroy({ where: { studentId: student.student_id }, transaction: tx });

    await Student.destroy({ where: { student_id: student.student_id }, transaction: tx });

    if (student.user_id) {
      await AuthUser.destroy({ where: { id: student.user_id }, transaction: tx });
    }

    await tx.commit();

    await recordAuditLog({
      adminId: req.session?.user?.id,
      action: "DELETE_STUDENT",
      targetTable: "tracker_student",
      targetId: student.student_id,
      details: `Deleted student ${student.name || student.student_id} (${student.student_id})`,
    });

    addMessage(req, { type: "success", text: "Student deleted successfully." });
    return res.redirect("/students/");
  } catch (err) {
    await tx.rollback();
    console.error("student delete error:", err);
    addMessage(req, { type: "danger", text: "Could not delete student due to related data constraints." });
    return res.redirect("/students/");
  }
});

// ─── Student Dedicated Interview Rounds Page (GET) ────────────────────────
router.get("/students/:pk/interview-rounds/", async (req, res, next) => {
  try {
    const studentId = String(req.params.pk);
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).send("Student not found");

    const results = await StudentRoundResult.findAll({
      where: { studentId },
      include: [
        {
          model: InterviewRound,
          as: "round",
          include: [
            {
              model: PlacementDrive,
              as: "drive",
              include: [{ model: Company, as: "company" }],
            },
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.render("tracker/student_interview_rounds.html", {
      student,
      results,
      isAdmin: true,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
