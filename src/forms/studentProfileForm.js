const { makeField } = require("./field");

function buildStudentProfileForm(student) {
  // Mirrors the field set in Django `StudentProfileForm`.
  return [
    makeField({
      name: "student_id",
      label: "Your Login ID (Primary Key)",
      value: student?.student_id || "",
      disabled: true,
    }),
    makeField({ name: "name", label: "Full Name", value: student?.name || "" }),
    makeField({ name: "date_of_birth", label: "Date of Birth", value: student?.date_of_birth || "", type: "date" }),
    makeField({ name: "email", label: "Email ID (Primary)", value: student?.email || "", type: "email" }),
    makeField({
      name: "branch",
      label: "Branch",
      value: student?.branch || "",
    }),
    makeField({ name: "year", label: "Year", value: student?.year || "" }),
    makeField({ name: "profile_photo", label: "Profile Photo", value: "", type: "file", helpText: "Required. Maximum size 40KB (JPG/PNG only).", accept: "image/*" }),
    makeField({
      name: "phone_number",
      label: "Phone Number",
      value: student?.phone_number || "",
    }),
    makeField({ name: "address", label: "Address", value: student?.address || "", type: "textarea" }),
    makeField({
      name: "cgpa",
      label: "CGPA",
      value: student?.cgpa != null ? String(student.cgpa) : "",
      type: "number",
    }),
    makeField({ name: "skills", label: "Skills", value: student?.skills || "", type: "textarea" }),
    makeField({
      name: "resume_link",
      label: "Resume Link",
      value: student?.resume_link || "",
    }),
    makeField({
      name: "linkedin",
      label: "LinkedIn (Optional)",
      value: student?.linkedin || "",
    }),
    makeField({
      name: "github",
      label: "GitHub (Optional)",
      value: student?.github || "",
    }),
  ];
}

function buildStudentProfileTemplateStudent(student) {
  // Template expects `student.profile_photo.url` when present.
  // Django stores relative paths; in this Node version we serve `/media`.
  const photoPath = student?.profile_photo;
  return {
    ...student,
    profile_photo: photoPath
      ? {
          url: `/media/${photoPath}`,
        }
      : null,
    get_year_display: student?.year || "",
  };
}

module.exports = { buildStudentProfileForm, buildStudentProfileTemplateStudent };

