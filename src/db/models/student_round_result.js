const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

const StudentRoundResult = sequelize.define(
  "tracker_student_round_result",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    roundId: { type: DataTypes.INTEGER, allowNull: false },
    studentId: { type: DataTypes.STRING(50), allowNull: false },
    result: {
      // "Passed" = qualified for next round, "Qualified" kept as alias
      type: DataTypes.ENUM("Qualified", "Passed", "Rejected", "Pending"),
      allowNull: false,
      defaultValue: "Pending",
    },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    interviewDate: { type: DataTypes.DATEONLY, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "tracker_student_round_result",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["roundId", "studentId"],
      },
    ],
  }
);

module.exports = { StudentRoundResult };
