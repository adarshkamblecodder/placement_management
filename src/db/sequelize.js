const { Sequelize } = require("sequelize");
const { ensureEnvLoaded } = require("../config/env");

let sequelize;

function getSequelize() {
  ensureEnvLoaded();

  if (sequelize) return sequelize;

  // Render (and most cloud platforms) provide a single DATABASE_URL connection
  // string. Use it when available; fall back to individual DB_* / DATABASE_*
  // env vars for local development.
  const databaseUrl = process.env.DATABASE_URL;

  const sharedOptions = {
    dialect: "postgres",
    logging: false,
    pool: {
      max:     10,
      min:     2,
      acquire: 30000,
      idle:    10000,
    },
    dialectOptions: {
      timezone: "UTC",
      // Required on Render / Heroku — their Postgres instances use SSL.
      ssl: process.env.NODE_ENV === "production"
        ? { require: true, rejectUnauthorized: false }
        : false,
    },
    define: {
      freezeTableName: true,
      underscored:     false,
    },
  };

  if (databaseUrl) {
    sequelize = new Sequelize(databaseUrl, sharedOptions);
  } else {
    sequelize = new Sequelize(
      process.env.DB_NAME     || process.env.DATABASE_NAME     || "placement_db",
      process.env.DB_USER     || process.env.DATABASE_USER     || "postgres",
      process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || "",
      {
        ...sharedOptions,
        host: process.env.DB_HOST || process.env.DATABASE_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
      }
    );
  }

  return sequelize;
}

async function initSequelize() {
  const s = getSequelize();
  await s.authenticate();
  return s;
}

module.exports = { getSequelize, initSequelize };
