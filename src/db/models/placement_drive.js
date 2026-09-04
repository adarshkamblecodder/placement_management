const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const PlacementDrive = sequelize.define(
  "placement_drive",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    companyId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tracker_company", key: "id" },
    },
    jobRole: { type: DataTypes.STRING(150), allowNull: false },
    jobDescription: { type: DataTypes.TEXT, allowNull: true },
    driveLocation: { type: DataTypes.STRING(255), allowNull: true },
    interviewDate: { type: DataTypes.DATEONLY, allowNull: false },
    numberOfOpenings: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    minCGPA: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.0 },
    eligibleBranches: { type: DataTypes.STRING(255), allowNull: true },
    technicalSkills: { type: DataTypes.STRING(255), allowNull: true },
    packageLPA: { type: DataTypes.FLOAT, allowNull: true },
    maxBacklogs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    eligibleGraduationYear: { type: DataTypes.INTEGER, allowNull: true },
    lifecycleStage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Announced",
    },
    allowMultipleOffers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    driveStatus: {
      type: DataTypes.ENUM("upcoming", "ongoing", "completed"),
      allowNull: false,
      defaultValue: "upcoming",
    },
  },
  {
    tableName: "placement_drives",
    timestamps: true,
  }
);

module.exports = { PlacementDrive };
