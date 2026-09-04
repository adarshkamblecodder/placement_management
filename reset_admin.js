const { AuthUser } = require("./src/db/models");
const { initSequelize } = require("./src/db/sequelize");
const { hashDjangoPassword } = require("./src/auth/djangoPbkdf2");

async function resetAdmin() {
  try {
    await initSequelize();

    // List all staff/superuser accounts
    const admins = await AuthUser.findAll({
      where: { is_staff: true },
      attributes: ["id", "username", "is_staff", "is_superuser"],
    });

    console.log("Admin accounts found:");

    admins.forEach((a) => {
      console.log(
        `  id=${a.id}  username=${a.username}  is_superuser=${a.is_superuser}`
      );
    });

    // ==============================
    // CHANGE THESE VALUES
    // ==============================
    const TARGET_USERNAME = "admin";
    const NEW_PASSWORD = "admin123";

    const user = await AuthUser.findOne({
      where: { username: TARGET_USERNAME },
    });

    if (!user) {
      console.error(
        `\nNo user with username "${TARGET_USERNAME}" found.`
      );
      process.exit(1);
    }

    // IMPORTANT: await the hashing function
    const hashed = await hashDjangoPassword(NEW_PASSWORD, {
      digest: "sha256",
      iterations: 120000,
      saltLength: 22,
    });

    console.log("\nHash generated.");
    console.log("Hash type:", typeof hashed);

    // Make sure the hash is actually a string
    if (typeof hashed !== "string") {
      throw new Error(
        `hashDjangoPassword returned ${typeof hashed} instead of a string`
      );
    }

    await user.update({
      password: hashed,
      is_staff: true,
      is_superuser: true,
      is_active: true,
    });

    console.log(
      `\nPassword RESET successfully for "${TARGET_USERNAME}".`
    );
    console.log(`New password: ${NEW_PASSWORD}`);

    process.exit(0);

  } catch (err) {
    console.error("\nError:", err);
    process.exit(1);
  }
}

resetAdmin();