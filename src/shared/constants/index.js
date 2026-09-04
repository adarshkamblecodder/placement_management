/**
 * Application Constants & Enums
 */

const ROLES = Object.freeze({
  SUPERADMIN: "superadmin",
  TPO: "tpo",
  COORDINATOR: "coordinator",
  STUDENT: "student",
});

const DRIVE_STATUSES = Object.freeze({
  ANNOUNCED: "Announced",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  SHORTLISTING: "Shortlisting",
  INTERVIEWS_IN_PROGRESS: "Interviews In Progress",
  RESULTS_DECLARED: "Results Declared",
  CLOSED: "Closed",
});

const APPLICATION_STATUSES = Object.freeze({
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  IN_PROGRESS: "In Progress",
  SELECTED: "Selected",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
});

const PROFILE_VERIFICATION_STATUSES = Object.freeze({
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
});

const OFFER_POLICIES = Object.freeze({
  STRICT_ONE_OFFER: "STRICT_ONE_OFFER",
  DREAM_TIER: "DREAM_TIER",
  ALLOW_MULTIPLE: "ALLOW_MULTIPLE",
});

const BRANCHES = Object.freeze(["CS", "AIML", "AIDS", "MBA"]);

module.exports = {
  ROLES,
  DRIVE_STATUSES,
  APPLICATION_STATUSES,
  PROFILE_VERIFICATION_STATUSES,
  OFFER_POLICIES,
  BRANCHES,
};
