const { Op } = require("sequelize");
const {
  Student,
  StudentProfile,
  Resume,
  Application,
  Company,
  Job,
  PlacementDrive,
  InterviewRound,
  StudentRoundResult,
  Shortlist,
  ShortlistStudent,
} = require("../../../db/models");

/**
 * Compute profile completion percentage (0-100) based on a weighted set
 * of personal, academic, placement, and resume fields.
 */
function computeCompletion({ student, profile, activeResume }) {
  const checks = [
    !!student?.name,
    !!student?.email,
    !!student?.phone_number,
    !!student?.date_of_birth,
    !!student?.address,
    !!student?.profile_photo,
    !!student?.branch,
    !!student?.year,
    student?.cgpa != null && student?.cgpa !== "",
    profile?.tenthPercentage != null,
    profile?.twelfthPercentage != null,
    !!student?.skills,
    !!student?.certifications || !!profile?.certifications,
    !!student?.linkedin,
    !!student?.github,
    !!profile?.preferredRole,
    !!profile?.preferredCompanyType,
    !!activeResume || !!student?.resume_link,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

async function getActiveResume(studentId) {
  return Resume.findOne({
    where: { studentId: String(studentId), isActive: true },
    order: [["createdAt", "DESC"]],
  });
}

async function loadProfileBundle(studentId) {
  const student = await Student.findByPk(studentId);
  if (!student) return null;

  let profile = await StudentProfile.findOne({ where: { studentId } });
  if (!profile) {
    profile = await StudentProfile.create({ studentId });
  }

  const activeResume = await getActiveResume(studentId);
  const resumes = await Resume.findAll({
    where: { studentId },
    order: [["createdAt", "DESC"]],
  });

  return { student, profile, activeResume, resumes };
}

/**
 * Aggregates dashboard data for a student.
 */
async function loadDashboardData(studentId) {
  const applications = await Application.findAll({
    where: { student_id: studentId },
    include: [{ model: Company }, { model: Job }],
    order: [["applied_date", "DESC"]],
  }).catch(() => []);

  const roundResults = await StudentRoundResult.findAll({
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
    order: [
      [{ model: InterviewRound, as: "round" }, "driveId", "DESC"],
      [{ model: InterviewRound, as: "round" }, "order", "ASC"],
    ],
  }).catch(() => []);

  const groupedHistory = {};
  for (const rr of roundResults) {
    const round = rr.round;
    const drive = round?.drive;
    const company = drive?.company;
    const driveId = round?.driveId ?? drive?.id;
    if (!driveId) continue;
    if (!groupedHistory[driveId]) {
      groupedHistory[driveId] = {
        driveId,
        companyName: company?.name || "Unknown Company",
        jobRole: drive?.jobRole || "Unknown Role",
        interviewDate: drive?.interviewDate || null,
        rounds: [],
      };
    }
    groupedHistory[driveId].rounds.push({
      order: round?.order,
      roundName: round?.roundName,
      roundDate: round?.roundDate,
      result: rr.result,
      remarks: rr.remarks,
      notes: rr.notes,
      rejectionReason: rr.rejectionReason,
      interviewDate: rr.interviewDate,
    });
  }
  const interviewHistory = Object.values(groupedHistory);

  let currentRoundLabel = "—";
  for (const grp of interviewHistory) {
    const sorted = [...grp.rounds].sort((a, b) => (a.order || 0) - (b.order || 0));
    const lastNonPending = [...sorted].reverse().find(
      (r) => r.result && r.result !== "Pending"
    );
    if (lastNonPending) {
      currentRoundLabel = `${grp.companyName} — Round ${lastNonPending.order}: ${lastNonPending.roundName} (${lastNonPending.result})`;
      break;
    }
  }

  const shortlistRows = await ShortlistStudent.findAll({
    where: { studentId },
  }).catch(() => []);
  const shortlistIds = shortlistRows.map((r) => r.shortlistId).filter(Boolean);

  let shortlists = [];
  if (shortlistIds.length > 0) {
    shortlists = await Shortlist.findAll({
      where: { id: { [Op.in]: shortlistIds } },
      include: [
        {
          model: PlacementDrive,
          as: "drive",
          include: [{ model: Company, as: "company" }],
        },
      ],
    }).catch(() => []);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = [];
  const appliedCompaniesSet = new Map();

  for (const sl of shortlists) {
    const drive = sl?.drive;
    if (!drive) continue;
    if (drive.interviewDate) {
      const d = new Date(drive.interviewDate);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() >= today.getTime()) {
        upcoming.push({
          driveId: drive.id,
          companyName: drive.company?.name || "Unknown Company",
          jobRole: drive.jobRole,
          interviewDate: drive.interviewDate,
          mode: "TBD",
        });
      }
    }
    appliedCompaniesSet.set(drive.id, {
      driveId: drive.id,
      companyName: drive.company?.name || "Unknown Company",
      jobRole: drive.jobRole,
      packageLPA: drive.packageLPA,
      interviewDate: drive.interviewDate,
      driveStatus: drive.driveStatus,
    });
  }

  const drivesShortlisted = Array.from(appliedCompaniesSet.values());

  return {
    applications,
    drivesShortlisted,
    upcoming,
    interviewHistory,
    currentRoundLabel,
    counts: {
      applications: applications.length,
      drivesShortlisted: drivesShortlisted.length,
      upcoming: upcoming.length,
    },
  };
}

module.exports = {
  computeCompletion,
  getActiveResume,
  loadProfileBundle,
  loadDashboardData,
};
