import {
  describe, expect, it,
} from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createMonitor,
  createSnapshots,
  replayScenario,
} = require("../../scripts/replaySynthbrewPeriods");

const METRICS = [
  {
    aggregate: "sum",
    comparisonPeriod: "month",
    desiredDirection: "higher",
    key: "revenue",
    metricBehavior: "flow",
    timeUnit: "day",
  },
  {
    aggregate: "avg",
    comparisonPeriod: "week",
    desiredDirection: "higher",
    formula: "{val * 100}%",
    key: "trialConversion",
    metricBehavior: "ratio",
    timeUnit: "week",
  },
  {
    aggregate: "sum",
    comparisonPeriod: "week",
    desiredDirection: "higher",
    key: "newTrials",
    metricBehavior: "flow",
    timeUnit: "day",
  },
  {
    aggregate: "sum",
    comparisonPeriod: "month",
    desiredDirection: "higher",
    key: "activeAccounts",
    metricBehavior: "state",
    timeUnit: "day",
  },
  {
    aggregate: "avg",
    comparisonPeriod: "day",
    desiredDirection: "lower",
    formula: "{val * 100}%",
    key: "failedSyncRate",
    metricBehavior: "ratio",
    timeUnit: "day",
  },
  {
    aggregate: "sum",
    comparisonPeriod: "day",
    desiredDirection: "higher",
    key: "recordsProcessed",
    metricBehavior: "flow",
    timeUnit: "day",
  },
];

const BASELINE = { code: 0, expected: {}, name: "baseline" };

describe("Synthbrew completed-period replay", () => {
  it("creates daily, weekly, and monthly monitor contracts", () => {
    const contracts = METRICS.map((metric) => {
      const monitor = createMonitor(metric);
      return [
        metric.key,
        monitor.baseline_policy.comparisonPeriod,
        monitor.metric_spec.metricBehavior,
        monitor.metric_spec.timeUnit,
      ];
    });

    expect(contracts).toEqual([
      ["revenue", "month", "flow", "day"],
      ["trialConversion", "week", "ratio", "week"],
      ["newTrials", "week", "flow", "day"],
      ["activeAccounts", "month", "state", "day"],
      ["failedSyncRate", "day", "ratio", "day"],
      ["recordsProcessed", "day", "flow", "day"],
    ]);
  });

  it("builds native periods, additive daily buckets, and state checkpoints", () => {
    const snapshotCounts = Object.fromEntries(METRICS.map((metric) => [
      metric.key,
      createSnapshots(BASELINE, metric).length,
    ]));

    expect(snapshotCounts).toEqual({
      activeAccounts: 2,
      failedSyncRate: 2,
      newTrials: 14,
      recordsProcessed: 2,
      revenue: 61,
      trialConversion: 2,
    });

    const revenueTotal = createSnapshots(BASELINE, METRICS[0])
      .reduce((total, snapshot) => total + snapshot.value, 0);
    expect(revenueTotal).toBeCloseTo(6000);
  });

  it("replays one update with results from all three comparison periods", () => {
    const scenario = {
      code: 7,
      expected: {
        activeAccounts: { direction: "increase", impact: "positive" },
        failedSyncRate: { direction: "increase", impact: "negative" },
        newTrials: { direction: "increase", impact: "positive" },
        recordsProcessed: { direction: "decrease", impact: "negative" },
        revenue: { direction: "increase", impact: "positive" },
        trialConversion: { direction: "decrease", impact: "negative" },
      },
      name: "mixed-period",
    };
    const replay = replayScenario(scenario, METRICS);

    expect(replay.passed).toBe(true);
    expect(new Set(replay.results.map((result) => result.period)))
      .toEqual(new Set(["day", "month", "week"]));
  });
});
