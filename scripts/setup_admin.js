/**
 * Setup Admin CLI Script
 * Usage:
 *   node scripts/setup_admin.js [username] [password] [email]
 * Or run interactively:
 *   node scripts/setup_admin.js
 */

const readline = require("readline");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { initSequelize } = require("../src/db/sequelize");
const { AuthUser } = require("../src/db/models");
const { hashDjangoPassword } = require("../src/modules/auth/services/djangoPbkdf2.service");

function prompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function run() {
  await initSequelize();

  let [,, username, password, email] = process.argv;

  if (!username) {
    username = await prompt("Enter Admin Username [admin]: ") || "admin";
  }
  if (!password) {
    password = await prompt("Enter Admin Password: ");
  }
  if (!email) {
    email = await prompt("Enter Admin Email [admin@college.edu]: ") || "admin@college.edu";
  }

  if (!password || password.length < 6) {
    console.error("Error: Password must be at least 6 characters long.");
    process.exit(1);
  }

  const hashedPassword = await hashDjangoPassword(password, {
    digest: "sha256",
    iterations: 1200000,
    saltLength: 22,
  });

  const existing = await AuthUser.findOne({ where: { username } });
  if (existing) {
    await existing.update({
      password: hashedPassword,
      email: email || existing.email,
      is_staff: true,
      is_superuser: true,
      is_active: true,
    });
    console.log(`Admin account '${username}' updated successfully!`);
  } else {
    await AuthUser.create({
      username,
      password: hashedPassword,
      email,
      is_staff: true,
      is_superuser: true,
      is_active: true,
      first_name: "Admin",
      last_name: "User",
      date_joined: new Date(),
    });
    console.log(`Admin account '${username}' created successfully!`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Setup admin failed:", err);
  process.exit(1);
});
