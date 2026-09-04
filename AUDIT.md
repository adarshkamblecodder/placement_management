# Placement Management System — Full Audit Report

**Date:** 2026-09-04  
**Audited by:** Kiro (full-codebase manual inspection)  
**Scope:** All backend routes, models, middleware, templates, dependencies, and UI/UX flows  
**Perspective:** TPO user + professional developer

---

## Quick Summary

| ID     | Severity | Area                       | Status   | Description |
|--------|----------|----------------------------|----------|-------------|
| BUG-01 | HIGH     | companies.routes.js        | FIXED    | Orphan InterviewRound/ShortlistStudent when deleting single drive |
| BUG-02 | HIGH     | companies.routes.js        | FIXED    | Orphan rows when deleting all companies |
| BUG-03 | MEDIUM   | companies.routes.js        | FIXED    | technicalSkills missing from new-drive create inside company edit |
| BUG-04 | MEDIUM   | reports.routes.js          | FIXED    | Duplicate JS object key `branch` silently drops null filter |
| BUG-05 | MEDIUM   | placed.routes.js           | FIXED    | Export year-filter targets Student.year (1-4) not placement_year |
| BUG-06 | MEDIUM   | placements.routes.js       | FIXED    | No CSRF check, no existence validation (module is now empty stub) |
| BUG-07 | MEDIUM   | students.routes.js         | FIXED    | Student delete transaction missing StudentProfile.destroy |
| BUG-08 | MEDIUM   | jobs.routes.js             | FIXED    | Application created with status "Shortlisted" not in VALID_STATUSES |
| BUG-09 | MEDIUM   | jobs.routes.js             | FIXED    | job.tracker_company?.name returns Sequelize model name, not company name |
| BUG-10 | LOW      | shortlists.routes.js       | FIXED    | Remove-student silently succeeds on non-existent IDs |
| BUG-11 | LOW      | app.js                     | FIXED    | Nunjucks noCache:true in all environments (CPU waste in production) |
| S-01   | HIGH     | settings.routes.js         | **OPEN** | delete-all-companies missing Shortlist.destroy — FK violation risk |
| S-02   | HIGH     | base.html                  | **OPEN** | Footer exposes financial/SEBI/SIP links on placement portal pages |
| S-03   | HIGH     | base.html                  | **OPEN** | Financial AI wealth advisor widget injected into every authenticated page |
| S-04   | HIGH     | shortlists/index.html      | **OPEN** | addStudentModal and confirmOfferModal inside {% else %} — invisible when shortlists exist |
| S-05   | MEDIUM   | jobs.routes.js             | **OPEN** | placement_year written as student.year (academic "1"-"4") not calendar year |
| S-06   | MEDIUM   | app.js                     | **OPEN** | url() global helper map incomplete — missing shortlists, jobs, audit_log, settings, notifications |
| S-07   | MEDIUM   | companies.routes.js        | **OPEN** | countTracker_jobs() Sequelize auto-method name is fragile/undocumented |
| S-08   | MEDIUM   | reports.routes.js          | **OPEN** | chartBranchesObjects uses duplicate-key where {Op.not, Op.ne} — same BUG-04 pattern on second query |
| S-09   | MEDIUM   | students.routes.js         | **OPEN** | skills filter uses Op.iLike — fails on case-sensitive or SQLite; SKILLS_LOOKUP duplicated in route + template |
| S-10   | MEDIUM   | src/routes/index.js        | **OPEN** | No 404 handler — Express default error page shown instead of styled app error |
| S-11   | LOW      | package.json               | **OPEN** | Three unused dependencies installed: sqlite3, ejs, pdf-parse |
| NOTE-01 | INFO    | notifications.routes.js    | NO CHANGE | admin_id stores studentId for student audit events — intentional convention |
| NOTE-02 | INFO    | student.js model           | NO CHANGE | Stale SMTP columns on Student model — unused, harmless schema remnant |
| NOTE-03 | INFO    | financial module           | INFO      | Entire financial advisory product embedded in placement system — separate concern |
| NOTE-04 | INFO    | auth.js config             | INFO      | rememberMeMs defined but not wired to session cookie maxAge |
| NOTE-05 | INFO    | shortlist_student model    | INFO      | updatedAt:false — status change timestamps only in audit log, not on record itself |
| NOTE-06 | INFO    | allowMultipleOffers field  | INFO      | PlacementDrive.allowMultipleOffers never read in any route |

---

## Detailed Bug Descriptions — Open Issues

---

### S-01 — delete-all-companies in settings missing Shortlist.destroy

**File:** `src/modules/admin/settings/routes/settings.routes.js`  
**Route:** `POST /settings/delete-all-companies/`  
**Severity:** HIGH — FK violation or orphan rows in production

