const { AuthUser } = require("./auth_user");
const { Student } = require("./student");
const { Company } = require("./company");
const { Application } = require("./application");
const { Placement } = require("./placement");
const { Job } = require("./job");
const { PlacementDrive } = require("./placement_drive");
const { Shortlist } = require("./shortlist");
const { ShortlistStudent, SHORTLIST_STUDENT_STATUSES } = require("./shortlist_student");
const { InterviewRound } = require("./interview_round");
const { StudentRoundResult } = require("./student_round_result");
const { StudentLoginMeta } = require("./student_login_meta");
const { StudentProfile } = require("./student_profile");
const { Resume } = require("./resume");
const { AuditLog } = require("./audit_log");
const { Internship } = require("./internship");
const { StudentProject } = require("./student_project");

// Associations help when we later build route handlers that join tables.
function initAssociations() {
  // Django OneToOneField: Student.user -> auth_user
  AuthUser.hasOne(Student, { foreignKey: "user_id" });
  Student.belongsTo(AuthUser, { foreignKey: "user_id" });

  // Application FKs
  Application.belongsTo(Student, { foreignKey: "student_id" });
  Application.belongsTo(Company, { foreignKey: "company_id" });

  // Placement FKs
  Placement.belongsTo(Student, { foreignKey: "student_id" });
  Placement.belongsTo(Company, { foreignKey: "company_id" });

  // Job FKs
  Company.hasMany(Job, { foreignKey: "company_id" });
  Job.belongsTo(Company, { foreignKey: "company_id" });

  Job.hasMany(Application, { foreignKey: "job_id" });
  Application.belongsTo(Job, { foreignKey: "job_id" });

  // PlacementDrive FKs — one Company → many PlacementDrives
  Company.hasMany(PlacementDrive, { foreignKey: "companyId", as: "drives" });
  PlacementDrive.belongsTo(Company, { foreignKey: "companyId", as: "company" });

  // Shortlist FKs — one PlacementDrive → many Shortlists
  PlacementDrive.hasMany(Shortlist, { foreignKey: "driveId" });
  Shortlist.belongsTo(PlacementDrive, { foreignKey: "driveId", as: "drive" });

  // Shortlist <-> Student many-to-many via ShortlistStudent
  // studentId references tracker_student.student_id (STRING PK)
  Shortlist.belongsToMany(Student, {
    through: ShortlistStudent,
    foreignKey: "shortlistId",
    otherKey: "studentId",
    as: "students",
  });
  Student.belongsToMany(Shortlist, {
    through: ShortlistStudent,
    foreignKey: "studentId",
    otherKey: "shortlistId",
    as: "shortlists",
  });

  // Direct associations on ShortlistStudent for eager-loading the parent shortlist
  // (used by the student interview-rounds page to surface absent drive info)
  ShortlistStudent.belongsTo(Shortlist, { foreignKey: "shortlistId", as: "shortlist" });
  Shortlist.hasMany(ShortlistStudent, { foreignKey: "shortlistId", as: "shortlistStudents" });

  // Interview Rounds
  PlacementDrive.hasMany(InterviewRound, { foreignKey: 'driveId', as: 'rounds' });
  InterviewRound.belongsTo(PlacementDrive, { foreignKey: 'driveId', as: 'drive' });

  // Round Results
  InterviewRound.hasMany(StudentRoundResult, { foreignKey: 'roundId', as: 'results' });
  StudentRoundResult.belongsTo(InterviewRound, { foreignKey: 'roundId', as: 'round' });
  StudentRoundResult.belongsTo(Student, { foreignKey: 'studentId', targetKey: 'student_id' });
  Student.hasMany(StudentRoundResult, { foreignKey: 'studentId', sourceKey: 'student_id' });

  // Student login meta (one-to-one by studentId)
  Student.hasOne(StudentLoginMeta, { foreignKey: "studentId", sourceKey: "student_id" });
  StudentLoginMeta.belongsTo(Student, { foreignKey: "studentId", targetKey: "student_id" });

  AuthUser.hasOne(StudentLoginMeta, { foreignKey: "authUserId", sourceKey: "id" });
  StudentLoginMeta.belongsTo(AuthUser, { foreignKey: "authUserId", targetKey: "id" });

  // Extended student profile (1:1 by studentId)
  Student.hasOne(StudentProfile, {
    foreignKey: "studentId",
    sourceKey: "student_id",
    as: "profile",
  });
  StudentProfile.belongsTo(Student, {
    foreignKey: "studentId",
    targetKey: "student_id",
  });

  // Resumes (1:N by studentId)
  Student.hasMany(Resume, {
    foreignKey: "studentId",
    sourceKey: "student_id",
    as: "resumes",
  });
  Resume.belongsTo(Student, {
    foreignKey: "studentId",
    targetKey: "student_id",
  });

  // Internships (1:N by studentId)
  Student.hasMany(Internship, {
    foreignKey: "studentId",
    sourceKey: "student_id",
    as: "internships",
  });
  Internship.belongsTo(Student, {
    foreignKey: "studentId",
    targetKey: "student_id",
  });

  // Student Projects (1:N by studentId)
  Student.hasMany(StudentProject, {
    foreignKey: "studentId",
    sourceKey: "student_id",
    as: "projects",
  });
  StudentProject.belongsTo(Student, {
    foreignKey: "studentId",
    targetKey: "student_id",
  });
}

initAssociations();

module.exports = {
  AuthUser, Student, Company, Application, Placement,
  Job, PlacementDrive, Shortlist, ShortlistStudent, SHORTLIST_STUDENT_STATUSES,
  InterviewRound, StudentRoundResult, StudentLoginMeta,
  StudentProfile, Resume, AuditLog,
  Internship,
  StudentProject,
};
