const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const AuditLog = sequelize.define(
  "tracker_audit_log",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    target_table: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    target_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tracker_audit_log",
    timestamps: false,
  }
);

module.exports = { AuditLog };
