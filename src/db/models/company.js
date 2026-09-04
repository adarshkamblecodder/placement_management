const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Company = sequelize.define(
  "tracker_company",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    role: { type: DataTypes.STRING(100), allowNull: true },
    package: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    eligibility_criteria: { type: DataTypes.TEXT, allowNull: true },
    // New fields
    industry: { type: DataTypes.STRING(100), allowNull: true },
    website: { type: DataTypes.STRING(255), allowNull: true },
    hr_contact: { type: DataTypes.STRING(150), allowNull: true },
    tier: { type: DataTypes.STRING(50), allowNull: true, defaultValue: "Tier 1" },
    rating: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 4.5 },
    tpoNotes: { type: DataTypes.TEXT, allowNull: true },
    visitHistory: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "tracker_company",
    timestamps: false,
  }
);

module.exports = { Company };

