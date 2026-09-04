const { Op } = require("sequelize");
const {
  AuthUser,
  Student,
  StudentLoginMeta,
} = require("../../../db/models");
const {
  verifyStudentLogin,
  createStudentCredentials,
  getPasswordHasherConfig,
} = require("../services/credentials.service");
const {
  hashDjangoPassword,
  verifyDjangoPassword,
} = require("../services/djangoPbkdf2.service");
const { validatePasswordPolicy } = require("../validations/passwordPolicy");
const { addMessage } = require("../../../shared/middleware/flash");
const { sendMail } = require("../../../shared/utils/mailer");
const { randomToken, sha256Hex } = require("../../../shared/utils/security");
const { getAuthConfig } = require("../../../config/auth");

// ─── Pages ─────────────────────────────────────────────────────────────
function getLoginPage(req, res) {
  res.render("tracker/student_login.html");
}

async function postLogin(req, res) {
  try {
    const { identifier, username, password, remember_me } = req.body || {};
    const ident = identifier || username;
    const result = await verifyStudentLogin(ident, password);
    if (!result) {
      addMessage(req, { type: "danger", text: "Invalid Student ID or Password" });
      return res.redirect("/login/");
    }

    req.session.user = {
      id: result.user.id,
      username: result.user.username,
      isStaff: result.isStaff,
      isSuperuser: Boolean(result.user.is_superuser),
      role: result.user.role || (result.user.is_superuser ? "superadmin" : (result.user.is_staff ? "tpo" : "student")),
      department: result.user.department || null,
    };
    if (remember_me) {
      req.session.cookie.maxAge = getAuthConfig().rememberMeMs;
    }
    if (result.isStaff || result.user.is_superuser || result.user.role === "coordinator") {
      return res.redirect("/admin-dashboard/");
    }
    return res.redirect("/student/profile/?welcome=1");
  } catch (e) {
    addMessage(req, { type: "danger", text: "Login failed. Please try again." });
    return res.redirect("/login/");
  }
}

function getLogout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login/");
  });
}

function getRegisterPage(req, res) {
  res.render("tracker/student_register.html");
}

async function postRegister(req, res) {
  try {
    const { student_id, password } = req.body || {};
    await createStudentCredentials({ studentId: student_id, password, isStaff: false });
    addMessage(req, { type: "success", text: "Registration successful! Please login." });
    return res.redirect("/login/");
  } catch (e) {
    addMessage(req, { type: "danger", text: e?.message || "Registration failed." });
    return res.redirect("/student/register/");
  }
}

// ─── Change password (forced on first login) ───────────────────────────
async function getChangePasswordPage(req, res) {
  const u = req.session?.user;
  if (!u || u.isStaff) return res.redirect("/");
  const student = await Student.findOne({ where: { user_id: u.id } });
  return res.render("tracker/student_change_password.html", {
    student: student ? student.toJSON() : null,
  });
}

async function postChangePassword(req, res) {
  try {
    const u = req.session?.user;
    if (!u || u.isStaff) return res.redirect("/");

    const { current_password, new_password, confirm_password } = req.body || {};
    if (!current_password || !new_password || !confirm_password) {
      addMessage(req, { type: "danger", text: "All fields are required." });
      return res.redirect("/student/change-password/");
    }
    if (new_password !== confirm_password) {
      addMessage(req, { type: "danger", text: "New password and confirm password do not match." });
      return res.redirect("/student/change-password/");
    }

    const user = await AuthUser.findByPk(u.id);
    if (!user) return res.redirect("/login/");

    const ok = await verifyDjangoPassword(current_password, user.password);
    if (!ok) {
      addMessage(req, { type: "danger", text: "Current password is incorrect." });
      return res.redirect("/student/change-password/");
    }

    const errors = validatePasswordPolicy(new_password);
    if (errors.length > 0) {
      errors.forEach((e) => addMessage(req, { type: "danger", text: e }));
      return res.redirect("/student/change-password/");
    }

    const cfg = await getPasswordHasherConfig();
    const hashed = await hashDjangoPassword(new_password, {
      iterations: cfg.iterations,
      digest: cfg.digest,
      saltLength: cfg.saltLength,
    });
    await user.update({ password: hashed });

    await StudentLoginMeta.update(
      { isFirstLogin: false },
      { where: { authUserId: user.id } }
    );

    addMessage(req, { type: "success", text: "Password updated successfully." });
    return res.redirect("/student/profile/?welcome=1");
  } catch (e) {
    addMessage(req, { type: "danger", text: "Password change failed. Please try again." });
    return res.redirect("/student/change-password/");
  }
}

// ─── Forgot / reset password ───────────────────────────────────────────
function getForgotPasswordPage(req, res) {
  return res.render("tracker/student_forgot_password.html");
}

