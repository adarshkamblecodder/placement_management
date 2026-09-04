// Centralized status string constants used across modules.
const PLACEMENT_STATUS = Object.freeze({
  NOT_PLACED: "Not Placed",
  PLACED: "Placed",
  SHORTLISTED: "Shortlisted",
  REJECTED_INTERVIEW: "Rejected in Interview",
});

const ROUND_RESULT = Object.freeze({
  PENDING: "Pending",
  PASSED: "Passed",
  QUALIFIED: "Qualified",
  REJECTED: "Rejected",
});

const APPLICATION_STATUS = Object.freeze({
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  HIRED: "Hired",
});

const DRIVE_STATUS = Object.freeze({
  UPCOMING: "upcoming",
  ONGOING: "ongoing",
  COMPLETED: "completed",
});

module.exports = {
  PLACEMENT_STATUS,
  ROUND_RESULT,
  APPLICATION_STATUS,
  DRIVE_STATUS,
};
