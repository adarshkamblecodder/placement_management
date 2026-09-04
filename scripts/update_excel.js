const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "..", "student_import_template.xlsx");

const headers = [
  "Student ID",
  "Full Name",
  "Gender",
  "Email ID",
  "Branch",
  "Current Year",
  "CGPA",
];

const data = [
  {
    "Student ID": "2024CS001",
    "Full Name": "Aarav Sharma",
    Gender: "Male",
    "Email ID": "aarav.sharma@example.com",
    Branch: "CS",
    "Current Year": 4,
    CGPA: 8.85,
  },
  {
    "Student ID": "2024AI002",
    "Full Name": "Ananya Verma",
    Gender: "Female",
    "Email ID": "ananya.verma@example.com",
    Branch: "AIML",
    "Current Year": 3,
    CGPA: 9.1,
  },
];

const ws = XLSX.utils.json_to_sheet(data, { header: headers });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Students");

XLSX.writeFile(wb, filePath);
console.log("Updated Excel template successfully!");
