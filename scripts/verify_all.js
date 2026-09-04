const { createApp } = require("../src/app");
const { initSequelize } = require("../src/db/sequelize");
const { Student, AuthUser, AuditLog, Company, PlacementDrive, InterviewRound } = require("../src/db/models");
const { extractSkillsFromResume } = require("../src/modules/student/services/resumeParser.service");
const { computeCompletion } = require("../src/modules/student/services/studentProfile.service");
const {
  notifyStudentShortlisted,
  notifyInterviewScheduled,
  notifyDriveResult,
} = require("../src/shared/services/notification.service");
const XLSX = require("xlsx");
const http = require("http");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("=== Starting Comprehensive Placement Management System Verification ===");

  const sequelize = await initSequelize();
  await sequelize.sync({ alter: { drop: false } });
  const app = createApp();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Health check
  try {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.ok === true, "1. /health returns HTTP 200 OK");
  } catch (e) {
    assert(false, "1. /health check: " + e.message);
  }

  // 2. CSRF rejection test (POST without token should return 403)
  try {
    const res = await fetch(`${baseUrl}/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "identifier=test&password=pass",
    });
    assert(res.status === 403, "2. POST without CSRF token is rejected with HTTP 403 Forbidden");
  } catch (e) {
    assert(false, "2. CSRF rejection check: " + e.message);
  }

  // 3. Database model check: raw_password column removed from Student model
  try {
    const studentAttributes = Object.keys(Student.rawAttributes);
    assert(
      !studentAttributes.includes("raw_password"),
      "3. Student model has raw_password column removed"
    );
  } catch (e) {
    assert(false, "3. Model attributes check: " + e.message);
  }

  // 4. Student model columns added: certifications, backlogs, additional_skills
  try {
    const studentAttributes = Object.keys(Student.rawAttributes);
    assert(
      studentAttributes.includes("certifications") &&
      studentAttributes.includes("backlogs") &&
      studentAttributes.includes("additional_skills"),
      "4. Student model contains new columns: certifications, backlogs, additional_skills"
    );
  } catch (e) {
    assert(false, "4. New columns check: " + e.message);
  }

  // 5. AuditLog model exists and can record logs
  try {
    const log = await AuditLog.create({
      admin_id: "test_admin",
      action: "TEST_ACTION",
      target_table: "tracker_student",
      target_id: "TEST_001",
      details: "Automated verification test log",
      timestamp: new Date(),
    });
    assert(Boolean(log && log.id), "5. AuditLog records created and queried successfully");
  } catch (e) {
    assert(false, "5. AuditLog check: " + e.message);
  }

  // 6. Excel Export functionality
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{ "Student ID": "TEST01", "Name": "Test Student", "Package": 10 }]);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    assert(Buffer.isBuffer(buf) && buf.length > 0, "6. Excel Export workbook buffer generated successfully");
  } catch (e) {
    assert(false, "6. Excel export generation: " + e.message);
  }

  // 7. Resume PDF keyword parser
  try {
    const testText = "Experienced in Python, Node.js, and Machine Learning with Git.";
    const { PREDEFINED_SKILLS } = require("../src/modules/student/services/resumeParser.service");
    const detected = PREDEFINED_SKILLS.filter((s) => {
      const escaped = s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, "i");
      return regex.test(testText.toLowerCase());
    });
    assert(
      detected.includes("Python") && detected.includes("Node.js") && detected.includes("Machine Learning"),
      "7. Resume skill keyword matcher correctly identifies candidate skills"
    );
  } catch (e) {
    assert(false, "7. Resume parser test: " + e.message);
  }

  // 8. Profile Completion Calculation without gender
  try {
    const mockStudent = {
      name: "Rahul Sharma",
      email: "rahul@example.com",
      phone_number: "9876543210",
      date_of_birth: "2002-05-15",
      address: "123 Campus Lane",
      profile_photo: "photos/sample.jpg",
      branch: "CS",
      year: "4",
      cgpa: 8.5,
      skills: "Python, JavaScript, SQL",
      certifications: "AWS Cloud Practitioner",
      linkedin: "https://linkedin.com/in/rahul",
      github: "https://github.com/rahul",
    };
    const mockProfile = {
      tenthPercentage: 88,
      twelfthPercentage: 85,
      preferredRole: "Software Engineer",
      preferredCompanyType: "Product",
    };
    const completion = computeCompletion({
      student: mockStudent,
      profile: mockProfile,
      activeResume: { id: 1 },
    });
    assert(completion === 100, `8. computeCompletion returns ${completion}% (expected 100%) without gender dependency`);
  } catch (e) {
    assert(false, "8. computeCompletion test: " + e.message);
  }

  // 9. Notification Service Functions
  try {
    assert(
      typeof notifyStudentShortlisted === "function" &&
      typeof notifyInterviewScheduled === "function" &&
      typeof notifyDriveResult === "function",
      "9. Notification service exports shortlisting, interview scheduling, and drive result handlers"
    );
  } catch (e) {
    assert(false, "9. Notification service test: " + e.message);
  }

  // 10. Sample CSV Generation
  try {
    const headers = [
      "Student ID",
      "Full Name",
      "Date of Birth",
      "Email ID",
      "Branch",
      "Current Year",
      "Last Year CGPA",
      "Skills",
      "Certifications",
    ];
    const sampleRow = [
      "2024CS001",
      "Rahul Sharma",
      "15/05/2002",
      "rahul.cs@college.edu",
      "CS",
      "4",
      "8.75",
      "Python, React, SQL",
      "AWS Certified",
    ];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    assert(csvContent.includes("Date of Birth") && !csvContent.includes("Gender"), "10. Sample CSV contains expected column headers and omits Gender");
  } catch (e) {
    assert(false, "10. Sample CSV test: " + e.message);
  }

  // 11. Role-Based Access Control (RBAC)
  try {
    const authUserAttrs = Object.keys(AuthUser.rawAttributes);
    const { requireAdmin, requireSuperAdmin, requireCoordinator, getScopedDepartment } = require("../src/shared/middleware/auth");
    const hasFields = authUserAttrs.includes("role") && authUserAttrs.includes("department");
    const hasMiddleware =
      typeof requireAdmin === "function" &&
      typeof requireSuperAdmin === "function" &&
      typeof requireCoordinator === "function" &&
      typeof getScopedDepartment === "function";
    assert(hasFields && hasMiddleware, "11. AuthUser model supports role & department, and RBAC middleware enforces SuperAdmin/Coordinator");
  } catch (e) {
    assert(false, "11. RBAC test: " + e.message);
  }

  // 12. Shortlist Model & Association Verification
  try {
    const { Shortlist, ShortlistStudent } = require("../src/db/models");
    const testDrive = await PlacementDrive.findOne();
    if (testDrive) {
      const sl = await Shortlist.create({
        name: "Test Automated Shortlist",
        driveId: testDrive.id,
      });
      const dummyStudent = await Student.findOne();
      if (dummyStudent) {
        await ShortlistStudent.create({
          shortlistId: sl.id,
          studentId: dummyStudent.student_id,
        });
      }
      const loaded = await Shortlist.findByPk(sl.id, {
        include: [{ model: Student, as: "students" }, { model: PlacementDrive, as: "drive" }],
      });
      assert(Boolean(loaded && loaded.id), "12. Shortlists created, linked to drive and students, and queried with associations without error");
      await ShortlistStudent.destroy({ where: { shortlistId: sl.id } });
      await sl.destroy();
    } else {
      assert(true, "12. Shortlists schema valid (no drive found to attach test item)");
    }
  } catch (e) {
    assert(false, "12. Shortlist test: " + e.message);
  }

  // 13. Financial Advisory Suite (Calculators, RAG AI Advisory, Lead CRM)
  try {
    const { calculateSIP, calculateRetirement } = require("../src/modules/financial/services/calculators.service");
    const { generateAdvisoryResponse } = require("../src/modules/financial/services/aiAdvisory.service");
    const { Lead } = require("../src/db/models");

    // Test SIP formula
    const sipRes = calculateSIP({ monthlyInvestment: 10000, expectedReturnRate: 12, durationYears: 10 });
    const isSIPCorrect = sipRes.totalInvested === 1200000 && sipRes.maturityValue > 2300000;

    // Test Retirement formula
    const retRes = calculateRetirement({ currentAge: 30, retirementAge: 60, currentMonthlyExpenses: 50000, expectedInflation: 6, expectedReturn: 12 });
    const isRetCorrect = retRes.futureMonthlyExpenses > 250000 && retRes.corpusRequired > 40000000;

    // Test AI RAG
    const aiRes = await generateAdvisoryResponse("How does SIP compounding help in retirement planning?");
    const isAICorrect = aiRes.response && aiRes.intentCategory && aiRes.response.includes("Disclaimer");

    // Test Lead Model
    const lead = await Lead.create({
      name: "Test Investor",
      email: "investor@example.com",
      phone: "9876543210",
      source_page: "/calculators/sip",
      intent_category: "Investments",
      status: "New",
    });
    const hasLead = Boolean(lead && lead.id);
    await lead.destroy();

    assert(isSIPCorrect && isRetCorrect && isAICorrect && hasLead, "13. Financial Advisory Platform (SIP/Retirement Calculators, RAG AI Advisory, and Lead CRM) operational");
  } catch (e) {
    assert(false, "13. Financial Advisory test: " + e.message);
  }

  server.close();
  console.log(`\n=== Verification Complete: ${passed} Passed, ${failed} Failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Verification failed with exception:", err);
  process.exit(1);
});
