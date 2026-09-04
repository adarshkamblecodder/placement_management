const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const Shortlist = sequelize.define(
  "shortlist",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    driveId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "placement_drives", key: "id" },
    },
  },
  {
    tableName: "shortlists",
    timestamps: true,
  }
);

module.exports = { Shortlist };
