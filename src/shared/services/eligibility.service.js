/**
 * Eligibility Automation Service
 * Validates whether a candidate meets all criteria for a Placement Drive.
 */

function checkEligibility(student, drive, { policy = "STRICT_ONE_OFFER" } = {}) {
  const reasons = [];

  if (!student || !drive) {
    return { isEligible: false, reasons: ["Invalid student or drive context."] };
  }

  // 1. CGPA Threshold
  const requiredCGPA = Number(drive.minCGPA) || 0.0;
  const studentCGPA = Number(student.cgpa) || 0.0;
  if (requiredCGPA > 0 && studentCGPA < requiredCGPA) {
    reasons.push(`Requires minimum CGPA ${requiredCGPA.toFixed(2)}, but your CGPA is ${studentCGPA.toFixed(2)}.`);
  }

  // 2. Active Backlogs Gate
  const allowedBacklogs = Number(drive.maxBacklogs) || 0;
  const studentBacklogs = Number(student.backlogs) || 0;
  if (studentBacklogs > allowedBacklogs) {
    reasons.push(`Requires maximum ${allowedBacklogs} active backlogs, but you have ${studentBacklogs}.`);
  }

  // 3. Eligible Branches
  if (drive.eligibleBranches && typeof drive.eligibleBranches === "string" && drive.eligibleBranches.trim()) {
    const branches = drive.eligibleBranches
      .split(/[,/ ]+/)
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean);

    const studentBranch = String(student.branch || "").trim().toUpperCase();
    if (branches.length > 0 && !branches.includes(studentBranch)) {
      reasons.push(`Eligible branches are [${branches.join(", ")}], but your branch is ${studentBranch || "Unspecified"}.`);
    }
  }

  // 4. Graduation Year
  if (drive.eligibleGraduationYear) {
    const studentYear = Number(student.year);
    const driveYear = Number(drive.eligibleGraduationYear);
    if (studentYear && driveYear && studentYear !== driveYear) {
      reasons.push(`Drive is targeted for Year ${driveYear}, you are Year ${studentYear}.`);
    }
  }

  // 5. One-Offer Policy Gate
  if (policy === "STRICT_ONE_OFFER" && student.placement_status === "Placed" && !drive.allowMultipleOffers) {
    reasons.push(`One-offer policy in effect: You have already accepted an offer at ${student.placement_company || "another company"}.`);
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
  };
}

module.exports = { checkEligibility };
