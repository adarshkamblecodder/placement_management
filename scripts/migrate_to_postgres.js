/**
 * migrate_to_postgres.js
 *
 * Migrates the Placement Management System from SQLite to PostgreSQL.
 *
 * Usage:
 *   node scripts/migrate_to_postgres.js
 *
 * Run as the postgres superuser so FK triggers can be relaxed during bulk load
 * and privileges can be granted to the app user afterward:
 *
 *   $env:MIGRATE_PG_USER     = "postgres"
 *   $env:MIGRATE_PG_PASSWORD = "<your postgres password>"
 *   node scripts/migrate_to_postgres.js
 *
 * Prerequisites:
 *   1. PostgreSQL running and reachable.
 *   2. Target database created:
 *        psql -U postgres -c "CREATE USER placement_user WITH PASSWORD 'Pm@Place2026!';"
 *        psql -U postgres -c "CREATE DATABASE placement_db OWNER placement_user;"
 *   3. .env configured with DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
 *      (app user, e.g. placement_user).
 *   4. sqlite3 npm package present (already in package.json).
 *   5. pg npm package present: npm install pg
 *
 * The script is safe to re-run — every INSERT uses ON CONFLICT DO NOTHING.
 * The SQLite database is opened READ-ONLY and is never modified.
 */

"use strict";

const path    = require("path");
const sqlite3 = require("sqlite3").verbose();
const { Client } = require("pg");

