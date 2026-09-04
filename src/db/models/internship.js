const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Internship = sequelize.define(
  "tracker_internship",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // FK → tracker_student.student_id
    studentId: { type: DataTypes.STRING(50), allowNull: false },

    // ── Internship Details ─────────────────────────────────────────────
    status: {
      type: DataTypes.ENUM("Completed", "Ongoing", "Not Done"),
      allowNull: false,
      defaultValue: "Completed",
    },
    companyName:      { type: DataTypes.STRING(150), allowNull: false },
    internshipType:   {
      type: DataTypes.ENUM("Technical", "Non-Technical", "Research"),
      allowNull: false,
      defaultValue: "Technical",
    },
    domain:     { type: DataTypes.STRING(150), allowNull: false },
    role:       { type: DataTypes.STRING(150), allowNull: false },
    startDate:  { type: DataTypes.DATEONLY,    allowNull: false },
    endDate:    { type: DataTypes.DATEONLY,    allowNull: false },
    // Stored as plain string, e.g. "2 months 3 days" — computed on save
    duration:   { type: DataTypes.STRING(100), allowNull: true },
    workMode:   {
      type: DataTypes.ENUM("On-site", "Remote", "Hybrid"),
      allowNull: false,
      defaultValue: "On-site",
    },
    description: { type: DataTypes.TEXT, allowNull: true },

    // ── Internship Work ────────────────────────────────────────────────
    projectTitle:     { type: DataTypes.STRING(200), allowNull: true },
    responsibilities: { type: DataTypes.TEXT,        allowNull: true },
    skillsUsed:       { type: DataTypes.TEXT,        allowNull: true },
    outcome:          { type: DataTypes.TEXT,        allowNull: true },

    // ── Certificate ────────────────────────────────────────────────────
    certificateFile:      { type: DataTypes.STRING(255), allowNull: true },
    certificateNumber:    { type: DataTypes.STRING(100), allowNull: true },
    certificateIssueDate: { type: DataTypes.DATEONLY,    allowNull: true },

    // ── Supervisor ─────────────────────────────────────────────────────
    mentorName:    { type: DataTypes.STRING(150), allowNull: true },
    mentorContact: { type: DataTypes.STRING(150), allowNull: true },

    // ── Employment / PPO ───────────────────────────────────────────────
    stipendReceived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    stipendAmount:   { type: DataTypes.FLOAT,   allowNull: true },
    ppoOffered:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ppoPackage:      { type: DataTypes.FLOAT,   allowNull: true },

    // ── Admin Verification ─────────────────────────────────────────────
    verificationStatus: {
      type: DataTypes.ENUM("Pending", "Verified", "Rejected"),
      allowNull: false,
      defaultValue: "Pending",
    },
    verificationRemarks: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "tracker_internship",
    timestamps: true,
  }
);

module.exports = { Internship };
