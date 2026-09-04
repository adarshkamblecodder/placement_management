const express = require("express");
const c = require("../controllers/auth.controller");
const { requireLogin } = require("../../../shared/middleware/auth");
const { authLimiter } = require("../../../shared/middleware/rateLimit");

const router = express.Router();

// Login / Logout / Register
router.get("/login/", c.getLoginPage);
router.post("/login/", authLimiter, c.postLogin);
router.get("/logout/", c.getLogout);
router.get("/student/register/", c.getRegisterPage);
router.post("/student/register/", authLimiter, c.postRegister);

// Change password (authenticated; force on first login)
router.get("/student/change-password/", requireLogin, c.getChangePasswordPage);
router.post("/student/change-password/", requireLogin, c.postChangePassword);

// Forgot / reset password
router.get("/student/forgot-password/", c.getForgotPasswordPage);
router.post("/student/forgot-password/", c.postForgotPassword);
router.get("/student/reset-password/", c.getResetPasswordPage);
router.post("/student/reset-password/", c.postResetPassword);

module.exports = router;
