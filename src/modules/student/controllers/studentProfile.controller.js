const { Student, StudentProfile } = require("../../../db/models");
const { addMessage } = require("../../../shared/middleware/flash");
const {
  loadProfileBundle,
  loadDashboardData,
  computeCompletion,
} = require("../services/studentProfile.service");
const {
  recordUploadedResume,
  authorizeResumeAccess,
  resumeAbsolutePath,
  deleteResume,
} = require("../services/resume.service");
const {
  validateProfilePayload,
} = require("../validations/studentProfile.validators");
const { recordAuditLog } = require("../../../shared/services/audit.service");
const fs = require("fs");

const STANDARD_SKILLS_LIST = [
    'C', 'C++', 'Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'R',
    'React.js', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot', 'ASP.NET', 'HTML5/CSS3', 'Tailwind CSS', 'Bootstrap',
    'MySQL', 'PostgreSQL', 'MongoDB', 'SQLite', 'Redis', 'Oracle', 'Firebase',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Git/GitHub', 'Jenkins', 'CI/CD', 'Linux',
    'Machine Learning', 'Deep Learning', 'AI', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-Learn', 'Data Visualization', 'NLP',
    'DSA', 'OOP', 'System Design', 'RESTful APIs', 'GraphQL', 'Microservices', 'Web3/Blockchain', 'Cybersecurity'
];

// Build a lowercase name -> 1-based index map for reverse lookups (resume-extracted names)
const STANDARD_SKILLS_BY_NAME = {};
STANDARD_SKILLS_LIST.forEach((name, i) => {
  STANDARD_SKILLS_BY_NAME[name.toLowerCase()] = i + 1;
});

function buildTemplateStudent(student) {
  const photo = student?.profile_photo;
  let skillsDisplay = '';
  let skillsIds = '';
  if (student?.skills) {
    const raw = student.skills.split(',').map(s => s.trim()).filter(Boolean);
    const names = [];
    const ids = [];
    raw.forEach(token => {
      if (!isNaN(token) && Number(token) > 0 && Number(token) <= STANDARD_SKILLS_LIST.length) {
        // already a valid numeric ID
        names.push(STANDARD_SKILLS_LIST[Number(token) - 1]);
        ids.push(token);
      } else {
        // resume-extracted name string — look it up by name
        const idx = STANDARD_SKILLS_BY_NAME[token.toLowerCase()];
        if (idx) {
          names.push(STANDARD_SKILLS_LIST[idx - 1]);
          ids.push(String(idx));
        } else {
          // truly unknown — keep as-is in display, skip from Choices IDs
          names.push(token);
        }
      }
    });
    skillsDisplay = names.join(', ');
    skillsIds = ids.join(', ');
  }
  return {
    ...student?.toJSON?.(),
    profile_photo: photo ? { url: `/media/${photo}` } : null,
    get_year_display: student?.year || "",
    skillsDisplay: skillsDisplay,
    skillsIds: skillsIds
  };
}

function safeNumberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getStudentForRequest(req) {
  const userId = req.session?.user?.id;
  if (!userId) return null;
  return Student.findOne({ where: { user_id: userId } });
}

async function getProfilePage(req, res, next) {
  try {
    const student = await getStudentForRequest(req);
    if (!student) return res.redirect("/login/");

    const bundle = await loadProfileBundle(student.student_id);
    const dash = await loadDashboardData(student.student_id);
    const completion = computeCompletion({
      student: bundle.student,
      profile: bundle.profile,
      activeResume: bundle.activeResume,
    });
    const is_profile_complete = completion >= 90;

    // Internship count for the dashboard tracker
    const { Internship, StudentProject } = require("../../../db/models");
    const internshipCount = await Internship.count({
      where: { studentId: student.student_id },
    });
    const allProjects = await StudentProject.findAll({
      where: { studentId: student.student_id },
      attributes: ["projectType"],
    });
    const projectCount       = allProjects.length;
    const liveProjectCount   = allProjects.filter(p => p.projectType === "LIVE").length;
    const normalProjectCount = allProjects.filter(p => p.projectType === "NORMAL").length;

    return res.render("tracker/student_profile.html", {
      student: buildTemplateStudent(bundle.student),
      profile: bundle.profile?.toJSON?.() || null,
      activeResume: bundle.activeResume?.toJSON?.() || null,
      resumes: (bundle.resumes || []).map((r) => r.toJSON()),
      dashboard: dash,
      completion,
      is_profile_complete,
      internshipCount,
      projectCount,
      liveProjectCount,
      normalProjectCount,
      showWelcome: String(req.query?.welcome || "") === "1",
    });
  } catch (err) {
    return next(err);
  }
}

