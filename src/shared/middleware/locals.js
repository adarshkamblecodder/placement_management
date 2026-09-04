function localsMiddleware(req, res, next) {
  const u = req.session?.user;
  if (u) {
    res.locals.user = {
      is_authenticated: true,
      is_staff: Boolean(u.isStaff),
    };
  } else {
    res.locals.user = {
      is_authenticated: false,
      is_staff: false,
    };
  }

  // Branding & Multi-College White-Label Variables used by templates/base.html
  res.locals.COLLEGE_NAME =
    process.env.COLLEGE_NAME || "Placement System Administrator";
  res.locals.COLLEGE_LOGO = process.env.COLLEGE_LOGO || "";
  res.locals.DOMAIN_NAME = process.env.DOMAIN_NAME || "localhost";
  res.locals.THEME_COLOR = process.env.THEME_COLOR || "#4f46e5";
  res.locals.THEME_COLOR_DARK = process.env.THEME_COLOR_DARK || "#0ea5e9";
  res.locals.FAVICON_PATH = process.env.FAVICON_PATH || "/static/favicon.ico";
  res.locals.SHOW_POWERED_BY =
    String(process.env.SHOW_POWERED_BY || "true").toLowerCase() !== "false";
  res.locals.POWERED_BY_NAME =
    process.env.POWERED_BY_NAME || "Placement Portal";
  res.locals.currentPath = req.path || "";

  // Pass import errors from Excel import (cleared after read)
  const importErrors = req.session?.importErrors || [];
  res.locals.import_errors = importErrors;
  res.locals.importErrors = importErrors;
  if (req.session?.importErrors) {
    delete req.session.importErrors;
  }

  next();
}

module.exports = { localsMiddleware };
