// Database configuration surface (sequelize bootstrap remains in src/db/sequelize.js).
// Supports both the new DB_* prefix (PostgreSQL standard) and the legacy DATABASE_*
// prefix so that existing deployment .env files keep working without changes.
function getDatabaseConfig() {
  const { ensureEnvLoaded } = require("./env");
  ensureEnvLoaded();

  return {
    name:     process.env.DB_NAME     || process.env.DATABASE_NAME     || "placement_db",
    user:     process.env.DB_USER     || process.env.DATABASE_USER     || "postgres",
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || "",
    host:     process.env.DB_HOST     || process.env.DATABASE_HOST     || "127.0.0.1",
    port:     Number(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
    dialect:  "postgres",
  };
}

module.exports = { getDatabaseConfig };
