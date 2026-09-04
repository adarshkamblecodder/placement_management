const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

/**
 * Structured project records per student.
 * Replaces the old free-text `projects` column in tracker_student_profile.
 * Old text data in that column is left untouched for backward compatibility.
 */
const StudentProject = sequelize.define(
  "tracker_student_project",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // FK → tracker_student.student_id
    studentId: { type: DataTypes.STRING(50), allowNull: false },

    // ── Core ──────────────────────────────────────────────────────────────
    projectType: {
      type: DataTypes.ENUM("LIVE", "NORMAL"),
      allowNull: false,
      defaultValue: "NORMAL",
      comment: "LIVE = real-world/client project, NORMAL = academic/personal project (displayed as Academic)",
    },
    title:       { type: DataTypes.STRING(200), allowNull: false },
    domain:      { type: DataTypes.STRING(150), allowNull: true },
    description: { type: DataTypes.TEXT,        allowNull: true },

    // ── Technical details ─────────────────────────────────────────────────
    technologiesUsed: { type: DataTypes.STRING(500), allowNull: true },
    role:             { type: DataTypes.STRING(150),  allowNull: true },

    // ── Duration ──────────────────────────────────────────────────────────
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate:   { type: DataTypes.DATEONLY, allowNull: true },
    duration:  { type: DataTypes.STRING(100), allowNull: true },

    // ── Status ────────────────────────────────────────────────────────────
    projectStatus: {
      type: DataTypes.ENUM("Ongoing", "Completed", "On Hold"),
      allowNull: false,
      defaultValue: "Completed",
    },

    // ── Links ─────────────────────────────────────────────────────────────
    projectUrl: { type: DataTypes.STRING(500), allowNull: true },
    githubUrl:  { type: DataTypes.STRING(500), allowNull: true },

    // ── Team ──────────────────────────────────────────────────────────────
    teamSize:    { type: DataTypes.INTEGER,      allowNull: true },
    teamMembers: { type: DataTypes.STRING(500),  allowNull: true },

    // ── Live-project extra ────────────────────────────────────────────────
    clientOrOrganization: { type: DataTypes.STRING(200), allowNull: true,
      comment: "Client / org name for LIVE projects (optional)" },
  },
  {
    tableName: "tracker_student_project",
    timestamps: true,
    indexes: [{ fields: ["studentId"] }],
  }
);

module.exports = { StudentProject };
