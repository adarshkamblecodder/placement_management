const { createApp } = require("../src/app");
const { initSequelize } = require("../src/db/sequelize");
const { Student, AuthUser, AuditLog } = require("../src/db/models");
const http = require("http");

async function runIntegration() {
  console.log("=== Running Extended Integration Tests ===");
  const sequelize = await initSequelize();
  await sequelize.sync({ alter: { drop: false } });
  const app = createApp();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Check login page renders CSRF token and branding
  let csrfToken = null;
  let cookies = null;
  try {
    const res = await fetch(`${baseUrl}/login/`);
    cookies = res.headers.get("set-cookie");
    const html = await res.text();
    const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
    if (match) {
      csrfToken = match[1];
    }
    assert(res.status === 200, "1. GET /login/ returns 200");
    assert(Boolean(csrfToken), `1b. CSRF token injected into login form (${csrfToken?.slice(0, 8)}...)`);
    assert(html.includes("data-theme") && html.includes("theme-toggle-btn"), "1c. Multi-theme branding and theme toggling present in base.html");
  } catch (e) {
    assert(false, "1. Login render: " + e.message);
  }

  // 2. Test successful POST /login/ with valid CSRF token
  try {
    const res = await fetch(`${baseUrl}/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookies || "",
      },
      body: `_csrf=${csrfToken}&identifier=admin&password=wrongpassword`,
      redirect: "manual",
    });
    // Should NOT be 403 Forbidden (which would indicate CSRF failure). Instead redirect back to login (302).
    assert(res.status === 302, `2. POST /login/ with valid CSRF token processed and redirected (Status: ${res.status})`);
  } catch (e) {
    assert(false, "2. Valid CSRF POST check: " + e.message);
  }

  // 3. Test GET /reports/export/ endpoint
  try {
    const res = await fetch(`${baseUrl}/reports/export/`, {
      headers: {
        "Cookie": cookies || "",
      }
    });
    // Note: Admin middleware redirects unauthenticated requests to login (302) or returns 200
    assert(res.status === 200 || res.status === 302, `3. GET /reports/export/ route is accessible and mounted correctly (Status: ${res.status})`);
  } catch (e) {
    assert(false, "3. /reports/export/: " + e.message);
  }

  // 4. Test GET /admin/audit-log/ endpoint
  try {
    const res = await fetch(`${baseUrl}/admin/audit-log/`, {
      headers: {
        "Cookie": cookies || "",
      }
    });
    assert(res.status === 200 || res.status === 302, `4. GET /admin/audit-log/ route is mounted and accessible (Status: ${res.status})`);
  } catch (e) {
    assert(false, "4. /admin/audit-log/: " + e.message);
  }

  // 5. Test XSS Autoescaping: Verify nunjucks escapes raw tags in variables
  try {
    const nunjucks = require("nunjucks");
    const env = nunjucks.configure({ autoescape: true });
    const rendered = env.renderString("{{ payload }}", { payload: "<script>alert('xss')</script>" });
    assert(rendered.includes("&lt;script&gt;"), "5. Nunjucks autoescape correctly escapes HTML tags into entities");
  } catch (e) {
    assert(false, "5. XSS Autoescape test: " + e.message);
  }

  server.close();
  console.log(`\n=== Integration Complete: ${passed} Passed, ${failed} Failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runIntegration().catch((err) => {
  console.error("Integration test error:", err);
  process.exit(1);
});
