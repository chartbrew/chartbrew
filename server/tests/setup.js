import { beforeEach } from "vitest";
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

// Clean database between each test but don't restart containers
beforeEach(async () => {
  // Only clean if database is initialized
  if (testDbManager.getSequelize()) {
    await testDbManager.cleanup();
  }
});
