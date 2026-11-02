import { defineConfig } from "vitest/config";

import { databaseUnitTests } from "./vitest.test-groups.js";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      CB_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      CB_RESTRICT_SIGNUP: "0",
      CB_RESTRICT_TEAMS: "0",
      CB_SECRET: "test-secret-dev",
      VITE_APP_CLIENT_HOST: "http://localhost:3000",
    },
    exclude: databaseUnitTests,
    globals: true,
    include: ["tests/unit/**/*.test.js"],
    maxWorkers: 4,
    pool: "forks",
  },
});
