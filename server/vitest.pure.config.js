import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/unit/chartJsCartesianCompiler.test.js",
      "tests/unit/embeddedChartPayload.test.js",
      "tests/unit/nodemail.passwordReset.test.js",
      "tests/unit/observations.test.js",
      "tests/unit/visualizationCompilers.test.js",
    ],
    maxWorkers: 1,
    pool: "forks",
  },
});
