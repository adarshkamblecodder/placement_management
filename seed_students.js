const { Student, Internship, StudentProject } = require("./src/db/models");
const { getSequelize } = require("./src/db/sequelize");

// ── Sample data pools ────────────────────────────────────────────────────────

const FIRST_NAMES_MALE   = ["Aarav", "Rohan", "Kiran", "Dev", "Arjun", "Vikram", "Nikhil", "Siddharth", "Rahul", "Aditya"];
const FIRST_NAMES_FEMALE = ["Priya", "Sneha", "Ananya", "Riya", "Pooja", "Divya", "Nisha", "Kavya", "Shreya", "Meera"];
const LAST_NAMES         = ["Sharma", "Patel", "Kumar", "Singh", "Mehta", "Joshi", "Verma", "Nair", "Gupta", "Reddy"];

const LIVE_PROJECT_TEMPLATES = [
  {
    title: "E-Commerce Platform for Local Retailer",
    domain: "Web Development",
    description: "Built a full-stack e-commerce solution with product catalog, cart, and payment integration for a local retail client.",
    technologiesUsed: "React, Node.js, MongoDB, Stripe",
    role: "Full Stack Developer",
    clientOrOrganization: "ShopLocal Pvt Ltd",
    githubUrl: "https://github.com/example/ecommerce",
  },
  {
    title: "Inventory Management System",
    domain: "Enterprise Software",
    description: "Developed a real-time inventory tracking system with barcode scanning support for a manufacturing unit.",
    technologiesUsed: "Angular, Django, PostgreSQL",
    role: "Backend Developer",
    clientOrOrganization: "Nexus Manufacturing",
    githubUrl: "https://github.com/example/inventory",
  },
  {
    title: "Hospital Appointment Booking App",
    domain: "Healthcare Tech",
    description: "Created a mobile-friendly appointment scheduling app used by a local clinic for patient management.",
    technologiesUsed: "Flutter, Firebase, REST APIs",
    role: "Mobile Developer",
    clientOrOrganization: "City Health Clinic",
    projectUrl: "https://cityhealth.in/book",
  },
  {
    title: "AI Chatbot for Customer Support",
    domain: "Artificial Intelligence",
    description: "Integrated an NLP-based chatbot to handle tier-1 support queries for an e-learning startup.",
    technologiesUsed: "Python, Rasa, FastAPI, Redis",
    role: "AI/ML Developer",
    clientOrOrganization: "LearnNow EdTech",
    githubUrl: "https://github.com/example/support-bot",
  },
  {
    title: "Real-Time Fleet Tracking Dashboard",
    domain: "IoT & Data Visualization",
    description: "Built a live GPS tracking dashboard for a logistics company, displaying vehicle routes and ETAs.",
    technologiesUsed: "Vue.js, Node.js, Socket.IO, Mapbox",
    role: "Frontend Developer",
    clientOrOrganization: "SwiftLogix",
    projectUrl: "https://fleet.swiftlogix.com",
  },
  {
    title: "Online Examination Portal",
    domain: "EdTech",
    description: "Developed a secure online test-taking platform with auto-grading and result analytics for a coaching institute.",
    technologiesUsed: "React, Express, MySQL",
    role: "Full Stack Developer",
    clientOrOrganization: "TopRank Academy",
    githubUrl: "https://github.com/example/exam-portal",
  },
  {
    title: "Supply Chain Analytics Tool",
    domain: "Data Analytics",
    description: "Built an analytics dashboard to visualize procurement and delivery bottlenecks for a retail chain.",
    technologiesUsed: "Python, Pandas, Tableau, PostgreSQL",
    role: "Data Analyst",
    clientOrOrganization: "RetailEdge India",
  },
  {
    title: "Smart Parking System",
    domain: "IoT",
    description: "Designed an IoT-based parking slot monitoring system with a web dashboard for a commercial complex.",
    technologiesUsed: "Arduino, MQTT, React, Node.js",
    role: "IoT Developer",
    clientOrOrganization: "Prestige Towers",
    githubUrl: "https://github.com/example/smart-parking",
  },
];

