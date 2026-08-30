import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.js";
import { databaseTests } from "./vitest.test-groups.js";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: databaseTests,
    maxWorkers: 1,
  },
});