async function postProfile(req, res, next) {
  try {
    const student = await getStudentForRequest(req);
    if (!student) return res.redirect("/login/");

    const b = req.body || {};
    const errors = validateProfilePayload(b);
    if (errors.length > 0) {
      errors.forEach((e) => addMessage(req, { type: "danger", text: e }));
      // Redirect back to whichever page the form came from
      const referer = req.get("Referer") || "";
      return res.redirect(referer.includes("/student/my-profile") ? "/student/my-profile/" : "/student/profile/");
    }

    const studentUpdate = {
      name:         b.name         ?? student.name,
      date_of_birth:b.date_of_birth ?? student.date_of_birth,
      gender:       b.gender        ?? student.gender,
      branch:       b.branch        ?? student.branch,
      year:         b.year          ?? student.year,
      phone_number: b.phone_number  ?? student.phone_number,
      email:        b.email         ?? student.email,
      address:      b.address       ?? student.address,
      cgpa:         b.cgpa != null && b.cgpa !== "" ? Number(b.cgpa) : student.cgpa,
      // skills can be legitimately cleared by the student (submitting an empty
      // multi-select). However an empty string from a form POST means "no skills
      // selected" — store null so the DB column is cleanly empty rather than "".
      skills:       b.skills !== undefined ? (b.skills.trim() || null) : student.skills,
      certifications: b.certifications ?? student.certifications,
      resume_link:  b.resume_link   ?? student.resume_link,
      linkedin:     b.linkedin      ?? student.linkedin,
      github:       b.github        ?? student.github,
    };

    if (req.file) {
      studentUpdate.profile_photo = `profile_photos/${req.file.filename}`.replace(/\\/g, "/");
    }

    await student.update(studentUpdate);

    const [profile] = await StudentProfile.findOrCreate({
      where: { studentId: student.student_id },
      defaults: { studentId: student.student_id },
    });

    await profile.update({
      bio: b.bio ?? profile.bio,
      tenthPercentage: safeNumberOrNull(b.tenthPercentage) ?? profile.tenthPercentage,
      twelfthPercentage: safeNumberOrNull(b.twelfthPercentage) ?? profile.twelfthPercentage,
      backlogs: safeNumberOrNull(b.backlogs) ?? profile.backlogs,
      certifications: b.certifications ?? profile.certifications,
      projects: b.projects ?? profile.projects,
      internshipExperience: b.internshipExperience ?? profile.internshipExperience,
      preferredRole: b.preferredRole ?? profile.preferredRole,
      preferredCompanyType: b.preferredCompanyType ?? profile.preferredCompanyType,
      portfolioUrl: b.portfolioUrl ?? profile.portfolioUrl,
    });

    addMessage(req, { type: "success", text: "Profile updated successfully." });
    await recordAuditLog({
      adminId: student.student_id,
      action: "STUDENT_PROFILE_UPDATED",
      targetTable: "tracker_student",
      targetId: student.student_id,
      details: `Student "${student.name}" updated their profile.`,
    });
    return res.redirect("/student/my-profile/");
  } catch (err) {
    addMessage(req, {
      type: "danger",
      text: "Could not save profile: " + (err?.message || "Unknown error"),
    });
    return next ? next(err) : res.redirect("/student/my-profile/");
  }
}

async function postResumeUpload(req, res) {
  try {
    const student = await getStudentForRequest(req);
    if (!student) return res.redirect("/login/");
    if (!req.file) {
      addMessage(req, { type: "danger", text: "Please select a resume file." });
      return res.redirect("/student/my-profile/#resume-section");
    }
    await recordUploadedResume({ studentId: student.student_id, file: req.file });
    await recordAuditLog({
      adminId: student.student_id,
      action: "STUDENT_RESUME_UPLOADED",
      targetTable: "tracker_resume",
      targetId: student.student_id,
      details: `Student "${student.name}" uploaded a new resume: ${req.file.originalname}.`,
    });
    addMessage(req, { type: "success", text: "Resume uploaded successfully." });
    return res.redirect("/student/my-profile/#resume-section");
  } catch (err) {
    addMessage(req, {
      type: "danger",
      text: "Resume upload failed: " + (err?.message || "Unknown error"),
    });
    return res.redirect("/student/my-profile/#resume-section");
  }
}

