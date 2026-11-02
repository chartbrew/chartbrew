import "../modules/legacyCryptoCompat.js";
import { beforeEach, inject } from "vitest";
import { testDbManager } from "./helpers/testDbManager.js";

// Ensure required env vars exist for settings.js during tests
// (settings reads process.env at require-time)
process.env.CB_SECRET = process.env.CB_SECRET || "test-secret-dev";
// Must be 64 hex chars (32 bytes) because server/modules/cbCrypto.js uses it as AES-256 key in hex.
process.env.CB_ENCRYPTION_KEY = process.env.CB_ENCRYPTION_KEY
  || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.VITE_APP_CLIENT_HOST = process.env.VITE_APP_CLIENT_HOST || "http://localhost:3000";
process.env.CB_RESTRICT_TEAMS = process.env.CB_RESTRICT_TEAMS || "0";
process.env.CB_RESTRICT_SIGNUP = process.env.CB_RESTRICT_SIGNUP || "0";

const testDbConnection = inject("testDbConnection");
if (testDbConnection) {
  process.env.CB_TEST_DB_REUSE = "1";
  process.env.CB_DB_HOST = testDbConnection.host;
  process.env.CB_DB_PORT = testDbConnection.port.toString();
  process.env.CB_DB_NAME = testDbConnection.database;
  process.env.CB_DB_USERNAME = testDbConnection.username;
  process.env.CB_DB_PASSWORD = testDbConnection.password;
  process.env.CB_DB_DIALECT = testDbConnection.dialect;
  process.env.CB_DB_SSL = "";
  process.env.CB_DB_CERT = "";
  process.env.CB_DB_SSL_KEY = "";
  process.env.CB_DB_SSL_CERT = "";
}

function usesSharedTestDatabase(context) {
  const testPath = (context.task?.file?.filepath || "").replaceAll("\\", "/");
  return testPath.includes("/tests/integration/")
    || testPath.endsWith("/tests/unit/updateAudit.test.js");
}

// Database tests share one migrated schema. Clear its rows between tests.
beforeEach(async (context) => {
  if (!usesSharedTestDatabase(context)) return;

  // Only clean if database is initialized
  if (testDbManager.getSequelize()) {
    await testDbManager.cleanup();
  }
});
