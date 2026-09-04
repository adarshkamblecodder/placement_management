const fs = require("fs");
const path = require("path");

const PREDEFINED_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "C", "PHP", "Ruby", "Swift", "Kotlin", "Go", "Rust",
  "HTML", "CSS", "React", "Angular", "Vue", "Next.js", "Node.js", "Express", "Django", "Flask", "Spring Boot", "Bootstrap", "Tailwind CSS",
  "SQL", "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Oracle", "Redis", "Elasticsearch",
  "Git", "GitHub", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "CI/CD",
  "Machine Learning", "Deep Learning", "Data Analysis", "Pandas", "NumPy", "TensorFlow", "PyTorch", "Power BI", "Tableau", "Excel",
  "REST API", "GraphQL", "Microservices", "Data Structures", "Algorithms"
];

/**
 * Extract text from PDF buffer and identify matching skills from predefined list
 * @param {string} filePath - Absolute path to PDF file
 * @returns {Promise<string[]>} Array of detected skill names
 */
async function extractSkillsFromResume(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".pdf") {
      // Basic text file inspection if not PDF
      return [];
    }

    const dataBuffer = fs.readFileSync(filePath);
    let extractedText = "";

    try {
      const pdf = require("pdf-parse");
      const data = await pdf(dataBuffer);
      extractedText = data.text || "";
    } catch (parseErr) {
      console.warn("pdf-parse fallback, reading buffer directly:", parseErr.message);
      extractedText = dataBuffer.toString("utf8");
    }

    if (!extractedText || !extractedText.trim()) {
      return [];
    }

    const normalizedText = extractedText.toLowerCase();
    const matchedSkills = new Set();

    for (const skill of PREDEFINED_SKILLS) {
      // Check for skill with word boundary regex or substring
      const escapedSkill = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escapedSkill}(?:$|[^a-zA-Z0-9_#+])`, "i");

      if (regex.test(normalizedText)) {
        matchedSkills.add(skill);
      }
    }

    return Array.from(matchedSkills);
  } catch (err) {
    console.error("Resume skill extraction failed:", err.message);
    return [];
  }
}

module.exports = {
  PREDEFINED_SKILLS,
  extractSkillsFromResume,
};