async function getResumePreview(req, res) {
  const resume = await authorizeResumeAccess(req.session, req.params.id);
  if (!resume) return res.status(404).send("Resume not found.");
  const filePath = resumeAbsolutePath(resume);
  if (!fs.existsSync(filePath)) return res.status(404).send("Resume file missing.");
  res.setHeader("Content-Type", resume.mimeType || "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${resume.originalFilename}"`);
  return fs.createReadStream(filePath).pipe(res);
}

async function getResumeDownload(req, res) {
  const resume = await authorizeResumeAccess(req.session, req.params.id);
  if (!resume) return res.status(404).send("Resume not found.");
  const filePath = resumeAbsolutePath(resume);
  if (!fs.existsSync(filePath)) return res.status(404).send("Resume file missing.");
  return res.download(filePath, resume.originalFilename);
}

async function postResumeDelete(req, res) {
  try {
    const resume = await authorizeResumeAccess(req.session, req.params.id);
    if (!resume) {
      addMessage(req, { type: "danger", text: "Resume not found." });
      return res.redirect("/student/profile/");
    }
    await deleteResume(resume);
    addMessage(req, { type: "success", text: "Resume deleted." });
    return res.redirect("/student/profile/");
  } catch (err) {
    addMessage(req, { type: "danger", text: "Could not delete resume." });
    return res.redirect("/student/profile/");
  }
}

async function getInterviewRoundsPage(req, res, next) {
  try {
    const student = await getStudentForRequest(req);
    if (!student) return res.redirect("/login/");

    const { StudentRoundResult, InterviewRound, PlacementDrive, Company,
            ShortlistStudent, Shortlist } = require("../../../db/models");

    const results = await StudentRoundResult.findAll({
      where: { studentId: student.student_id },
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

    // Fetch drives where the student is marked Absent in shortlist_students.
    // These are preserved interview records that never produced a round result.
    const absentEntries = await ShortlistStudent.findAll({
      where: { studentId: student.student_id, status: "Absent" },
      include: [
        {
          model: Shortlist,
          as: "shortlist",
          include: [
            {
              model: PlacementDrive,
              as: "drive",
              include: [{ model: Company, as: "company" }],
            },
          ],
        },
      ],
    }).catch(() => []);

    // Build a compact list for the template: company name, role, date, shortlist name
    const absenceRecords = absentEntries.map((entry) => {
      const drive   = entry.shortlist?.drive;
      const company = drive?.company;
      return {
        companyName:   company?.name     || "Unknown Company",
        jobRole:       drive?.jobRole    || "Placement Drive",
        interviewDate: drive?.interviewDate || null,
        shortlistName: entry.shortlist?.name || null,
      };
    }).filter(a => a); // remove any nulls

    return res.render("tracker/student_interview_rounds.html", {
      student,
      results,
      absenceRecords,
      isAdmin: false,
    });
  } catch (err) {
    return next(err);
  }
}

async function getMyProfilePage(req, res, next) {
  try {
    const student = await getStudentForRequest(req);
    if (!student) return res.redirect("/login/");

    const bundle = await loadProfileBundle(student.student_id);
    const completion = computeCompletion({
      student: bundle.student,
      profile: bundle.profile,
      activeResume: bundle.activeResume,
    });

    return res.render("tracker/student_my_profile.html", {
      student: buildTemplateStudent(bundle.student),
      profile: bundle.profile?.toJSON?.() || null,
      activeResume: bundle.activeResume?.toJSON?.() || null,
      resumes: (bundle.resumes || []).map((r) => r.toJSON()),
      completion,
      is_profile_complete: completion >= 90,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  buildTemplateStudent,
  getProfilePage,
  getMyProfilePage,
  postProfile,
  postResumeUpload,
  getResumePreview,
  getResumeDownload,
  postResumeDelete,
  getInterviewRoundsPage,
};
