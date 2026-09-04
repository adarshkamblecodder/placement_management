const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

/**
 * Extended placement profile for a student.
 * Core identity/academic fields remain on `tracker_student`; this table holds
 * the placement-portal extras (preferences, projects, certifications, links).
 */
const StudentProfile = sequelize.define(
  "tracker_student_profile",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    studentId: { type: DataTypes.STRING(50), allowNull: false },

    bio: { type: DataTypes.TEXT, allowNull: true },
    tenthPercentage: { type: DataTypes.FLOAT, allowNull: true },
    twelfthPercentage: { type: DataTypes.FLOAT, allowNull: true },
    backlogs: { type: DataTypes.INTEGER, allowNull: true },

    certifications: { type: DataTypes.TEXT, allowNull: true },
    projects: { type: DataTypes.TEXT, allowNull: true },
    internshipExperience: { type: DataTypes.TEXT, allowNull: true },

    preferredRole: { type: DataTypes.STRING(150), allowNull: true },
    preferredCompanyType: { type: DataTypes.STRING(150), allowNull: true },

    portfolioUrl: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: "tracker_student_profile",
    timestamps: true,
    indexes: [{ unique: true, fields: ["studentId"] }],
  }
);

module.exports = { StudentProfile };