// ─── Load .env ────────────────────────────────────────────────────────────────
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// ─── PostgreSQL connection config ─────────────────────────────────────────────
// Use MIGRATE_PG_USER / MIGRATE_PG_PASSWORD to run as a superuser (postgres)
// so FK triggers can be suspended and privileges granted.
// Falls back to the application DB_* / DATABASE_* vars.
const pgConfig = {
  host:     process.env.DB_HOST     || process.env.DATABASE_HOST     || "127.0.0.1",
  port:     Number(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  database: process.env.DB_NAME     || process.env.DATABASE_NAME     || "placement_db",
  user:     process.env.MIGRATE_PG_USER     || process.env.DB_USER     || process.env.DATABASE_USER     || "postgres",
  password: process.env.MIGRATE_PG_PASSWORD || process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || "",
};

// ─── SQLite path ──────────────────────────────────────────────────────────────
const SQLITE_PATH = path.join(__dirname, "..", "db.sqlite3");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function section(title) {
  console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`);
}

// ─── DDL statements as an array (never split on ";") ──────────────────────────
//
// Type mapping from the live SQLite schema:
//   TINYINT(1)           → BOOLEAN
//   INTEGER PK autoincr  → SERIAL  (BIGINT PK → BIGSERIAL)
//   FLOAT                → DOUBLE PRECISION
//   DATETIME             → TIMESTAMPTZ
//   DATE                 → DATE
//   TEXT                 → TEXT  (no length cap)
//   VARCHAR(n)           → VARCHAR(n)
//   DECIMAL(p,s)         → NUMERIC(p,s)
//   DataTypes.ENUM(...)  → TEXT + CHECK  (avoids named PG ENUM types)
//   Column names quoted  → camelCase and reserved words preserved exactly.

const DDL_STATEMENTS = [

  `CREATE TABLE IF NOT EXISTS django_content_type (
    id         SERIAL PRIMARY KEY,
    app_label  VARCHAR(100) NOT NULL,
    model      VARCHAR(100) NOT NULL,
    UNIQUE (app_label, model)
  )`,

  `CREATE TABLE IF NOT EXISTS auth_group (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
  )`,

  `CREATE TABLE IF NOT EXISTS auth_permission (
    id              SERIAL PRIMARY KEY,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id),
    codename        VARCHAR(100) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    UNIQUE (content_type_id, codename)
  )`,

  `CREATE TABLE IF NOT EXISTS auth_group_permissions (
    id            SERIAL PRIMARY KEY,
    group_id      INTEGER NOT NULL REFERENCES auth_group(id),
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id),
    UNIQUE (group_id, permission_id)
  )`,

  `CREATE TABLE IF NOT EXISTS auth_user (
    id           SERIAL PRIMARY KEY,
    password     VARCHAR(128) NOT NULL,
    username     VARCHAR(150) NOT NULL UNIQUE,
    is_staff     BOOLEAN NOT NULL DEFAULT FALSE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    email        VARCHAR(254),
    first_name   VARCHAR(150),
    last_name    VARCHAR(150),
    date_joined  TIMESTAMPTZ,
    role         VARCHAR(50)  NOT NULL DEFAULT 'student',
    department   VARCHAR(50)
  )`,

  `CREATE TABLE IF NOT EXISTS auth_user_backup (
    id           SERIAL PRIMARY KEY,
    password     VARCHAR(128) NOT NULL,
    username     VARCHAR(150) NOT NULL,
    is_staff     BOOLEAN NOT NULL DEFAULT FALSE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    email        VARCHAR(254),
    first_name   VARCHAR(150),
    last_name    VARCHAR(150),
    date_joined  TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS auth_user_groups (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES auth_user(id),
    group_id INTEGER NOT NULL REFERENCES auth_group(id),
    UNIQUE (user_id, group_id)
  )`,

  `CREATE TABLE IF NOT EXISTS auth_user_user_permissions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES auth_user(id),
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id),
    UNIQUE (user_id, permission_id)
  )`,

  `CREATE TABLE IF NOT EXISTS django_admin_log (
    id              SERIAL PRIMARY KEY,
    object_id       TEXT,
    object_repr     VARCHAR(200) NOT NULL,
    action_flag     SMALLINT     NOT NULL,
    change_message  TEXT         NOT NULL,
    content_type_id INTEGER REFERENCES django_content_type(id),
    user_id         INTEGER NOT NULL REFERENCES auth_user(id),
    action_time     TIMESTAMPTZ  NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS django_migrations (
    id      SERIAL PRIMARY KEY,
    app     VARCHAR(255) NOT NULL,
    name    VARCHAR(255) NOT NULL,
    applied TIMESTAMPTZ  NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS django_session (
    session_key  VARCHAR(40)  PRIMARY KEY,
    session_data TEXT         NOT NULL,
    expire_date  TIMESTAMPTZ  NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_company (
    id                   BIGSERIAL PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL,
    role                 VARCHAR(100),
    package              NUMERIC(10,2),
    eligibility_criteria TEXT,
    industry             VARCHAR(100),
    website              VARCHAR(255),
    hr_contact           VARCHAR(150),
    tier                 VARCHAR(50)  DEFAULT 'Tier 1',
    rating               DOUBLE PRECISION DEFAULT 4.5,
    "tpoNotes"           TEXT,
    "visitHistory"       TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_student (
    student_id                  VARCHAR(50)    PRIMARY KEY,
    name                        VARCHAR(100),
    date_of_birth               DATE,
    gender                      VARCHAR(10),
    email                       VARCHAR(254),
    phone_number                VARCHAR(20),
    branch                      VARCHAR(100),
    year                        VARCHAR(20),
    cgpa                        NUMERIC(4,2),
    address                     TEXT,
    skills                      TEXT,
    resume_link                 VARCHAR(200),
    linkedin                    VARCHAR(200),
    github                      VARCHAR(200),
    profile_photo               VARCHAR(100),
    placement_status            VARCHAR(100)   NOT NULL DEFAULT 'Not Placed',
    placement_company           VARCHAR(100),
    placement_package           NUMERIC(10,2),
    placement_year              VARCHAR(10),
    user_id                     INTEGER REFERENCES auth_user(id),
    raw_password                VARCHAR(50),
    backlogs                    INTEGER        DEFAULT 0,
    additional_skills           TEXT,
    certifications              TEXT,
    "profileVerificationStatus" VARCHAR(50)    NOT NULL DEFAULT 'Pending',
    "verificationRemarks"       TEXT,
    "verifiedBy"                VARCHAR(150),
    smtp_host                   VARCHAR(200),
    smtp_port                   INTEGER,
    smtp_secure                 BOOLEAN        DEFAULT FALSE,
    smtp_user                   VARCHAR(200),
    smtp_pass                   VARCHAR(200),
    mail_from                   VARCHAR(200)
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_student_login_meta (
    id                            SERIAL PRIMARY KEY,
    "studentId"                   VARCHAR(50)  NOT NULL REFERENCES tracker_student(student_id),
    "authUserId"                  INTEGER      REFERENCES auth_user(id),
    "isFirstLogin"                BOOLEAN      NOT NULL DEFAULT TRUE,
    "lastLoginAt"                 TIMESTAMPTZ,
    "passwordResetTokenHash"      VARCHAR(128),
    "passwordResetTokenExpiresAt" TIMESTAMPTZ,
    "createdAt"                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_student_profile (
    id                     SERIAL PRIMARY KEY,
    "studentId"            VARCHAR(50) NOT NULL UNIQUE REFERENCES tracker_student(student_id),
    bio                    TEXT,
    "tenthPercentage"      DOUBLE PRECISION,
    "twelfthPercentage"    DOUBLE PRECISION,
    backlogs               INTEGER,
    certifications         TEXT,
    projects               TEXT,
    "internshipExperience" TEXT,
    "preferredRole"        VARCHAR(150),
    "preferredCompanyType" VARCHAR(150),
    "portfolioUrl"         VARCHAR(255),
    "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_resume (
    id                 SERIAL PRIMARY KEY,
    "studentId"        VARCHAR(50)  NOT NULL REFERENCES tracker_student(student_id),
    "storagePath"      VARCHAR(255) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType"         VARCHAR(100) NOT NULL,
    "sizeBytes"        INTEGER      NOT NULL,
    "isActive"         BOOLEAN      NOT NULL DEFAULT TRUE,
    "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_tracker_resume_student
     ON tracker_resume ("studentId")`,

  `CREATE INDEX IF NOT EXISTS idx_tracker_resume_student_active
     ON tracker_resume ("studentId", "isActive")`,

  `CREATE TABLE IF NOT EXISTS tracker_internship (
    id                     SERIAL PRIMARY KEY,
    "studentId"            VARCHAR(50)  NOT NULL REFERENCES tracker_student(student_id),
    status                 TEXT         NOT NULL DEFAULT 'Completed'
                           CHECK (status IN ('Completed','Ongoing','Not Done')),
    "companyName"          VARCHAR(150) NOT NULL,
    "internshipType"       TEXT         NOT NULL DEFAULT 'Technical'
                           CHECK ("internshipType" IN ('Technical','Non-Technical','Research')),
    domain                 VARCHAR(150) NOT NULL,
    role                   VARCHAR(150) NOT NULL,
    "startDate"            DATE         NOT NULL,
    "endDate"              DATE         NOT NULL,
    duration               VARCHAR(100),
    "workMode"             TEXT         NOT NULL DEFAULT 'On-site'
                           CHECK ("workMode" IN ('On-site','Remote','Hybrid')),
    description            TEXT,
    "projectTitle"         VARCHAR(200),
    responsibilities       TEXT,
    "skillsUsed"           TEXT,
    outcome                TEXT,
    "certificateFile"      VARCHAR(255),
    "certificateNumber"    VARCHAR(100),
    "certificateIssueDate" DATE,
    "mentorName"           VARCHAR(150),
    "mentorContact"        VARCHAR(150),
    "stipendReceived"      BOOLEAN      NOT NULL DEFAULT FALSE,
    "stipendAmount"        DOUBLE PRECISION,
    "ppoOffered"           BOOLEAN      NOT NULL DEFAULT FALSE,
    "ppoPackage"           DOUBLE PRECISION,
    "verificationStatus"   TEXT         NOT NULL DEFAULT 'Pending'
                           CHECK ("verificationStatus" IN ('Pending','Verified','Rejected')),
    "verificationRemarks"  TEXT,
    "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_student_project (
    id                     SERIAL PRIMARY KEY,
    "studentId"            VARCHAR(50)  NOT NULL REFERENCES tracker_student(student_id),
    "projectType"          TEXT         NOT NULL DEFAULT 'NORMAL'
                           CHECK ("projectType" IN ('LIVE','NORMAL')),
    title                  VARCHAR(200) NOT NULL,
    domain                 VARCHAR(150),
    description            TEXT,
    "technologiesUsed"     VARCHAR(500),
    role                   VARCHAR(150),
    "startDate"            DATE,
    "endDate"              DATE,
    duration               VARCHAR(100),
    "projectStatus"        TEXT         NOT NULL DEFAULT 'Completed'
                           CHECK ("projectStatus" IN ('Ongoing','Completed','On Hold')),
    "projectUrl"           VARCHAR(500),
    "githubUrl"            VARCHAR(500),
    "teamSize"             INTEGER,
    "teamMembers"          VARCHAR(500),
    "clientOrOrganization" VARCHAR(200),
    "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_tracker_student_project_student
     ON tracker_student_project ("studentId")`,

  `CREATE TABLE IF NOT EXISTS tracker_jobs (
    id                   SERIAL PRIMARY KEY,
    title                VARCHAR(150) NOT NULL,
    description          TEXT,
    package_lpa          NUMERIC(6,2),
    interview_start_date DATE,
    interview_end_date   DATE,
    status               VARCHAR(50)  DEFAULT 'Upcoming',
    "createdAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    company_id           BIGINT REFERENCES tracker_company(id)
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_application (
    id           SERIAL PRIMARY KEY,
    status       VARCHAR(20)  NOT NULL DEFAULT 'Applied',
    company_id   BIGINT REFERENCES tracker_company(id),
    student_id   VARCHAR(50)  NOT NULL REFERENCES tracker_student(student_id),
    job_id       INTEGER REFERENCES tracker_jobs(id),
    notes        TEXT,
    applied_date DATE
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_placement (
    id         SERIAL PRIMARY KEY,
    package    NUMERIC(10,2) NOT NULL,
    company_id BIGINT        NOT NULL REFERENCES tracker_company(id),
    student_id VARCHAR(50)   NOT NULL REFERENCES tracker_student(student_id)
  )`,

  `CREATE TABLE IF NOT EXISTS placement_drives (
    id                       SERIAL PRIMARY KEY,
    "companyId"              BIGINT           NOT NULL REFERENCES tracker_company(id),
    "jobRole"                VARCHAR(150)     NOT NULL,
    "jobDescription"         TEXT,
    "interviewDate"          DATE             NOT NULL,
    "numberOfOpenings"       INTEGER          NOT NULL DEFAULT 1,
    "minCGPA"                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eligibleBranches"       VARCHAR(255),
    "packageLPA"             DOUBLE PRECISION,
    "driveStatus"            TEXT             NOT NULL DEFAULT 'upcoming'
                             CHECK ("driveStatus" IN ('upcoming','ongoing','completed')),
    "createdAt"              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    "updatedAt"              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    "maxBacklogs"            INTEGER          NOT NULL DEFAULT 0,
    "eligibleGraduationYear" INTEGER,
    "lifecycleStage"         VARCHAR(50)      NOT NULL DEFAULT 'Announced',
    "allowMultipleOffers"    BOOLEAN          NOT NULL DEFAULT FALSE,
    "technicalSkills"        VARCHAR(255)
  )`,

  `CREATE TABLE IF NOT EXISTS shortlists (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    "driveId"   INTEGER      NOT NULL REFERENCES placement_drives(id),
    "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS shortlist_students (
    id            SERIAL PRIMARY KEY,
    "shortlistId" INTEGER      NOT NULL REFERENCES shortlists(id),
    "studentId"   VARCHAR(50)  NOT NULL REFERENCES tracker_student(student_id),
    "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    status        VARCHAR(20)  NOT NULL DEFAULT 'Shortlisted',
    "statusNote"  TEXT,
    UNIQUE ("shortlistId", "studentId")
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_interview_round (
    id          SERIAL PRIMARY KEY,
    "driveId"   INTEGER      NOT NULL REFERENCES placement_drives(id),
    "roundName" VARCHAR(100) NOT NULL,
    "roundDate" DATE,
    "order"     INTEGER      NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_student_round_result (
    id                SERIAL PRIMARY KEY,
    "roundId"         INTEGER     NOT NULL REFERENCES tracker_interview_round(id),
    "studentId"       VARCHAR(50) NOT NULL REFERENCES tracker_student(student_id),
    result            TEXT        NOT NULL DEFAULT 'Pending'
                      CHECK (result IN ('Qualified','Passed','Rejected','Pending')),
    "rejectionReason" TEXT,
    notes             TEXT,
    "interviewDate"   DATE,
    remarks           TEXT,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("roundId", "studentId")
  )`,

  `CREATE TABLE IF NOT EXISTS tracker_audit_log (
    id           SERIAL PRIMARY KEY,
    admin_id     VARCHAR(100),
    action       VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_id    VARCHAR(100),
    details      TEXT,
    timestamp    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

];

// ─── Tables to migrate, in FK-dependency order ────────────────────────────────
// pk: column name used to reset the SERIAL sequence after copy.
//     null for tables whose PK is non-integer (e.g. tracker_student.student_id).
const TABLES = [
  { sqlite: "django_content_type",          pg: "django_content_type",          pk: "id" },
  { sqlite: "auth_group",                   pg: "auth_group",                   pk: "id" },
  { sqlite: "auth_permission",              pg: "auth_permission",              pk: "id" },
  { sqlite: "auth_group_permissions",       pg: "auth_group_permissions",       pk: "id" },
  { sqlite: "auth_user",                    pg: "auth_user",                    pk: "id" },
  { sqlite: "auth_user_backup",             pg: "auth_user_backup",             pk: "id" },
  { sqlite: "auth_user_groups",             pg: "auth_user_groups",             pk: "id" },
  { sqlite: "auth_user_user_permissions",   pg: "auth_user_user_permissions",   pk: "id" },
  { sqlite: "django_admin_log",             pg: "django_admin_log",             pk: "id" },
  { sqlite: "django_migrations",            pg: "django_migrations",            pk: "id" },
  { sqlite: "django_session",               pg: "django_session",               pk: null },
  { sqlite: "tracker_company",              pg: "tracker_company",              pk: "id" },
  { sqlite: "tracker_student",              pg: "tracker_student",              pk: null },
  { sqlite: "tracker_student_login_meta",   pg: "tracker_student_login_meta",   pk: "id" },
  { sqlite: "tracker_student_profile",      pg: "tracker_student_profile",      pk: "id" },
  { sqlite: "tracker_resume",               pg: "tracker_resume",               pk: "id" },
  { sqlite: "tracker_internship",           pg: "tracker_internship",           pk: "id" },
  { sqlite: "tracker_student_project",      pg: "tracker_student_project",      pk: "id" },
  { sqlite: "tracker_jobs",                 pg: "tracker_jobs",                 pk: "id" },
  { sqlite: "tracker_application",          pg: "tracker_application",          pk: "id" },
  { sqlite: "tracker_placement",            pg: "tracker_placement",            pk: "id" },
  { sqlite: "placement_drives",             pg: "placement_drives",             pk: "id" },
  { sqlite: "shortlists",                   pg: "shortlists",                   pk: "id" },
  { sqlite: "shortlist_students",           pg: "shortlist_students",           pk: "id" },
  { sqlite: "tracker_interview_round",      pg: "tracker_interview_round",      pk: "id" },
  { sqlite: "tracker_student_round_result", pg: "tracker_student_round_result", pk: "id" },
  { sqlite: "tracker_audit_log",            pg: "tracker_audit_log",            pk: "id" },
];

// ─── Boolean coercion ─────────────────────────────────────────────────────────
// SQLite stores booleans as 0/1. PostgreSQL BOOLEAN expects true/false.
const BOOLEAN_COLUMNS = new Set([
  "is_staff", "is_superuser", "is_active",
  "isFirstLogin", "isActive",
  "stipendReceived", "ppoOffered",
  "allowMultipleOffers", "is_published",
  "smtp_secure",
]);

function coerceRow(row) {
  const out = {};
  for (const [col, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      out[col] = null;
    } else if (BOOLEAN_COLUMNS.has(col)) {
      out[col] = Boolean(Number(val));
    } else {
      out[col] = val;
    }
  }
  return out;
}

// ─── Copy one table ───────────────────────────────────────────────────────────
async function copyTable(db, pgClient, tableInfo) {
  const { sqlite: src, pg: dst } = tableInfo;

  let rows;
  try {
    rows = await sqliteAll(db, `SELECT * FROM "${src}"`);
  } catch (e) {
    log(`  SKIP ${src} — SQLite read error: ${e.message}`);
    return { copied: 0 };
  }

  if (rows.length === 0) {
    log(`  ${dst}: 0 rows (empty table)`);
    return { copied: 0 };
  }

  const cols         = Object.keys(rows[0]);
  const quotedCols   = cols.map(c => `"${c}"`).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql          = `INSERT INTO "${dst}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let copied = 0;
  let skipped = 0;

  for (const rawRow of rows) {
    const row    = coerceRow(rawRow);
    const values = cols.map(c => row[c] ?? null);
    try {
      const res = await pgClient.query(sql, values);
      if (res.rowCount > 0) copied++;
      else skipped++;
    } catch (e) {
      skipped++;
      if (skipped <= 3) {
        log(`  WARN ${dst} insert skipped: ${e.message.split("\n")[0]}`);
      }
    }
  }

  log(`  ${dst}: ${copied} inserted, ${skipped} skipped`);
  return { copied };
}

// ─── Reset SERIAL sequences ───────────────────────────────────────────────────
async function resetSequences(pgClient) {
  section("Step 5 — Resetting PostgreSQL SERIAL sequences");
  for (const t of TABLES) {
    if (!t.pk) continue;
    try {
      const res = await pgClient.query(`SELECT MAX("${t.pk}") AS mx FROM "${t.pg}"`);
      const mx  = res.rows[0]?.mx;
      if (mx === null || mx === undefined) continue;

      const seqRes  = await pgClient.query(`SELECT pg_get_serial_sequence($1, $2) AS seq`, [t.pg, t.pk]);
      const seqName = seqRes.rows[0]?.seq;
      if (!seqName) continue;

      await pgClient.query(`SELECT setval($1, $2, true)`, [seqName, mx]);
      log(`  ${t.pg}.${t.pk}: sequence → ${mx}`);
    } catch (e) {
      log(`  WARN ${t.pg}.${t.pk}: ${e.message.split("\n")[0]}`);
    }
  }
}

// ─── Row-count verification ───────────────────────────────────────────────────
async function verifyRowCounts(db, pgClient) {
  section("Step 6 — Row-count verification");
  const rows     = [];
  let   allMatch = true;

  for (const t of TABLES) {
    const sl  = await sqliteGet(db, `SELECT COUNT(*) AS cnt FROM "${t.sqlite}"`);
    const pg  = await pgClient.query(`SELECT COUNT(*) AS cnt FROM "${t.pg}"`);
    const slN = Number(sl?.cnt ?? 0);
    const pgN = Number(pg.rows[0]?.cnt ?? 0);
    if (slN !== pgN) allMatch = false;
    rows.push({ table: t.pg, sqlite: slN, postgres: pgN, ok: slN === pgN });
  }

  const w = Math.max(...rows.map(r => r.table.length), 5);
  console.log(`\n  ${"Table".padEnd(w)}  ${"SQLite".padStart(8)}  ${"PostgreSQL".padStart(10)}  Status`);
  console.log(`  ${"-".repeat(w)}  ${"-".repeat(8)}  ${"-".repeat(10)}  ------`);
  for (const r of rows) {
    const mark = r.ok ? "✓" : "✗ MISMATCH";
    console.log(`  ${r.table.padEnd(w)}  ${String(r.sqlite).padStart(8)}  ${String(r.postgres).padStart(10)}  ${mark}`);
  }
  console.log();

  if (allMatch) {
    log("All row counts match. Migration verified. ✓");
  } else {
    log("WARNING: Some counts differ. Review MISMATCH rows above.");
  }
  return allMatch;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  section("Placement Management System — SQLite → PostgreSQL Migration");
  log(`SQLite  : ${SQLITE_PATH}`);
  log(`Postgres: ${pgConfig.user}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);

  // Step 1 — Open SQLite read-only
  section("Step 1 — Opening SQLite (read-only)");
  const db = await new Promise((resolve, reject) => {
    const d = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, err => {
      if (err) reject(new Error(`Cannot open SQLite: ${err.message}`));
      else resolve(d);
    });
  });
  log("SQLite opened.");

  // Step 2 — Connect to PostgreSQL
  section("Step 2 — Connecting to PostgreSQL");
  const pgClient = new Client(pgConfig);
  await pgClient.connect();
  log("PostgreSQL connected.");

  // Relax FK triggers for bulk load (requires superuser)
  await pgClient.query("SET session_replication_role = 'replica'");
  log("FK enforcement suspended for bulk insert.");

  try {
    // Step 3 — Create tables
    section("Step 3 — Creating PostgreSQL tables (IF NOT EXISTS)");
    for (const stmt of DDL_STATEMENTS) {
      await pgClient.query(stmt);
    }
    log("All tables created.");

    // Step 4 — Copy data
    section("Step 4 — Copying data SQLite → PostgreSQL");
    let total = 0;
    for (const t of TABLES) {
      const { copied } = await copyTable(db, pgClient, t);
      total += copied;
    }
    log(`Copy complete. Total rows inserted: ${total}`);

    // Restore FK enforcement
    await pgClient.query("SET session_replication_role = 'origin'");
    log("FK enforcement restored.");

    // Step 5a — Grant privileges and transfer ownership to app user
    // Tables were created by the superuser (postgres). Sequelize's sync({alter})
    // requires the connecting user to OWN the tables it needs to ALTER. We transfer
    // ownership of every table and sequence to the app user here so the application
    // can run sync() without needing superuser rights.
    const appUser = process.env.DB_USER || process.env.DATABASE_USER;
    if (appUser && appUser !== pgConfig.user) {
      section(`Step 5a — Ownership transfer + privileges → "${appUser}"`);
      try {
        // Transfer table ownership
        const tables = await pgClient.query(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
        );
        for (const row of tables.rows) {
          await pgClient.query(
            `ALTER TABLE public.${JSON.stringify(row.tablename)} OWNER TO "${appUser}"`
          );
        }
        // Transfer sequence ownership
        const seqs = await pgClient.query(
          `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`
        );
        for (const row of seqs.rows) {
          await pgClient.query(
            `ALTER SEQUENCE public.${JSON.stringify(row.sequence_name)} OWNER TO "${appUser}"`
          );
        }
        // Also grant schema usage and default privileges for future objects
        await pgClient.query(`GRANT USAGE ON SCHEMA public TO "${appUser}"`);
        await pgClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO "${appUser}"`);
        await pgClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${appUser}"`);
        log(`Ownership transferred and privileges granted to "${appUser}".`);
      } catch (e) {
        log(`WARN ownership/grant failed: ${e.message.split("\n")[0]}`);
        log(`  Run manually in psql: ALTER TABLE <table> OWNER TO "${appUser}";`);
      }
    }

    // Step 5 — Reset sequences
    await resetSequences(pgClient);

    // Step 6 — Verify
    const ok = await verifyRowCounts(db, pgClient);

    section("Migration complete");
    if (ok) {
      log("SUCCESS — all data migrated to PostgreSQL.");
      log("Next steps:");
      log("  1. .env already has DB_* set — remove any USE_SQLITE=True line.");
      log("  2. npm start   (app now uses PostgreSQL)");
      log("  3. Keep db.sqlite3 as backup until fully verified.");
    } else {
      log("PARTIAL — review mismatches and re-run (safe to re-run).");
    }

  } catch (err) {
    await pgClient.query("SET session_replication_role = 'origin'").catch(() => {});
    throw err;
  } finally {
    db.close();
    await pgClient.end();
  }
}

main().catch(err => {
  console.error("\nMigration failed:", err.message || err);
  process.exit(1);
});
