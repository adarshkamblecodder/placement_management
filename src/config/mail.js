const { ensureEnvLoaded } = require("./env");

function stripEnvValue(value) {
  const s = String(value || "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

const PLACEHOLDER_PATTERNS = [
  /your[_-]?email/i,
  /your[_-]?smtp/i,
  /example\.com/i,
  /app[_-]?password/i,
  /replace[-_]?me/i,
  /changeme/i,
  /noreply@example/i,
];

function looksLikePlaceholder(value) {
  const s = String(value || "").trim();
  if (!s) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(s));
}

function getMailConfig() {
  ensureEnvLoaded();

  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
    port === 465;
  const host = stripEnvValue(process.env.SMTP_HOST);
  const user = stripEnvValue(process.env.SMTP_USER);
  const pass = stripEnvValue(process.env.SMTP_PASS);
  let from = stripEnvValue(process.env.MAIL_FROM || user);

  // Gmail requires the From address to match the authenticated account.
  if (host.includes("gmail.com") && user && !from.includes(user)) {
    from = user;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

function getMailDiagnostics() {
  const cfg = getMailConfig();
  const issues = [];

  if (!cfg.host) issues.push("SMTP_HOST is missing in .env");
  if (!cfg.user) issues.push("SMTP_USER is missing in .env");
  if (!cfg.pass) issues.push("SMTP_PASS is missing in .env");

  if (cfg.user && looksLikePlaceholder(cfg.user)) {
    issues.push("SMTP_USER still looks like a placeholder — set your real email in .env");
  }
  if (cfg.pass && looksLikePlaceholder(cfg.pass)) {
    issues.push("SMTP_PASS still looks like a placeholder — use a Gmail App Password, not your login password");
  }

  const configured = Boolean(cfg.host && cfg.user && cfg.pass && issues.length === 0);

  return {
    configured,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    from: cfg.from,
    issues,
  };
}

module.exports = { getMailConfig, getMailDiagnostics, looksLikePlaceholder };
