// Auth-related runtime config (session secret, cookie policy, etc.).
function getAuthConfig() {
  return {
    sessionSecret: process.env.SECRET_KEY || "dev-secret-key-change-me",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure:
        String(process.env.SESSION_COOKIE_SECURE || "").toLowerCase() ===
        "true",
    },
    rememberMeMs: 14 * 24 * 60 * 60 * 1000,
    passwordResetTtlMs: 15 * 60 * 1000,
  };
}

module.exports = { getAuthConfig };
