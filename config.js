// Centralized config loader for environment variables
// Exits with an error message for critical missing variables.

const required = [];

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TEST_GUILD_ID = process.env.TEST_GUILD_ID;

const PREFIX = process.env.PREFIX || "!";
const OWNER = process.env.OWNER || null;

if (!TOKEN) {
  console.error("[config] ERROR: Missing required environment variable: TOKEN");
  // Fatal: bot cannot run without token
  process.exit(1);
}

if (!CLIENT_ID) {
  console.warn("[config] WARNING: CLIENT_ID is not set. Some API calls may fail.");
}

module.exports = {
  token: TOKEN,
  client_id: CLIENT_ID,
  test_guild_id: TEST_GUILD_ID,
  prefix: PREFIX,
  owner: OWNER,
};