const INTERNSHIP_TEMPLATES = [
  {
    companyName: "Infosys",
    internshipType: "Technical",
    domain: "Software Development",
    role: "Software Intern",
    workMode: "On-site",
    description: "Worked on developing REST APIs and writing unit tests for an enterprise CRM module.",
    skillsUsed: "Java, Spring Boot, JUnit, Git",
    outcome: "Developed 4 REST endpoints, reduced test coverage gap by 18%.",
    stipendReceived: true,
    stipendAmount: 15000,
    projectTitle: "CRM Module Enhancement",
  },
  {
    companyName: "TCS",
    internshipType: "Technical",
    domain: "Data Engineering",
    role: "Data Intern",
    workMode: "Remote",
    description: "Assisted the data team with ETL pipeline development and report generation using SQL and Python.",
    skillsUsed: "Python, SQL, Apache Spark, Tableau",
    outcome: "Automated 3 weekly reports, saving 6 man-hours per week.",
    stipendReceived: true,
    stipendAmount: 12000,
    projectTitle: "ETL Automation Pipeline",
  },
  {
    companyName: "Wipro",
    internshipType: "Technical",
    domain: "Cloud Computing",
    role: "Cloud Intern",
    workMode: "Hybrid",
    description: "Configured AWS services including EC2, S3, and Lambda for a client migration project.",
    skillsUsed: "AWS, Terraform, Python, Bash",
    outcome: "Migrated 2 legacy services to serverless architecture.",
    stipendReceived: true,
    stipendAmount: 18000,
    projectTitle: "AWS Serverless Migration",
    ppoOffered: true,
    ppoPackage: 6.5,
  },
  {
    companyName: "Accenture",
    internshipType: "Technical",
    domain: "Full Stack Development",
    role: "Full Stack Intern",
    workMode: "Remote",
    description: "Contributed to a React + Node.js internal dashboard project for HR analytics.",
    skillsUsed: "React, Node.js, MongoDB, Docker",
    outcome: "Delivered 3 new dashboard widgets used by 200+ HR staff.",
    stipendReceived: true,
    stipendAmount: 20000,
    projectTitle: "HR Analytics Dashboard",
  },
  {
    companyName: "Amazon",
    internshipType: "Technical",
    domain: "Machine Learning",
    role: "ML Intern",
    workMode: "On-site",
    description: "Worked on improving the recommendation engine accuracy using collaborative filtering techniques.",
    skillsUsed: "Python, TensorFlow, SageMaker, SQL",
    outcome: "Improved recommendation click-through rate by 4.2% in A/B test.",
    stipendReceived: true,
    stipendAmount: 45000,
    projectTitle: "Recommendation Engine Tuning",
    ppoOffered: true,
    ppoPackage: 28.0,
  },
  {
    companyName: "Deloitte",
    internshipType: "Non-Technical",
    domain: "Business Analysis",
    role: "Business Analyst Intern",
    workMode: "Hybrid",
    description: "Performed market research and prepared business requirement documents for a digital transformation project.",
    skillsUsed: "MS Excel, PowerPoint, JIRA, Confluence",
    outcome: "Authored 2 BRD documents approved for project kickoff.",
    stipendReceived: true,
    stipendAmount: 14000,
    projectTitle: "Digital Transformation BRD",
  },
  {
    companyName: "ISRO",
    internshipType: "Research",
    domain: "Remote Sensing",
    role: "Research Intern",
    workMode: "On-site",
    description: "Assisted in satellite image processing research for agricultural land-use classification.",
    skillsUsed: "Python, QGIS, OpenCV, NumPy",
    outcome: "Contributed to a paper on automated crop classification with 91% accuracy.",
    stipendReceived: false,
    projectTitle: "Crop Classification from Satellite Imagery",
  },
  {
    companyName: "Razorpay",
    internshipType: "Technical",
    domain: "Backend Engineering",
    role: "Backend Intern",
    workMode: "Remote",
    description: "Built and tested payment reconciliation microservices in a high-throughput payments environment.",
    skillsUsed: "Go, Kafka, PostgreSQL, Docker, Kubernetes",
    outcome: "Reduced payment reconciliation time by 30% via async processing.",
    stipendReceived: true,
    stipendAmount: 35000,
    ppoOffered: true,
    ppoPackage: 18.0,
    projectTitle: "Payment Reconciliation Service",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Main seeder ───────────────────────────────────────────────────────────────

async function seedStudents() {
  const branches = ["CS", "AIML", "AIDS"];
  const totalSkills = 60;

  try {
    await getSequelize().sync();
    console.log("Database synced. Seeding students...\n");

    for (const branch of branches) {
      for (let i = 1; i <= 10; i++) {
        // ── Gender ────────────────────────────────────────────────────────
        const isMale = Math.random() < 0.5;
        const gender = isMale ? "M" : "F";
        const firstName = isMale ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE);
        const lastName   = pick(LAST_NAMES);
        const name       = `${firstName} ${lastName}`;

        // ── Skills ────────────────────────────────────────────────────────
        const randomSkills = new Set();
        while (randomSkills.size < 3) {
          randomSkills.add(Math.floor(Math.random() * totalSkills) + 1);
        }
        const skillsString = Array.from(randomSkills).join(", ");

        const studentId = `TEST_${branch}_${1000 + i}`;

        // Clean up existing record
        const existing = await Student.findOne({ where: { student_id: studentId } });
        if (existing) {
          // Also remove child records so re-seeding is clean
          await Internship.destroy({ where: { studentId: studentId } });
          await StudentProject.destroy({ where: { studentId: studentId } });
          await existing.destroy();
        }

        // ── Create Student ────────────────────────────────────────────────
        await Student.create({
          student_id:       studentId,
          name:             name,
          gender:           gender,
          email:            `test${i}@${branch.toLowerCase()}.edu`,
          branch:           branch,
          year:             4,
          cgpa:             parseFloat((Math.random() * (9.5 - 6.5) + 6.5).toFixed(2)),
          backlogs:         Math.random() < 0.15 ? randomInt(1, 2) : 0,
          skills:           skillsString,
          phone_number:     `98765${String(branch.charCodeAt(0)).slice(-2)}${String(i).padStart(3, "0")}`,
          placement_status: "Not Placed",
        });

        console.log(`✔  Created student: ${studentId}  (${name}, ${gender}, ${branch})`);

        // ── Live Projects (1–3 per student) ──────────────────────────────
        const numProjects = randomInt(1, 3);
        const projectTemplates = pickN(LIVE_PROJECT_TEMPLATES, numProjects);

        for (let p = 0; p < projectTemplates.length; p++) {
          const tpl = projectTemplates[p];
          const startYear = 2023 - p;
          const startMonth = randomInt(1, 6);
          const startDay   = randomInt(1, 28);
          const endYear  = startYear;
          const endMonth = startMonth + randomInt(2, 5);
          const endDay   = randomInt(1, 28);
          const isOngoing = p === 0 && Math.random() < 0.3;

          await StudentProject.create({
            studentId:            studentId,
            projectType:          "LIVE",
            title:                tpl.title,
            domain:               tpl.domain,
            description:          tpl.description,
            technologiesUsed:     tpl.technologiesUsed,
            role:                 tpl.role,
            clientOrOrganization: tpl.clientOrOrganization || null,
            projectUrl:           tpl.projectUrl || null,
            githubUrl:            tpl.githubUrl  || null,
            startDate:            dateStr(startYear, startMonth, startDay),
            endDate:              isOngoing ? null : dateStr(endYear, Math.min(endMonth, 12), endDay),
            duration:             isOngoing ? null : `${Math.min(endMonth, 12) - startMonth} months`,
            projectStatus:        isOngoing ? "Ongoing" : "Completed",
            teamSize:             randomInt(2, 5),
          });

          console.log(`     ↳ Live project ${p + 1}/${numProjects}: "${tpl.title}" [${isOngoing ? "Ongoing" : "Completed"}]`);
        }

        // ── Internships (1–2 per student, mix of Completed & Ongoing) ────
        const numInternships = randomInt(1, 2);
        const internTemplates = pickN(INTERNSHIP_TEMPLATES, numInternships);

        for (let k = 0; k < internTemplates.length; k++) {
          const tpl    = internTemplates[k];
          const isOngoing = k === 0 && Math.random() < 0.3;
          const startYear  = isOngoing ? 2024 : 2023;
          const startMonth = randomInt(1, 6);
          const startDay   = randomInt(1, 28);
          const endYear  = isOngoing ? 2025 : 2023;
          const endMonth = isOngoing ? startMonth + 6 : startMonth + randomInt(2, 4);
          const endDay   = randomInt(1, 28);
          const clampedEnd = Math.min(endMonth, 12);

          await Internship.create({
            studentId:        studentId,
            status:           isOngoing ? "Ongoing" : "Completed",
            companyName:      tpl.companyName,
            internshipType:   tpl.internshipType,
            domain:           tpl.domain,
            role:             tpl.role,
            startDate:        dateStr(startYear, startMonth, startDay),
            endDate:          dateStr(endYear, clampedEnd, endDay),
            duration:         `${clampedEnd - startMonth + (endYear > startYear ? 12 : 0)} months`,
            workMode:         tpl.workMode,
            description:      tpl.description,
            skillsUsed:       tpl.skillsUsed,
            outcome:          tpl.outcome || null,
            projectTitle:     tpl.projectTitle || null,
            stipendReceived:  tpl.stipendReceived || false,
            stipendAmount:    tpl.stipendReceived ? tpl.stipendAmount : null,
            ppoOffered:       tpl.ppoOffered || false,
            ppoPackage:       tpl.ppoOffered ? tpl.ppoPackage : null,
            verificationStatus: "Verified",
          });

          console.log(`     ↳ Internship ${k + 1}/${numInternships}: ${tpl.companyName} — ${tpl.role} [${isOngoing ? "Ongoing" : "Completed"}]`);
        }

        console.log();
      }
    }

    console.log("=".repeat(60));
    console.log(`Seeding complete! ${branches.length * 10} students created across ${branches.join(", ")}.`);
    console.log("Each student has:");
    console.log("  • Gender (M/F)");
    console.log("  • 1–3 Live Projects");
    console.log("  • 1–2 Internships (some Ongoing)");
    console.log("=".repeat(60));
    process.exit(0);
  } catch (error) {
    console.error("Error seeding students:", error);
    process.exit(1);
  }
}

seedStudents();
