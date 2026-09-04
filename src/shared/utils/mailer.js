const nodemailer = require("nodemailer");
const { getMailConfig, getMailDiagnostics } = require("../../config/mail");

function hasSmtpConfig() {
  return getMailDiagnostics().configured;
}

function getTransport() {
  const cfg = getMailConfig();
  const transportOptions = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  };

  if (!cfg.secure && cfg.port === 587) {
    transportOptions.requireTLS = true;
  }

  if (cfg.host.includes("gmail.com")) {
    transportOptions.tls = { minVersion: "TLSv1.2" };
  }

  return nodemailer.createTransport(transportOptions);
}

function formatMailError(err) {
  const code = err?.code || "";
  const response = String(err?.response || err?.message || "Unknown mail error");

  if (code === "EAUTH" || /535|BadCredentials|authentication failed/i.test(response)) {
    return (
      "SMTP login failed. For Gmail: enable 2-Step Verification, create an App Password, " +
      "and put that 16-character password in SMTP_PASS (not your normal Gmail password). " +
      "SMTP_USER must be the same Gmail address."
    );
  }
  if (code === "ESOCKET" || code === "ECONNECTION") {
    return "Could not connect to the SMTP server. Check SMTP_HOST, SMTP_PORT, and your internet/firewall.";
  }
  return response;
}

async function verifySmtpConnection() {
  if (!hasSmtpConfig()) {
    const diag = getMailDiagnostics();
    return {
      ok: false,
      error: diag.issues.join(" ") || "SMTP is not configured.",
      diagnostics: diag,
    };
  }

  try {
    const transport = getTransport();
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: formatMailError(err) };
  }
}

async function sendMail({ to, subject, text, html }) {
  const diagnostics = getMailDiagnostics();

  if (!diagnostics.configured) {
    // eslint-disable-next-line no-console
    console.log("[MAILER:FALLBACK] To:", to);
    // eslint-disable-next-line no-console
    console.log("[MAILER:FALLBACK] Subject:", subject);
    // eslint-disable-next-line no-console
    console.log("[MAILER:FALLBACK] Text:\n" + text);
    return {
      ok: false,
      skipped: true,
      reason: diagnostics.issues.join(" ") || "SMTP is not configured. Update .env and restart the server.",
      diagnostics,
    };
  }

  try {
    const cfg = getMailConfig();
    const transport = getTransport();
    await transport.sendMail({
      from: cfg.from,
      to,
      subject,
      text,
      html: html || undefined,
    });
    return { ok: true };
  } catch (err) {
    const friendly = formatMailError(err);
    // eslint-disable-next-line no-console
    console.error("[MAILER:ERROR]", friendly);
    return { ok: false, error: friendly };
  }
}

module.exports = { sendMail, verifySmtpConnection, hasSmtpConfig, getMailDiagnostics };
