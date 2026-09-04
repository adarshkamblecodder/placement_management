const { initSequelize } = require("../src/db/sequelize");
const { AuthUser } = require("../src/db/models");
const { hashDjangoPassword } = require("../src/auth/djangoPbkdf2");

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!adminPassword) {
    // eslint-disable-next-line no-console
    console.error(
      "Missing ADMIN_PASSWORD env var. Example:\n" +
        "ADMIN_USERNAME=admin ADMIN_PASSWORD='YourStrongPassword' node scripts/create_admin_user.js"
    );
    process.exit(1);
  }

  await initSequelize();

  // Infer Django PBKDF2 parameters from the existing stored hash (if possible).
  const firstUser = await AuthUser.findOne({ attributes: ["password"], order: [["id", "ASC"]] });
  const parsed = require("../src/auth/djangoPbkdf2").parseDjangoPBKDF2(firstUser?.password);

  const cfg = parsed
    ? { iterations: parsed.iterations, digest: parsed.digest, saltLength: String(parsed.salt).length }
    : { iterations: 1200000, digest: "sha256", saltLength: 22 }; // safe fallback

  const hashedPassword = hashDjangoPassword(adminPassword, cfg);

  const existing = await AuthUser.findOne({ where: { username: adminUsername } });
  if (existing) {
    await existing.update({ password: hashedPassword, is_staff: true, is_superuser: false, is_active: true });
  } else {
    await AuthUser.create({
      username: adminUsername,
      password: hashedPassword,
      is_staff: true,
      is_superuser: false,
      is_active: true,
      first_name: "",
      last_name: "",
      email: "",
      date_joined: new Date(),
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Admin user ready: username='${adminUsername}' (password set via ADMIN_PASSWORD).`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

