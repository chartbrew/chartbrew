import { beforeEach } from "vitest";
import { testDbManager } from "./helpers/testDbManager.js";

// Clean database between each test but don't restart containers
beforeEach(async () => {
  // Only clean if database is initialized
  if (testDbManager.getSequelize()) {
    await testDbManager.cleanup();
  }
});
