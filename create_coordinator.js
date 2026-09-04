const { AuthUser } = require("./src/db/models");
const { initSequelize } = require("./src/db/sequelize");
const { hashDjangoPassword } = require("./src/auth/djangoPbkdf2");

async function createCoordinator() {
  try {
    await initSequelize();

    const TARGET_USERNAME = "coordinator_cs";
    const NEW_PASSWORD = "coord123";

    let user = await AuthUser.findOne({
      where: { username: TARGET_USERNAME },
    });

    const hashed = await hashDjangoPassword(NEW_PASSWORD, {
      digest: "sha256",
      iterations: 120000,
      saltLength: 22,
    });

    if (!user) {
      console.log(`Creating user "${TARGET_USERNAME}"...`);
      user = await AuthUser.create({
        username: TARGET_USERNAME,
        password: hashed,
        is_staff: true,
        is_superuser: false,
        is_active: true,
        role: "coordinator",
        department: "CS",
        date_joined: new Date(),
      });
      console.log("Created successfully!");
    } else {
      console.log(`User "${TARGET_USERNAME}" already exists. Updating password and permissions...`);
      await user.update({
        password: hashed,
        is_staff: true,
        is_superuser: false,
        is_active: true,
        role: "coordinator",
        department: "CS",
      });
      console.log("Updated successfully!");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

createCoordinator();
