import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/unit/chartJsCartesianCompiler.test.js",
      "tests/unit/embeddedChartPayload.test.js",
      "tests/unit/echartsCompiler.test.js",
      "tests/unit/kpiReview.test.js",
      "tests/unit/nodemail.passwordReset.test.js",
      "tests/unit/observationPeriodCorpus.test.js",
      "tests/unit/observations.test.js",
      "tests/unit/periodEvaluator.test.js",
      "tests/unit/periodObservationPersistence.test.js",
      "tests/unit/platformSettings.test.js",
      "tests/unit/preparedSnapshots.test.js",
      "tests/unit/replaySynthbrewPeriods.test.js",
      "tests/unit/scheduleWeekdays.test.js",
      "tests/unit/visualizationCompilers.test.js",
      "tests/unit/visualizationPreparedData.test.js",
    ],
    maxWorkers: 1,
    pool: "forks",
  },
});
