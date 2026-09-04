/**
 * One-Offer Conflict Resolution Service
 * Handles placement offer acceptances, auto-withdrawing competing applications
 * under the configured college placement policy.
 */
const { Application, Student, Placement } = require("../../db/models");
const { recordAuditLog } = require("./audit.service");
const { notifyPlacementStatusUpdated } = require("./notification.service");

async function acceptOffer({ studentId, companyName, packageLPA, driveId = null, actorId = null, policy = "STRICT_ONE_OFFER" }) {
  const student = await Student.findByPk(studentId);
  if (!student) {
    throw new Error(`Student ${studentId} not found`);
  }

  // 1. Update Student's placement record
  await student.update({
    placement_status: "Placed",
    placement_company: companyName,
    placement_package: packageLPA ? Number(packageLPA) : student.placement_package,
    placement_year: new Date().getFullYear().toString(),
  });

  // 2. Create / update Placement record in tracker_placement
  // Placement model has: id, student_id, company_id, package
  // Look up company_id from company name if possible
  const { Company } = require("../../db/models");
  const company = await Company.findOne({ where: { name: companyName } }).catch(() => null);

  await Placement.findOrCreate({
    where: { student_id: studentId },
    defaults: {
      student_id: studentId,
      company_id: company?.id || null,
      package: packageLPA ? Number(packageLPA) : 0,
    },
  });

  let withdrawnCount = 0;

  // 3. One-offer policy enforcement: Auto-withdraw competing applications
  if (policy === "STRICT_ONE_OFFER") {
    const activeApplications = await Application.findAll({
      where: {
        student_id: studentId,
        status: ["Applied", "Shortlisted", "In Progress", "Pending"],
      },
    });

    for (const app of activeApplications) {
      if (driveId && app.job_id === driveId) continue;
      await app.update({ status: "Withdrawn" });
      withdrawnCount++;
    }
  }

  // 4. Audit Log
  await recordAuditLog({
    adminId: actorId,
    action: "ACCEPT_OFFER_ONE_OFFER_ENFORCEMENT",
    targetTable: "tracker_student",
    targetId: studentId,
    details: `Offer accepted from ${companyName} (${packageLPA || "N/A"} LPA). Auto-withdrew ${withdrawnCount} other active application(s). Policy: ${policy}`,
  });

  // 5. Notify student
  await notifyPlacementStatusUpdated({
    student,
    status: "Placed",
    companyName,
    packageLPA,
  });

  return {
    success: true,
    student,
    withdrawnCount,
  };
}

module.exports = { acceptOffer };
