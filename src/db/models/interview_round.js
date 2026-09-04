const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const InterviewRound = sequelize.define(
  "tracker_interview_round",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    driveId: { type: DataTypes.INTEGER, allowNull: false },
    roundName: { type: DataTypes.STRING(100), allowNull: false },
    roundDate: { type: DataTypes.DATEONLY, allowNull: true },
    order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  {
    tableName: "tracker_interview_round",
    timestamps: true,
  }
);

module.exports = { InterviewRound };
