const { Student } = require("../src/db/models");

async function addDummies() {
  const branches = ["CS", "AIML", "AIDS", "MBA"];
  for (const branch of branches) {
    const studentId = `DUMMY_${branch}_001`;
    const existing = await Student.findByPk(studentId);
    if (!existing) {
      await Student.create({
        student_id: studentId,
        user_id: null,
        placement_status: "Not Placed",
        name: `Dummy ${branch} Student`,
        date_of_birth: "2000-01-01",
        email: `dummy_${branch.toLowerCase()}@example.com`,
        branch: branch,
        year: "1",
        cgpa: 8.0,
        skills: "Python, SQL, JavaScript",
        certifications: "AWS Cloud Practitioner, Python Institute",
        backlogs: 0,
      });
      console.log(`Added dummy student for ${branch}`);
    } else {
      console.log(`Dummy student for ${branch} already exists`);
    }
  }
}

addDummies().then(() => {
  console.log("Done");
  process.exit(0);
}).catch((err) => {
  console.error("Error adding dummies:", err);
  process.exit(1);
});