**Root cause:**  
The handler deletes `ShortlistStudent`, `StudentRoundResult`, `InterviewRound`, `PlacementDrive`, `Application`, then `Company` — but never destroys `Shortlist` rows. Since `shortlists.driveId` is a FK referencing `placement_drives.id`, deleting `PlacementDrive` first (before `Shortlist`) causes a FK constraint violation on any Postgres DB with FK enforcement. Even if the DB allows it (cascade not set), the orphan `shortlist` rows remain in the table permanently with dangling `driveId` references.

Contrast: `companies.routes.js` `POST /companies/delete-all/` correctly includes `Shortlist.destroy({ where: {} })` in the right order.

**Fix:** Add `await Shortlist.destroy({ where: {} })` before `InterviewRound.destroy` in settings.routes.js, and also add `await Job.destroy({ where: {} })` since the Company model has a hasMany Job association that is also not cleaned up.

---

### S-02 — Footer shows financial/SEBI/SIP links on every placement portal page

**File:** `templates/base.html`  
**Severity:** HIGH — wrong product bleeding into TPO UI, confuses users

**Root cause:**  
The base layout footer unconditionally renders links to `/regulatory-disclosure`, `/calculators/sip`, `/terms`, and `/privacy` — all financial advisory product routes. A TPO or student using the placement portal sees these links on every page (dashboard, student list, companies, etc.) with no connection to their context.

**Fix:** Hide these financial footer links when the user is authenticated (i.e., inside the placement portal). Show a placement-appropriate footer instead (copyright, college name). The financial links can remain on unauthenticated/public routes if needed.

---

### S-03 — AI Wealth Advisor widget injected into every page

**File:** `templates/base.html`  
**Severity:** HIGH — wrong product, no auth guard on `/api/ai/chat`, professional confusion

**Root cause:**  
`{% include 'financial/ai_widget.html' %}` is called unconditionally at the bottom of `base.html`. Every page — including the TPO dashboard, student profile, shortlists, and interview rounds — shows a floating "AI Wealth Advisor" robot button in the bottom-right corner. The widget calls `/api/ai/chat` which is a financial advisory LLM endpoint. This is a completely different product that has no place in a college placement system UI.

Additionally, the widget's bottom-right position (`bottom: 24px; right: 24px`) directly conflicts with the theme toggle button (`bottom: 30px; right: 30px`) — they overlap on every page.

**Fix:** Remove the `{% include 'financial/ai_widget.html' %}` line from `base.html`. The AI widget belongs only in financial module templates.

---

### S-04 — addStudentModal and confirmOfferModal placed inside `{% else %}` block

**File:** `templates/tracker/shortlists/index.html`  
**Severity:** HIGH — core TPO actions completely inaccessible when any shortlists exist

**Root cause:**  
The template structure is:
```
{% if shortlists and shortlists.length > 0 %}
  ... shortlist cards ...
{% else %}
  ... empty state ...
  <div class="modal" id="addStudentModal"> ... </div>       ← BUG
  <div class="modal" id="confirmOfferModal"> ... </div>     ← BUG
  <script> openAddStudentModal / confirmAddStudent ... </script> ← BUG
{% endif %}
```
Both modals and all the JavaScript that drives them are inside the `{% else %}` branch. As soon as the first shortlist is created, the entire `{% else %}` block is skipped and these modals **never render into the DOM**. Any button that calls `openAddStudentModal()` or `confirmOffer()` fails silently with a JS error (`Cannot read properties of null`) because the modal elements don't exist.

The `confirmOffer()` function is called from the "Place" button inside every shortlist row, which is inside the `{% if %}` block — but the modal it opens (`#confirmOfferModal`) only exists in the `{% else %}` block.

**Fix:** Move both modals and their supporting JavaScript outside the `{% if %}...{% else %}...{% endif %}` structure so they are always rendered into the DOM.

---

### S-05 — placement_year set to student.year (academic year) in jobs route

**File:** `src/modules/admin/jobs/routes/jobs.routes.js`  
**Route:** `POST /jobs/:job_id/applications/:app_id/update/`  
**Severity:** MEDIUM — corrupts placement data

**Root cause:**  
When an application status is set to "Selected", the handler marks the student as Placed:
```js
placement_year: student.year || new Date().getFullYear().toString(),
```
`student.year` is the academic year field — values are `"1"`, `"2"`, `"3"`, `"4"` (which year of college the student is in). This is completely wrong as a `placement_year`. A student in their 4th year placed in 2026 gets `placement_year = "4"` instead of `"2026"`. The Placed Students page, Reports page, and Excel exports all filter by `placement_year` expecting a 4-digit calendar year.

