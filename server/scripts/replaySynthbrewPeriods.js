const path = require("path");

const { evaluateCompletedPeriod } = require("../modules/observations/evaluatePeriod");
const {
  getObservationImpact,
  normalizeDesiredDirection,
} = require("../modules/observations/metricDirection");

const AS_OF = "2026-08-03T12:00:00.000Z";
const CONFIRMED_AT = "2026-08-03T06:00:00.000Z";
const COMPARISON_START = "2026-08-01T00:00:00.000Z";
const CURRENT_START = "2026-08-02T00:00:00.000Z";
const CURRENT_END = "2026-08-03T00:00:00.000Z";

const BASE_VALUES = {
  activeAccounts: 8,
  failedSyncRate: 0.1,
  newTrials: 10,
  recordsProcessed: 100,
  revenue: 100,
  trialConversion: 0.5,
};

const CURRENT_OVERRIDES = {
  1: { trialConversion: 0.3 },
  2: { trialConversion: 0.2 },
  3: { revenue: 70 },
  4: { revenue: 55 },
  5: { failedSyncRate: 0.4, recordsProcessed: 50 },
  6: { newTrials: 14, revenue: 130 },
  7: {
    failedSyncRate: 0.4,
    recordsProcessed: 60,
    revenue: 130,
    trialConversion: 0.3,
  },
  8: { newTrials: 10.5, recordsProcessed: 95, revenue: 95 },
};

function getDefaultLabPath() {
  return path.resolve(__dirname, "..", "..", "..", "chartbrew-watched-metrics-lab");
}

function parseArguments(args) {
  const scenario = args.find((value) => !value.startsWith("--")) || "all";
  const labPathOption = args.find((value) => value.startsWith("--lab-path="));
  return {
    json: args.includes("--json"),
    labPath: path.resolve(
      labPathOption?.slice("--lab-path=".length)
        || process.env.CB_WATCHED_METRICS_LAB_PATH
        || getDefaultLabPath()
    ),
    scenario,
  };
}

function loadLab(labPath) {
  const catalogPath = path.join(labPath, "scenarioCatalog.js");
  const dashboardPath = path.join(labPath, "dashboardDefinition.js");
  try {
    return {
      ...require(catalogPath), // eslint-disable-line global-require, import/no-dynamic-require
      ...require(dashboardPath), // eslint-disable-line global-require, import/no-dynamic-require
    };
  } catch (error) {
    throw new Error(`Could not load the watched metrics lab at ${labPath}: ${error.message}`);
  }
}

function getMetricBehavior(metric) {
  if (metric.key === "activeAccounts") return "state";
  if (metric.aggregate === "avg") return "ratio";
  return "flow";
}

function getThreshold(metric) {
  if (metric.formula?.includes("%")) {
    return { type: "percentage_points", value: 10 };
  }
  return { type: "relative", value: 0.1 };
}

function createMonitor(metric) {
  const metricBehavior = getMetricBehavior(metric);
  const threshold = getThreshold(metric);
  return {
    baseline_policy: {
      calendarTimezone: "UTC",
      checkpointToleranceMinutes: 360,
      comparison: "previous_period",
      comparisonPeriod: "day",
      periodMode: "completed",
      policyVersion: "completed-period-v1",
      settlingDelayMinutes: 0,
      type: "completed_period",
      weekStartsOn: 1,
    },
    definition_fingerprint: `synthbrew-${metric.key}-daily-v1`,
    id: `synthbrew-${metric.key}`,
    kind: "timeseries",
    metric_spec: {
      aggregate: metric.aggregate,
      desiredDirection: normalizeDesiredDirection(metric.desiredDirection),
      metricBehavior,
      timeUnit: "day",
      valueFormat: metric.formula?.includes("%")
        ? { display: { scale: 100 }, meaning: "percentage" }
        : { display: { scale: 1 }, meaning: "number" },
    },
    publication_policy: {
      thresholdType: threshold.type,
      thresholdValue: threshold.value,
    },
  };
}

function getScenarioValues(scenario, metric) {
  const comparisonValue = scenario.code === 12 && metric.key === "recordsProcessed"
    ? 0
    : BASE_VALUES[metric.key];
  return {
    comparisonValue,
    currentValue: CURRENT_OVERRIDES[scenario.code]?.[metric.key] ?? BASE_VALUES[metric.key],
  };
}

