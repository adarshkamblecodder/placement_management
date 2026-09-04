const { DataTypes } = require("sequelize");
const { getSequelize } = require("../sequelize");

const sequelize = getSequelize();

/**
 * Per-drive status for a shortlisted student.
 * This is the source of truth for where a student stands in ONE specific drive.
 * The global Student.placement_status should only ever be "Not Placed" or "Placed".
 *
 * Status lifecycle:
 *   Shortlisted → (rounds run) → Rejected | Selected
 *   Selected    → (TPO confirms) → [Student marked Placed globally]
 *   Selected    → (student declines) → Offer Declined
 *   Shortlisted → (student no-show) → Absent
 */
const SHORTLIST_STUDENT_STATUSES = [
  "Shortlisted",    // default — appeared / active in this drive
  "Absent",         // did not appear for the interview
  "Rejected",       // eliminated during rounds
  "Selected",       // passed all rounds, got the offer (pending TPO confirmation)
  "Offer Declined", // got offer but student rejected it
  "Withdrawn",      // removed by TPO manually
];

const ShortlistStudent = sequelize.define(
  "shortlist_student",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    shortlistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "shortlists", key: "id" },
    },
    studentId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: { model: "tracker_student", key: "student_id" },
    },
    // Per-drive status — tracks this student's progress in THIS drive only
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Shortlisted",
      validate: {
        isIn: [SHORTLIST_STUDENT_STATUSES],
      },
    },
    // Optional notes the TPO can add per student per drive
    statusNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "shortlist_students",
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = { ShortlistStudent, SHORTLIST_STUDENT_STATUSES };
