import "../modules/legacyCryptoCompat.js";
import { beforeEach, inject } from "vitest";
import { testDbManager } from "./helpers/testDbManager.js";

// Ensure required env vars exist for settings-dev.js during tests
// (settings-dev reads process.env at require-time)
process.env.CB_SECRET_DEV = process.env.CB_SECRET_DEV || "test-secret-dev";
// Must be 64 hex chars (32 bytes) because server/modules/cbCrypto.js uses it as AES-256 key in hex.
process.env.CB_ENCRYPTION_KEY_DEV = process.env.CB_ENCRYPTION_KEY_DEV
  || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.VITE_APP_CLIENT_HOST_DEV = process.env.VITE_APP_CLIENT_HOST_DEV || "http://localhost:3000";
process.env.CB_RESTRICT_TEAMS_DEV = process.env.CB_RESTRICT_TEAMS_DEV || "0";
process.env.CB_RESTRICT_SIGNUP_DEV = process.env.CB_RESTRICT_SIGNUP_DEV || "0";

const testDbConnection = inject("testDbConnection");
if (testDbConnection) {
  process.env.CB_TEST_DB_REUSE = "1";
  process.env.CB_DB_HOST_DEV = testDbConnection.host;
  process.env.CB_DB_PORT_DEV = testDbConnection.port.toString();
  process.env.CB_DB_NAME_DEV = testDbConnection.database;
  process.env.CB_DB_USERNAME_DEV = testDbConnection.username;
  process.env.CB_DB_PASSWORD_DEV = testDbConnection.password;
  process.env.CB_DB_DIALECT_DEV = testDbConnection.dialect;
}

function usesSharedTestDatabase(context) {
  const testPath = context.task?.file?.filepath || "";
  return testPath.replaceAll("\\", "/").includes("/tests/integration/");
}

// Integration tests share one database. Unit tests use mocks or their own isolated database.
beforeEach(async (context) => {
  if (!usesSharedTestDatabase(context)) return;

  // Only clean if database is initialized
  if (testDbManager.getSequelize()) {
    await testDbManager.cleanup();
  }
});
