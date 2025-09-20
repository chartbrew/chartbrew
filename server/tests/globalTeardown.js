import { testDbManager } from "./helpers/testDbManager.js";

export default async function globalTeardown() {
  console.log("🧹 Starting global test teardown...");

  // Stop test database container
  await testDbManager.stop();

  console.log("✅ Global test teardown completed");
}
