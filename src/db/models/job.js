const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Job = sequelize.define(
  "tracker_job",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    package_lpa: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    interview_start_date: { type: DataTypes.DATEONLY, allowNull: true },
    interview_end_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.STRING(50), defaultValue: "Upcoming" },
  },
  {
    timestamps: true,
  }
);

module.exports = { Job };
