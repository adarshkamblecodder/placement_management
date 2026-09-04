const { Op } = require("sequelize");
const { AuthUser, Student, StudentLoginMeta } = require("../../../db/models");
const {
  hashDjangoPassword,
  parseDjangoPBKDF2,
  verifyDjangoPassword,
} = require("./djangoPbkdf2.service");

let cachedPasswordConfig = null;

async function getPasswordHasherConfig() {
  if (cachedPasswordConfig) return cachedPasswordConfig;

  const firstUser = await AuthUser.findOne({
    attributes: ["password"],
    order: [["id", "ASC"]],
  });

  // Defaults for Django 4.2/6.x PBKDF2 SHA256.
  const fallback = { digest: "sha256", iterations: 120000, saltLength: 22 };

  if (!firstUser?.password) {
    cachedPasswordConfig = fallback;
    return cachedPasswordConfig;
  }

  const parsed = parseDjangoPBKDF2(firstUser.password);
  if (!parsed) {
    cachedPasswordConfig = fallback;
    return cachedPasswordConfig;
  }

  cachedPasswordConfig = {
    digest: parsed.digest,
    iterations: parsed.iterations,
    saltLength: String(parsed.salt).length,
  };
  return cachedPasswordConfig;
}

async function verifyStudentLogin(identifier, password) {
  const ident = String(identifier || "").trim();
  if (!ident) return null;

  const user = await AuthUser.findOne({
    where: {
      [Op.or]: [{ username: ident }, { email: ident }],
    },
  });
  if (!user?.password) return null;
  if (user.is_active === false) return null;

  const ok = await verifyDjangoPassword(password, user.password);
  if (!ok) return null;

  const meta = await StudentLoginMeta.findOne({ where: { authUserId: user.id } });
  return {
    user,
    isStaff: Boolean(user.is_staff),
    isFirstLogin: Boolean(meta?.isFirstLogin),
  };
}

async function createStudentCredentials({ studentId, password, isStaff = false, email = "" }) {
  if (!studentId) throw new Error("studentId is required");
  if (!password) throw new Error("password is required");

  const existing = await AuthUser.findOne({ where: { username: studentId } });
  if (existing) {
    throw new Error("Student ID already registered.");
  }

  const cfg = await getPasswordHasherConfig();
  const hashedPassword = await hashDjangoPassword(password, {
    iterations: cfg.iterations,
    digest: cfg.digest,
    saltLength: cfg.saltLength,
  });

  const authUser = await AuthUser.create({
    username: studentId,
    password: hashedPassword,
    is_staff: Boolean(isStaff),
    is_superuser: false,
    is_active: true,
    first_name: "",
    last_name: "",
    email: email || "",
    date_joined: new Date(),
  });

  const existingStudent = await Student.findByPk(studentId);
  let student = existingStudent;
  if (student) {
    await student.update({ user_id: authUser.id });
  } else {
    student = await Student.create({
      user_id: authUser.id,
      student_id: studentId,
      placement_status: "Not Placed",
    });
  }

  await StudentLoginMeta.findOrCreate({
    where: { studentId },
    defaults: { authUserId: authUser.id, isFirstLogin: true },
  });

  return { authUser, student };
}

module.exports = {
  getPasswordHasherConfig,
  verifyStudentLogin,
  createStudentCredentials,
};