**Fix:** Change to `new Date().getFullYear().toString()` unconditionally — there is no valid reason to use `student.year` here.

---

### S-06 — url() global helper map is incomplete

**File:** `src/app.js`  
**Severity:** MEDIUM — any template using an undefined named route gets `#` silently

**Root cause:**  
The `url()` Nunjucks global only maps 13 named routes. Missing:
- `'placed'` → `/placed/`
- `'shortlists'` → `/shortlists`
- `'jobs'` → `/jobs/`
- `'settings'` → `/settings/`
- `'audit_log'` → `/admin/audit-log/`
- `'notifications'` → `/admin/notifications/`
- `'calendar'` → `/admin/calendar/`
- `'student_profile_view'` → `/students/<pk>/profile/`
- `'student_interview_rounds'` → `/students/<pk>/interview-rounds/`
- `'student_placement'` → `/students/<pk>/placement/`

Any template that uses `url('shortlists')` gets `#` and the link silently does nothing.

**Fix:** Add all missing route names to the map.

---

### S-07 — countTracker_jobs() auto-method name is fragile

**File:** `src/modules/admin/companies/routes/companies.routes.js`  
**Route:** `GET /companies/`  
**Severity:** MEDIUM — breaks silently if Sequelize model internal name changes

**Root cause:**  
The companies list route calls:
```js
const jobCount = await company.countTracker_jobs();
```
Sequelize generates this counter method from the model's internal name (`"tracker_job"`), producing `countTracker_jobs`. This is a Sequelize implementation detail, not a stable public API. If the model name ever changes (or if a future Sequelize version changes the method naming convention), this call throws a `TypeError: company.countTracker_jobs is not a function` and the entire companies list page breaks.

**Fix:** Use the explicit `as` alias or a direct `Job.count({ where: { company_id: company.id } })` call instead, which is readable and immune to naming changes.

---

### S-08 — chartBranchesObjects query has duplicate-key bug (BUG-04 reprise)

**File:** `src/modules/admin/reports/routes/reports.routes.js`  
**Severity:** MEDIUM — null/empty branch rows appear in bar chart data

**Root cause:**  
The first `branchesObjects` query (dropdown population) was correctly fixed with `Op.and`. However a second query lower in the same route still uses the old pattern:
```js
const chartBranchesObjects = await Student.findAll({
  where: { branch: { [Op.not]: null, [Op.ne]: "" } },  // ← DUPLICATE KEY BUG
  ...
});
```
JavaScript evaluates this as `{ branch: { [Op.ne]: "" } }` — the `[Op.not]: null` condition is silently dropped. Students with `branch = null` can appear in the chart data, producing an empty/undefined bar label in the placement chart.

**Fix:** Apply the same `Op.and` merge: `{ branch: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }] } }`.

---

### S-09 — Op.iLike in skills filter fails on case-sensitive / non-Postgres DBs

**File:** `src/modules/admin/students/routes/students.routes.js`  
**Route:** `GET /students/`  
**Severity:** MEDIUM — skill search returns 0 results on SQLite, throws on strict Postgres

**Root cause:**  
The skills filter uses `[Op.iLike]` (case-insensitive LIKE, Postgres-only). If the server is ever run against SQLite during development or testing, this throws `Operator Op.iLike is not supported by this dialect`. Even on Postgres, the broadest fallback `{ skills: { [Op.iLike]: '%${s}%' } }` at the end of the OR chain makes the filter too broad — any student with the skill substring anywhere in their skills CSV matches.

Additionally, `STANDARD_SKILLS_LIST` is defined as a large array literal in **both** `students.routes.js` (backend) and `base.html` (frontend `STANDARD_SKILLS` global). This is redundant duplication — the two arrays must always be kept in sync manually. A single source of truth (e.g., a shared `skills.js` constant) would eliminate the risk of divergence.

**Fix for Op.iLike:** Replace `Op.iLike` with `Op.like` in the skills filter (the comparison is already against skill IDs which are numeric strings — case sensitivity is irrelevant for IDs). The broadest `%${s}%` fallback should be the last resort and should only match the full skill name, not a substring.

**Fix for duplication:** Extract the skills array to `src/config/skills.js`, require it in the route, and expose it as a Nunjucks global via `env.addGlobal` in `app.js` so the template reads from the same source.

---

### S-10 — No 404 handler in Express router

**File:** `src/routes/index.js`  
**Severity:** MEDIUM — unmatched URLs return Express default HTML 404 that breaks portal styling

**Root cause:**  
The router has no catch-all `*` route before the global error handler. When a user (or a bot, broken link, or stale bookmark) hits a URL that doesn't exist — e.g., `/admin/placements/`, `/jobs/`, `/some-typo/` — Express falls through all registered routes and either passes to the globalErrorHandler (which renders inline Bootstrap HTML, not the app's Nunjucks `error.html`) or returns Express's default plain text 404.

