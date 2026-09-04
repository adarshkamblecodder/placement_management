const dotenv = require("dotenv");

let loaded = false;

function ensureEnvLoaded() {
  if (loaded) return;
  loaded = true;

  // Load root-level .env (matches Django config files in this repo).
  dotenv.config({ path: require("path").join(__dirname, "..", "..", ".env") });
}

module.exports = { ensureEnvLoaded };

