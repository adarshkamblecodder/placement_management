/**
 * Authentication & Role-Based Access Control (RBAC) Middleware
 * Roles supported:
 *  - 'superadmin': Full system access across all departments, audit logs, and settings
 *  - 'tpo': Central placement officer with full placement, drive, and candidate access
 *  - 'coordinator': Department placement assistant, scoped to their own branch
 *  - 'student': Student portal access only
 */

function requireLogin(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.redirect("/login/");
  return next();
}

function requireAdmin(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.redirect("/login/");
  const isAllowed =
    Boolean(u.isStaff) ||
    Boolean(u.isSuperuser) ||
    u.role === "superadmin" ||
    u.role === "tpo" ||
    u.role === "coordinator";

  if (!isAllowed) return res.status(403).send("Forbidden: Administrative Access Required");
  return next();
}

function requireSuperAdmin(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.redirect("/login/");
  const isSuper =
    Boolean(u.isSuperuser) ||
    u.role === "superadmin";

  if (!isSuper) {
    return res.status(403).send("Forbidden: Super Administrator Access Required");
  }
  return next();
}

function requireCoordinator(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.redirect("/login/");
  const isCoord =
    u.role === "coordinator" ||
    u.role === "superadmin" ||
    u.role === "tpo" ||
    Boolean(u.isStaff);

  if (!isCoord) {
    return res.status(403).send("Forbidden: Coordinator Access Required");
  }
  return next();
}

/**
 * Returns branch scope for the current authenticated user.
 * If Coordinator with department 'CS', returns 'CS'.
 * If Super Admin or Central TPO, returns null (unrestricted).
 */
function getScopedDepartment(req) {
  const u = req.session?.user;
  if (u && u.role === "coordinator" && u.department) {
    return u.department;
  }
  return null;
}

module.exports = {
  requireLogin,
  requireAdmin,
  requireSuperAdmin,
  requireCoordinator,
  getScopedDepartment,
};