function createSnapshots(scenario, metric) {
  if (scenario.code === 10) return [];
  if (scenario.code === 9 && metric.key === "failedSyncRate") return [];
  const values = getScenarioValues(scenario, metric);
  const current = {
    completeness: 1,
    coverage: "complete",
    periodEnd: CURRENT_END,
    periodStart: CURRENT_START,
    resultAsOf: CONFIRMED_AT,
    value: values.currentValue,
  };
  if (scenario.code === 11) return [current];
  return [{
    completeness: 1,
    coverage: "complete",
    periodEnd: CURRENT_START,
    periodStart: COMPARISON_START,
    resultAsOf: CONFIRMED_AT,
    value: values.comparisonValue,
  }, current];
}

function getDirection(result) {
  if (!result.eligible || !result.passesThreshold) return null;
  if (result.absoluteDelta > 0) return "increase";
  if (result.absoluteDelta < 0) return "decrease";
  return null;
}

function replayMetric(scenario, metric) {
  const monitor = createMonitor(metric);
  const evaluation = evaluateCompletedPeriod({
    asOf: AS_OF,
    confirmedAt: CONFIRMED_AT,
    monitor,
    snapshots: createSnapshots(scenario, metric),
  });
  const direction = getDirection(evaluation);
  return {
    direction,
    eligible: evaluation.eligible,
    impact: direction
      ? getObservationImpact(monitor.metric_spec.desiredDirection, direction)
      : null,
    key: metric.key,
    passesThreshold: Boolean(evaluation.passesThreshold),
    reason: evaluation.reason || null,
  };
}

function replayScenario(scenario, metrics) {
  const results = metrics.map((metric) => replayMetric(scenario, metric));
  const failures = [];
  results.forEach((result) => {
    const expected = scenario.expected[result.key];
    const expectsWaiting = Boolean(
      scenario.expectedDefaultStatus || scenario.expectedStatus?.[result.key]
    );
    if (expected && (result.direction !== expected.direction || result.impact !== expected.impact)) {
      failures.push(`${result.key} was ${result.direction || result.reason}; expected ${expected.direction}`);
    } else if (!expected && result.direction) {
      failures.push(`${result.key} produced an unexpected ${result.direction}`);
    }
    if (expectsWaiting && result.eligible) {
      failures.push(`${result.key} produced a result but should wait for data`);
    } else if (!expectsWaiting && !result.eligible) {
      failures.push(`${result.key} was ${result.reason}; expected a complete result`);
    }
  });
  return {
    description: scenario.description,
    failures,
    name: scenario.name,
    passed: failures.length === 0,
    results,
  };
}

function formatReport(report) {
  const lines = [
    "Synthbrew completed-day replay",
    `${report.passedScenarios}/${report.scenarioCount} scenarios passed · ${report.metricCount} metric checks`,
  ];
  report.scenarios.filter((scenario) => !scenario.passed).forEach((scenario) => {
    lines.push("", `${scenario.name}:`);
    scenario.failures.forEach((failure) => lines.push(`- ${failure}`));
  });
  return lines.join("\n");
}

function run(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  const { METRICS, SCENARIOS, getScenario } = loadLab(options.labPath);
  const scenarios = options.scenario === "all"
    ? Object.entries(SCENARIOS).map(([name, scenario]) => ({ name, ...scenario }))
    : [getScenario(options.scenario)];
  const scenarioResults = scenarios.map((scenario) => replayScenario(scenario, METRICS));
  const report = {
    labPath: options.labPath,
    metricCount: scenarioResults.length * METRICS.length,
    passed: scenarioResults.every((scenario) => scenario.passed),
    passedScenarios: scenarioResults.filter((scenario) => scenario.passed).length,
    scenarioCount: scenarioResults.length,
    scenarios: scenarioResults,
  };
  process.stdout.write(`${options.json ? JSON.stringify(report, null, 2) : formatReport(report)}\n`);
  if (!report.passed) process.exitCode = 1;
  return report;
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  createMonitor,
  createSnapshots,
  formatReport,
  parseArguments,
  replayScenario,
  run,
};
