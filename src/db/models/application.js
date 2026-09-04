const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Application = sequelize.define(
  "tracker_application",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Applied" },

    // Django FK columns:
    company_id: { type: DataTypes.BIGINT, allowNull: true },
    student_id: { type: DataTypes.STRING(50), allowNull: false },
    
    // New fields
    job_id: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    applied_date: { type: DataTypes.DATEONLY, allowNull: true },
  },
  {
    tableName: "tracker_application",
    timestamps: false,
  }
);

module.exports = { Application };

