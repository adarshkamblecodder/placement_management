const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const nunjucks = require("nunjucks");
const { initSequelize } = require("./db/sequelize");
const { flashMiddleware } = require("./middleware/flash");
const { localsMiddleware } = require("./middleware/locals");
const { csrfMiddleware } = require("./shared/middleware/csrf");
const routes = require("./routes");

const { ensureEnvLoaded } = require("./config/env");

function createApp() {
  ensureEnvLoaded();

  const app = express();

  // Railway (and most cloud platforms) sit behind a reverse proxy.
  // This tells Express to trust the X-Forwarded-* headers so that
  // secure cookies and req.protocol work correctly over HTTPS.
  app.set("trust proxy", 1);

  // Body parsing (Django used form posts + file uploads; multer will be wired later).
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use(cookieParser());

  // Session-based auth replacement for Django sessions.
  app.use(
    session({
      secret: process.env.SECRET_KEY || "dev-secret-key-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  // CSRF protection on mutating requests & token injection into locals
  app.use(csrfMiddleware);

  // Lightweight "messages" support to keep templates compatible later.
  app.use(flashMiddleware);
  app.use(localsMiddleware);

  // Nunjucks configuration with autoescape enabled for XSS prevention.
  // Pre-rendered HTML controls must use `| safe` filter explicitly.
  // BUG-16 FIX: disable template caching only in development; in production
  // noCache:false lets Nunjucks compile each template once and reuse it.
  const env = nunjucks.configure(path.join(__dirname, "..", "templates"), {
    autoescape: true,
    express: app,
    noCache: process.env.NODE_ENV !== "production",
  });

  // Common Django-ish filters used by current templates.
  env.addFilter("title", (s) => {
    return String(s || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  });
  env.addFilter("floatformat", (value, decimals = 2) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? "");
    return n.toFixed(Number(decimals));
  });

  // Custom filters for template convenience
  env.addFilter("split", (str, sep = ",") => {
    if (!str) return [];
    return String(str).split(sep);
  });

  env.addFilter("trim", (str) => {
    return String(str || "").trim();
  });

  env.addFilter("formatDateDMY", (val) => {
    if (!val) return "";
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const [y, m, d] = trimmed.slice(0, 10).split("-");
        return `${d}/${m}/${y}`;
      }
      if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val || "");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });

  env.addGlobal("url", function(routeName, arg) {
    const param = arg ? arg : "";
    const urls = {
      // Auth
      'student_login':              '/login/',
      'logout':                     '/logout/',
      'student_register':           '/student/register/',
      // Student
      'student_profile':            '/student/profile/',
      'student_my_profile':         '/student/my-profile/',
      'student_interview_rounds':   '/student/interview-rounds/',
      'student_internships':        '/student/internships/',
      'student_projects':           '/student/projects/',
      'student_change_password':    '/student/change-password/',
      'student_forgot_password':    '/student/forgot-password/',
      // Admin — top-level pages
      'dashboard':                  '/admin-dashboard/',
      'student_list':               '/students/',
      'student_add':                '/students/add/',
      'placed':                     '/placed/',
      'company_list':               '/companies/',
      'company_add':                '/companies/add/',
      'shortlists':                 '/shortlists',
      'reports':                    '/reports/',
      'audit_log':                  '/admin/audit-log/',
      'notifications':              '/admin/notifications/',
      'calendar':                   '/admin/calendar/',
      'settings':                   '/settings/',
      'admin_change_password':      '/admin/change-password/',
      // Admin — param routes
      'student_placement_update':   `/students/${param}/placement/`,
      'student_delete':             `/students/${param}/delete/`,
      'student_profile_view':       `/students/${param}/profile/`,
      'student_interview_rounds_admin': `/students/${param}/interview-rounds/`,
      'company_edit':               `/companies/${param}/edit/`,
      'company_delete':             `/companies/${param}/delete/`,
      'company_detail':             `/companies/${param}/`,
    };
    return urls[routeName] || '#';
  });

  // Static + media serving (same folders Django used).
  app.use("/static", express.static(path.join(__dirname, "..", "staticfiles")));
  app.use("/media", express.static(path.join(__dirname, "..", "media")));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "placement-node" });
  });

  // Start DB initialization in the background so it doesn't block /health.
  initSequelize()
    .then((sequelize) => {
      // Sync only adds missing columns — never drops or recreates tables.
      // alter:{ drop:false } prevents Sequelize from removing any existing column.
      // PRAGMA queries have been removed: they were SQLite-only and are not valid
      // in PostgreSQL, which enforces FK constraints natively without any toggle.
      return sequelize.sync({ alter: { drop: false } });
    })
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Sequelize connected and synced successfully");
      
      // Auto-seed admin user if no admin exists yet — runs in all environments
      // so the first deployment on a fresh database always has a working login.
      const { AuthUser } = require("./db/models");
      const { hashDjangoPassword } = require("./modules/auth/services/djangoPbkdf2.service");
      return AuthUser.findOne({ where: { username: "admin" } }).then(async admin => {
        if (!admin) {
          const hashed = await hashDjangoPassword("admin123", { digest: "sha256", iterations: 1200000, saltLength: 22 });
          return AuthUser.create({
            username: "admin",
            password: hashed,
            is_staff: true,
            is_superuser: true,
            is_active: true,
            first_name: "Admin",
            last_name: "User",
            email: "admin@college.edu",
            date_joined: new Date()
          }).then(() => console.log("Admin account created. Username: admin | Password: admin123"));
        }
      });
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Sequelize connection/sync failed:", err?.message || err);
    });

  const { globalErrorHandler } = require("./shared/middleware/errorHandler");
  app.use("/", routes);
  app.use(globalErrorHandler);

  return app;
}

module.exports = { createApp };