async function postForgotPassword(req, res) {
  try {
    const { identifier } = req.body || {};
    const ident = String(identifier || "").trim();
    if (!ident) {
      addMessage(req, { type: "danger", text: "Please enter Student ID or Email." });
      return res.redirect("/student/forgot-password/");
    }

    const user = await AuthUser.findOne({
      where: { [Op.or]: [{ username: ident }, { email: ident }] },
    });
    if (!user) {
      addMessage(req, { type: "success", text: "If an account exists, a reset link has been sent." });
      return res.redirect("/student/forgot-password/");
    }

    const student = await Student.findOne({ where: { user_id: user.id } });
    const studentId = student?.student_id || user.username;

    const meta = await StudentLoginMeta.findOne({ where: { authUserId: user.id } });
    if (!meta) {
      await StudentLoginMeta.create({ authUserId: user.id, studentId, isFirstLogin: false });
    }
    const meta2 = await StudentLoginMeta.findOne({ where: { authUserId: user.id } });

    const token = randomToken(24);
    const tokenHash = sha256Hex(token);
    const expires = new Date(Date.now() + getAuthConfig().passwordResetTtlMs);
    await meta2.update({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: expires,
    });

    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const resetUrl = `${proto}://${host}/student/reset-password/?studentId=${encodeURIComponent(
      studentId
    )}&token=${encodeURIComponent(token)}`;

    const subject = "Placement Portal Password Reset";
    const text = `Hello,\n\nUse the link below to reset your password (valid for 15 minutes):\n${resetUrl}\n\nRegards,\nTraining & Placement Cell\n`;
    await sendMail({ to: user.email || student?.email, subject, text });

    addMessage(req, { type: "success", text: "If an account exists, a reset link has been sent." });
    return res.redirect("/student/forgot-password/");
  } catch (e) {
    addMessage(req, { type: "danger", text: "Failed to send reset link. Try again." });
    return res.redirect("/student/forgot-password/");
  }
}

function getResetPasswordPage(req, res) {
  return res.render("tracker/student_reset_password.html", {
    studentId: req.query.studentId || "",
    token: req.query.token || "",
  });
}

async function postResetPassword(req, res) {
  try {
    const { studentId, token, new_password, confirm_password } = req.body || {};
    if (!studentId || !token) {
      addMessage(req, { type: "danger", text: "Invalid reset link." });
      return res.redirect("/student/forgot-password/");
    }
    const redirectBack = `/student/reset-password/?studentId=${encodeURIComponent(
      studentId
    )}&token=${encodeURIComponent(token)}`;
    if (!new_password || !confirm_password) {
      addMessage(req, { type: "danger", text: "All fields are required." });
      return res.redirect(redirectBack);
    }
    if (new_password !== confirm_password) {
      addMessage(req, { type: "danger", text: "Passwords do not match." });
      return res.redirect(redirectBack);
    }
    const errors = validatePasswordPolicy(new_password);
    if (errors.length > 0) {
      errors.forEach((e) => addMessage(req, { type: "danger", text: e }));
      return res.redirect(redirectBack);
    }

    const meta = await StudentLoginMeta.findOne({
      where: { studentId: String(studentId) },
    });
    if (!meta?.passwordResetTokenHash || !meta.passwordResetTokenExpiresAt) {
      addMessage(req, { type: "danger", text: "Reset link expired or invalid." });
      return res.redirect("/student/forgot-password/");
    }
    if (new Date(meta.passwordResetTokenExpiresAt).getTime() < Date.now()) {
      addMessage(req, { type: "danger", text: "Reset link expired." });
      return res.redirect("/student/forgot-password/");
    }

    const hash = sha256Hex(token);
    if (hash !== meta.passwordResetTokenHash) {
      addMessage(req, { type: "danger", text: "Reset link invalid." });
      return res.redirect("/student/forgot-password/");
    }

    const user = await AuthUser.findByPk(meta.authUserId);
    if (!user) {
      addMessage(req, { type: "danger", text: "Account not found." });
      return res.redirect("/student/forgot-password/");
    }

    const cfg = await getPasswordHasherConfig();
    const hashed = await hashDjangoPassword(new_password, {
      iterations: cfg.iterations,
      digest: cfg.digest,
      saltLength: cfg.saltLength,
    });
    await user.update({ password: hashed });
    await meta.update({
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      isFirstLogin: false,
    });

    addMessage(req, { type: "success", text: "Password reset successful. Please login." });
    return res.redirect("/login/");
  } catch (e) {
    addMessage(req, { type: "danger", text: "Password reset failed. Try again." });
    return res.redirect("/student/forgot-password/");
  }
}

module.exports = {
  getLoginPage,
  postLogin,
  getLogout,
  getRegisterPage,
  postRegister,
  getChangePasswordPage,
  postChangePassword,
  getForgotPasswordPage,
  postForgotPassword,
  getResetPasswordPage,
  postResetPassword,
};