The result is a completely unstyled response that breaks the portal's look and feel and gives no navigation context.

**Fix:** Add a 404 catch-all at the end of `src/routes/index.js` that renders `tracker/error.html` with a 404 status.

---

### S-11 — Three unused dependencies installed

**File:** `package.json`  
**Severity:** LOW — unnecessary bloat, potential security surface

**Root cause:**  

| Package | Why installed | Status | Risk |
|---|---|---|---|
| `sqlite3` | Legacy — app used SQLite before migrating to Postgres | Unused — sequelize dialect is `postgres` | Adds ~10MB native binary; sqlite3 6.x has had CVEs |
| `ejs` | Never configured — Nunjucks is the template engine | Unused — no `res.render()` uses `.ejs` extension | No functional risk but adds confusion |
| `pdf-parse` | Unknown intent — no route reads PDF content | Unused — zero `require('pdf-parse')` in codebase | Adds 15MB of parse deps; creates a false attack surface |

**Fix:** Remove all three. Record the reason in this file.

---

## Dependency Map (what each package is used for)

| Package | Used where |
|---|---|
| `express` | App framework — all routes |
| `nunjucks` | Template engine — all HTML rendering |
| `sequelize` + `pg` | ORM + Postgres driver — all DB queries |
| `express-session` | Session auth — auth middleware |
| `cookie-parser` | Cookie reading — CSRF, session |
| `multer` | File uploads — photos, resumes, certificates, Excel |
| `nodemailer` | SMTP email — credential emails, shortlist notifications |
| `xlsx` | Excel import/export — student bulk import, placed/report exports |
| `express-rate-limit` | Auth rate limiting — login, register |
| `dotenv` | Env file loading — config |
| `ejs` | **UNUSED** — remove |
| `sqlite3` | **UNUSED** — remove |
| `pdf-parse` | **UNUSED** — remove |

---

## Orphan Files / Dead Code

| Path | Problem |
|---|---|
| `templates/tracker/placement_list.html` | No route renders it. `src/modules/admin/placements/routes/` is empty. |
| `templates/tracker/application_list.html` | No route renders it. `src/modules/admin/applications/routes/` is empty. |
| `templates/tracker/company_form.html` | Superseded by `templates/tracker/companies/add.html` and `edit.html`. |
| `templates/tracker/company_profile.html` | Superseded by `templates/tracker/companies/detail.html`. |
| `src/modules/admin/placements/routes/` | Empty directory. |
| `src/modules/admin/applications/routes/` | Empty directory. |
| `scratch_output.html` | Debug/scratch file committed to repo root. |
| `fix_templates.js`, `scan_templates.js` | One-off migration scripts in repo root — should be in `scripts/`. |

---

## TPO UX Issues (Non-Bug)

| Area | Issue |
|---|---|
| Shortlists page | No button to navigate from a shortlist directly to the company's drive detail page |
| Student list | `Op.iLike` skill search silently returns 0 results for skill names when data contains IDs |
| Companies list | `drive_count` counts all drives including completed ones — misleading "active" impression |
| Dashboard | `deptCounts` hardcodes `{ CS, AIML, AIDS, MBA }` — branches added in future won't appear |
| Settings page | "Delete all companies" success message says "drives/shortlists" but does NOT delete Shortlist rows (S-01) |
| Base sidebar | "Placement Status" and "Applications" nav items for students are anchor-scroll links — break if page is not at `/student/profile/` |
| Coordinator scope | Branch scoping via `getScopedDepartment()` only applied to `/students/` — a coordinator can see all companies, shortlists, and placed students across all branches |

---

## Fix Order (Priority)

1. **S-04** — Modal placement bug (shortlists page broken for all users with data)
2. **S-01** — settings delete-all-companies FK/orphan issue (data integrity)
3. **S-03** — Remove AI wealth widget from placement portal (wrong product)
4. **S-02** — Remove financial footer links from placement portal (wrong product)
5. **S-05** — jobs placement_year bug (corrupt placement data)
6. **S-08** — reports chartBranchesObjects duplicate key bug (chart shows null branch)
7. **S-10** — Add 404 handler (broken navigation experience)
8. **S-06** — Complete url() helper map (silent broken links)
9. **S-07** — Replace countTracker_jobs() with explicit count (fragile method)
10. **S-09** — Replace Op.iLike with Op.like; extract skills constant
11. **S-11** — Remove unused dependencies

---

*This file supersedes and extends `BUGS.md`. All BUG-01 through BUG-11 items from BUGS.md are confirmed fixed. The S-xx series are new findings from this audit.*
