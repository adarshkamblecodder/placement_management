const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Placement = sequelize.define(
  "tracker_placement",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    package: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    company_id: { type: DataTypes.BIGINT, allowNull: false },
    student_id: { type: DataTypes.STRING(50), allowNull: false },
  },
  {
    tableName: "tracker_placement",
    timestamps: false,
  }
);

module.exports = { Placement };

