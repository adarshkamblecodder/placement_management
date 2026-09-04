const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

/**
 * Resume file metadata for a student. Files live under media/resumes/*.
 * Multiple resumes are kept for history; the most recent active one is
 * surfaced as the primary resume in dashboards.
 */
const Resume = sequelize.define(
  "tracker_resume",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    studentId: { type: DataTypes.STRING(50), allowNull: false },

    storagePath: { type: DataTypes.STRING(255), allowNull: false },
    originalFilename: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(100), allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false },

    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "tracker_resume",
    timestamps: true,
    indexes: [
      { fields: ["studentId"] },
      { fields: ["studentId", "isActive"] },
    ],
  }
);

module.exports = { Resume };
