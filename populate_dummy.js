const { Op } = require("sequelize");
const { AuthUser, Student, Company } = require("./src/db/models");
const { initSequelize, getSequelize } = require("./src/db/sequelize");
const { hashDjangoPassword } = require("./src/auth/djangoPbkdf2");

const COMPANIES = ["Google", "Microsoft", "Amazon", "TCS", "Infosys", "Wipro", "Accenture", "Cognizant", "Capgemini", "IBM"];
const BRANCHES = ["CS", "AI ML", "AI DS"];
const YEARS = ["FY", "SY", "TY", "Final"];
const PLACED_YEARS = ["2023", "2024", "2025"];

const NAMES_M = ["Aarav", "Vihaan", "Vivaan", "Ananya", "Rohan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Shaurya"];
const NAMES_F = ["Saanvi", "Aadya", "Kiara", "Diya", "Pihu", "Prisha", "Navya", "Kavya", "Myra", "Ira", "Sara", "Zara"];
const SURNAMES = ["Sharma", "Verma", "Singh", "Gupta", "Das", "Patel", "Kumar", "Rao", "Reddy", "Nair", "Iyer"];

async function run() {
  await initSequelize();
  const sequelize = getSequelize();

  console.log("Syncing database schema (force: true)...");
  await sequelize.sync({ force: true });

  console.log("Creating dummy students...");
  
  const images = [1, 2, 3, 4, 5, 6].map(i => `photos/photo${i}.jpg`);
  console.log(`Assigning randomly from ${images.length} existing photo files...`);

  // Default PBKDF2 hash settings to match Django 4.2
  const digest = "sha256";
  const iterations = 1200000;
  const saltLength = 22;
  const hashedPassword = hashDjangoPassword("dummy", { digest, iterations, saltLength });

  for (let i = 1; i <= 15; i++) {
    const student_id = `dummy${i}`;
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const first_name = gender === 'M' 
      ? NAMES_M[Math.floor(Math.random() * NAMES_M.length)] 
      : NAMES_F[Math.floor(Math.random() * NAMES_F.length)];
    const last_name = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const name = `${first_name} ${last_name}`;
    const branch = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
    const year = "Final";
    const cgpa = (6.0 + Math.random() * 3.8).toFixed(2);
    
    const is_placed = Math.random() < 0.7;
    const status = is_placed ? "Placed" : "Not Placed";

    const user = await AuthUser.create({
      username: student_id,
      password: hashedPassword,
      is_staff: false,
      is_superuser: false,
      is_active: true,
      first_name: "",
      last_name: "",
      email: "",
      date_joined: new Date(),
    });

    const studentData = {
      user_id: user.id,
      student_id: student_id,
      name: name,
      date_of_birth: "2002-05-15",
      gender: gender,
      branch: branch,
      year: year,
      cgpa: Number(cgpa),
      phone_number: `9876543${String(i).padStart(3, '0')}`,
      email: `${student_id}@college.edu`,
      placement_status: status,
      profile_photo: images[Math.floor(Math.random() * images.length)]
    };

    if (is_placed) {
      const comp = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
      studentData.placement_company = comp;
      studentData.placement_package = Number((3.5 + Math.random() * 21.5).toFixed(2));
      studentData.placement_year = PLACED_YEARS[Math.floor(Math.random() * PLACED_YEARS.length)];
      
      const existing = await Company.findOne({ where: { name: comp } });
      if (!existing) {
        await Company.create({
          name: comp,
          role: 'Analyst / SDE',
          package: studentData.placement_package,
          eligibility_criteria: 'Auto-generated from dummy data'
        });
      }
    }

    await Student.create(studentData);
    console.log(`Created: ${name} (${student_id}) - Status: ${status} | Photo assigned: Yes`);
  }
  
  console.log("-".repeat(40));
  console.log(`Successfully generated 15 dummy students (dummy1 to dummy15) with password 'dummy'.`);
  console.log("Run this script via: node populate_dummy.js");
  
  process.exit(0);
}

run().catch(console.error);
