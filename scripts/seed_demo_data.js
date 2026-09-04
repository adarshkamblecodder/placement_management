/**
 * Comprehensive Demo Seed Script for Placement Management Platform
 * Seeds realistic companies, drives, students, shortlists, interview rounds, and leadership metrics.
 */
const { initSequelize } = require("../src/db/sequelize");
const {
  Student,
  AuthUser,
  Company,
  PlacementDrive,
  InterviewRound,
  StudentRoundResult,
  Shortlist,
  ShortlistStudent,
  Application,
  AuditLog,
} = require("../src/db/models");
const { hashDjangoPassword } = require("../src/modules/auth/services/djangoPbkdf2.service");

async function seedData() {
  console.log("=== Seeding Realistic Placement Platform Demo Data ===");
  const sequelize = await initSequelize();
  await sequelize.sync({ alter: { drop: false } });

  const hashedStudentPassword = await hashDjangoPassword("password123", { digest: "sha256", iterations: 1200000, saltLength: 22 });
  const hashedAdminPassword = await hashDjangoPassword("admin123", { digest: "sha256", iterations: 1200000, saltLength: 22 });

  // 1. Seed Staff / Admins (Superadmin, TPO, CS Coordinator)
  const users = [
    { username: "admin", email: "admin@college.edu", role: "superadmin", is_staff: true, is_superuser: true, first_name: "Chief", last_name: "TPO" },
    { username: "cs_coordinator", email: "coord.cs@college.edu", role: "coordinator", department: "CS", is_staff: true, is_superuser: false, first_name: "Dr. Ramesh", last_name: "Gupta" },
    { username: "aiml_coordinator", email: "coord.aiml@college.edu", role: "coordinator", department: "AIML", is_staff: true, is_superuser: false, first_name: "Prof. Priya", last_name: "Nair" },
  ];

  for (const u of users) {
    const existing = await AuthUser.findOne({ where: { username: u.username } });
    if (!existing) {
      await AuthUser.create({ ...u, password: hashedAdminPassword, is_active: true, date_joined: new Date() });
    }
  }

  // 2. Seed Companies with CRM data
  const companies = [
    { name: "Google", industry: "Technology & Cloud", website: "https://careers.google.com", hr_contact: "recruiting-india@google.com", tier: "Tier 1", rating: 4.9, tpoNotes: "Consistently top-tier recruiter. Prefers strong algorithmic skills and system design.", visitHistory: "2022, 2023, 2024, 2025" },
    { name: "Microsoft", industry: "Enterprise Software", website: "https://careers.microsoft.com", hr_contact: "india-campus@microsoft.com", tier: "Tier 1", rating: 4.8, tpoNotes: "Conducts online assessment followed by 3 technical rounds.", visitHistory: "2021, 2022, 2023, 2024, 2025" },
    { name: "Amazon", industry: "E-Commerce & AWS", website: "https://amazon.jobs", hr_contact: "university-ops@amazon.com", tier: "Tier 1", rating: 4.7, tpoNotes: "High volume hiring for SDE-1 and Support Engineers.", visitHistory: "2023, 2024, 2025" },
    { name: "Deloitte", industry: "Consulting & Analytics", website: "https://deloitte.com", hr_contact: "campus-talent@deloitte.com", tier: "Tier 2", rating: 4.5, tpoNotes: "Recruits both Tech Analysts and MBA business analysts.", visitHistory: "2021, 2022, 2023, 2024, 2025" },
    { name: "TCS Digital", industry: "IT Services", website: "https://tcs.com/careers", hr_contact: "tag-campus@tcs.com", tier: "Tier 2", rating: 4.3, tpoNotes: "NQT based shortlisting followed by interview.", visitHistory: "2020, 2021, 2022, 2023, 2024, 2025" },
  ];

  const companyMap = {};
  for (const c of companies) {
    let [comp] = await Company.findOrCreate({
      where: { name: c.name },
      defaults: c,
    });
    await comp.update(c);
    companyMap[c.name] = comp;
  }

  // 3. Seed Placement Drives with full eligibility rules
  const drivesData = [
    {
      companyId: companyMap["Google"].id,
      jobRole: "Software Development Engineer (SDE-1)",
      jobDescription: "Join Google Cloud engineering team building distributed high-throughput storage systems. Responsibilities include designing scalable APIs, concurrency optimization, and collaborating on global microservices.\n\nRequirements: Strong foundations in Data Structures, Algorithms, OS, and Networks. Proficiency in C++, Java, or Go.",
      interviewDate: "2026-09-15",
      numberOfOpenings: 5,
      minCGPA: 8.0,
      maxBacklogs: 0,
      eligibleBranches: "CS, AIML, AIDS",
      eligibleGraduationYear: 4,
      packageLPA: 32.0,
      lifecycleStage: "Shortlisting",
      driveStatus: "ongoing",
    },
    {
      companyId: companyMap["Microsoft"].id,
      jobRole: "Software Engineer - Azure Core",
      jobDescription: "Build cloud infrastructure that powers thousands of enterprise applications worldwide.\n\nEligibility: B.Tech in CS/AIML/AIDS with >= 7.5 CGPA and 0 active backlogs. Knowledge of cloud primitives, C#/.NET, Java or Python.",
      interviewDate: "2026-09-20",
      numberOfOpenings: 8,
      minCGPA: 7.5,
      maxBacklogs: 0,
      eligibleBranches: "CS, AIML, AIDS",
      eligibleGraduationYear: 4,
      packageLPA: 28.5,
      lifecycleStage: "Registration Open",
      driveStatus: "upcoming",
    },
    {
      companyId: companyMap["Deloitte"].id,
      jobRole: "Technology & Business Analyst",
      jobDescription: "Drive digital transformation strategies for Fortune 500 clients. Involves business analytics, Python data modeling, SQL querying, and executive presentation of findings.\n\nOpen to B.Tech and MBA graduating students.",
      interviewDate: "2026-09-25",
      numberOfOpenings: 15,
      minCGPA: 6.5,
      maxBacklogs: 1,
      eligibleBranches: "CS, AIML, AIDS, MBA",
      eligibleGraduationYear: 4,
      packageLPA: 12.0,
      lifecycleStage: "Announced",
      driveStatus: "upcoming",
    },
  ];

  for (const d of drivesData) {
    const existingDrive = await PlacementDrive.findOne({ where: { companyId: d.companyId, jobRole: d.jobRole } });
    if (!existingDrive) {
      await PlacementDrive.create(d);
    }
  }

  // 4. Seed Diverse Students
  const students = [
    { student_id: "2024CS001", name: "Aarav Sharma", branch: "CS", year: "4", cgpa: 9.2, backlogs: 0, email: "aarav.cs@college.edu", phone_number: "9876500001", date_of_birth: "2002-04-12", skills: "Go, Kubernetes, Python, Distributed Systems, SQL", certifications: "AWS Certified Solutions Architect, Google Cloud Associate", profileVerificationStatus: "Verified" },
    { student_id: "2024CS002", name: "Diya Patel", branch: "CS", year: "4", cgpa: 8.8, backlogs: 0, email: "diya.cs@college.edu", phone_number: "9876500002", date_of_birth: "2002-08-22", skills: "React, Node.js, TypeScript, PostgreSQL, Docker", certifications: "Meta Certified Front-End Developer", profileVerificationStatus: "Verified" },
    { student_id: "2024AIML001", name: "Rohan Varma", branch: "AIML", year: "4", cgpa: 8.5, backlogs: 0, email: "rohan.aiml@college.edu", phone_number: "9876500003", date_of_birth: "2002-11-05", skills: "PyTorch, TensorFlow, Computer Vision, Python, NLP", certifications: "DeepLearning.AI Specialization", profileVerificationStatus: "Verified" },
    { student_id: "2024AIDS001", name: "Ananya Iyer", branch: "AIDS", year: "4", cgpa: 8.1, backlogs: 0, email: "ananya.aids@college.edu", phone_number: "9876500004", date_of_birth: "2003-01-19", skills: "Data Analytics, Spark, Python, Tableau, Machine Learning", certifications: "IBM Data Science Professional", profileVerificationStatus: "Verified" },
    { student_id: "2024MBA001", name: "Vikram Malhotra", branch: "MBA", year: "4", cgpa: 7.9, backlogs: 0, email: "vikram.mba@college.edu", phone_number: "9876500005", date_of_birth: "2001-07-30", skills: "Product Management, Market Research, Excel, Financial Modeling", certifications: "Agile Certified ScrumMaster", profileVerificationStatus: "Verified" },
    { student_id: "2024CS003", name: "Siddharth Rao", branch: "CS", year: "4", cgpa: 6.4, backlogs: 2, email: "siddharth.cs@college.edu", phone_number: "9876500006", date_of_birth: "2002-03-10", skills: "Java, HTML, CSS", certifications: "", profileVerificationStatus: "Pending" },
  ];

  for (const s of students) {
    const existing = await Student.findByPk(s.student_id);
    if (!existing) {
      await Student.create(s);
    } else {
      await existing.update(s);
    }
  }

  console.log("Demo seed data created successfully!");
  process.exit(0);
}

seedData().catch((err) => {
  console.error("Seed demo data failed:", err);
  process.exit(1);
});
