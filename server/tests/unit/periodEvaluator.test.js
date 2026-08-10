import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const db = require("../../models/models");
const { evaluateCompletedPeriod, thresholdPassed } = require(
  "../../modules/observations/evaluatePeriod"
);
const {
  normalizePeriodContract,
} = require("../../modules/observations/periodContract");
const {
  buildDefinitionFingerprint,
} = require("../../modules/observations/monitorSchema");
const {
  evaluateMonitorPeriod,
  persistEvaluation,
} = require("../../modules/observations/periodEvaluationService");
const {
  evaluateDuePeriods,
} = require("../../modules/observations/periodEvaluationScheduler");
const { serializeMonitor } = require("../../controllers/MonitorController");
const corpus = require("../fixtures/observation-period-corpus.json");

function scenario(id) {
  return corpus.scenarios.find((item) => item.id === id);
}

function createMonitor(periodScenario, overrides = {}) {
  const valueFormat = {
    display: { scale: periodScenario.monitor.valueScale || 1 },
    meaning: periodScenario.monitor.threshold?.type === "percentage_points"
      ? "percentage"
      : "number",
  };
  return {
    baseline_policy: {
      calendarTimezone: periodScenario.monitor.timezone,
      checkpointToleranceMinutes: 1440,
      comparison: "previous_period",
      comparisonPeriod: periodScenario.monitor.comparisonPeriod,
      periodMode: "completed",
      policyVersion: "completed-period-v1",
      settlingDelayMinutes: 360,
      type: "completed_period",
      weekStartsOn: periodScenario.monitor.weekStartsOn || 1,
    },
    definition_fingerprint: "definition-1",
    id: "monitor-1",
    metric_spec: {
      aggregate: periodScenario.monitor.behavior === "flow" ? "sum" : "none",
      metricBehavior: periodScenario.monitor.behavior,
      timeUnit: periodScenario.monitor.comparisonPeriod,
      valueFormat,
    },
    publication_policy: {
      thresholdType: periodScenario.monitor.threshold?.type,
      thresholdValue: periodScenario.monitor.threshold?.value,
    },
    team_id: 8,
    ...overrides,
  };
}

function evaluateScenario(id) {
  const periodScenario = scenario(id);
  return evaluateCompletedPeriod({
    asOf: periodScenario.now,
    confirmedAt: periodScenario.input.confirmedAt,
    monitor: createMonitor(periodScenario),
    snapshots: periodScenario.input.snapshots,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("completed period evaluator", () => {
  it("evaluates a complete monthly flow and applies its threshold", () => {
    const result = evaluateScenario("closed-month-additive-flow");

    expect(result).toEqual(expect.objectContaining({
      baselineValue: 100000,
      currentValue: 120000,
      eligible: true,
      finality: "final",
      passesThreshold: true,
      readiness: "eligible",
      sourceBucketCount: 2,
    }));
  });

  it("uses aligned checkpoints for state metrics", () => {
    const result = evaluateScenario("closed-week-state-checkpoint");

    expect(result).toEqual(expect.objectContaining({
      baselineValue: 1000,
      currentValue: 950,
      eligible: true,
      passesThreshold: false,
      sourceCheckpointCount: 2,
    }));
  });

  it("accepts one native complete value for a ratio period", () => {
    const result = evaluateScenario("native-monthly-percentage-value");

    expect(result).toEqual(expect.objectContaining({
      baselineValue: 0.1,
      currentValue: 0.12,
      eligible: true,
      passesThreshold: true,
    }));
  });

  it("evaluates a completed daily rate and ignores the open day", () => {
    expect(evaluateScenario("closed-day-failed-sync-rate")).toEqual(expect.objectContaining({
      baselineValue: 0.08,
      currentValue: 0.12,
      eligible: true,
      finality: "final",
      passesThreshold: true,
    }));
    expect(evaluateScenario("open-day-is-not-a-comparison-boundary"))
      .toEqual(expect.objectContaining({
        baselineValue: 100,
        currentValue: 90,
        eligible: true,
        sourceBucketCount: 2,
      }));
  });

  it("rejects unknown coverage and stale post-close evidence", () => {
    expect(evaluateScenario("missing-flow-bucket")).toEqual(expect.objectContaining({
      eligible: false,
      readiness: "incomplete",
      reason: "incomplete_coverage",
    }));
    expect(evaluateScenario("closed-month-without-post-close-refresh"))
      .toEqual(expect.objectContaining({
        eligible: false,
        readiness: "waiting",
        reason: "waiting_for_fresh_data",
      }));
  });

  it("validates the supported contract and calculation rules", () => {
    expect(() => normalizePeriodContract({
      calendarTimezone: "UTC",
      comparisonPeriod: "month",
      metricBehavior: "flow",
      threshold: { type: "relative", value: 0.1 },
    }, { aggregate: "avg", timeUnit: "day" })).toThrow(/sum or count/);
    expect(() => normalizePeriodContract({
      calendarTimezone: "UTC",
      comparisonPeriod: "month",
      metricBehavior: "ratio",
      threshold: { type: "percentage_points", value: 1 },
    }, { aggregate: "avg", timeUnit: "day" })).toThrow(/same period/);
    expect(() => normalizePeriodContract({
      calendarTimezone: "UTC",
      comparisonPeriod: "month",
      metricBehavior: "state",
      threshold: { type: "percentage_points", value: 1 },
    }, {
      aggregate: "none",
      timeUnit: "day",
      valueFormat: { meaning: "number" },
    })).toThrow(/percentage metric/);
    expect(() => normalizePeriodContract({
      calendarTimezone: "UTC",
      comparisonPeriod: "day",
      metricBehavior: "ratio",
      threshold: { type: "relative", value: 0.1 },
    }, {
      aggregate: "avg",
      kind: "scalar",
      timeUnit: "day",
      valueFormat: { meaning: "percentage" },
    })).toThrow(/time-series period values/);

    expect(normalizePeriodContract({
      calendarTimezone: "Asia/Bangkok",
      comparisonPeriod: "week",
      metricBehavior: "state",
      threshold: { type: "absolute", value: 5 },
      weekStartsOn: 7,
    }, { aggregate: "none", timeUnit: "day" })).toEqual(expect.objectContaining({
      metricBehavior: "state",
      publicationPolicy: { thresholdType: "absolute", thresholdValue: 5 },
    }));
    expect(normalizePeriodContract({
      calendarTimezone: "Asia/Bangkok",
      comparisonPeriod: "day",
      metricBehavior: "ratio",
      threshold: { type: "percentage_points", value: 1 },
    }, {
      aggregate: "avg",
      timeUnit: "day",
      valueFormat: { meaning: "percentage" },
    })).toEqual(expect.objectContaining({
      metricBehavior: "ratio",
      publicationPolicy: { thresholdType: "percentage_points", thresholdValue: 1 },
    }));
  });

  it("keeps threshold changes out of the definition fingerprint", () => {
    const input = {
      baselinePolicy: { comparisonPeriod: "month", type: "completed_period" },
      bindingKey: "revenue:default",
      chartId: 4,
      metricSpec: {
        aggregate: "sum",
        layerId: "revenue",
        metricBehavior: "flow",
        timeField: "date",
        timeUnit: "day",
        valueFormat: { display: { scale: 1 }, meaning: "currency" },
      },
    };

    expect(buildDefinitionFingerprint(input)).toBe(buildDefinitionFingerprint({
      ...input,
      publicationPolicy: { thresholdType: "relative", thresholdValue: 0.25 },
    }));
  });

  it("supports all three threshold types", () => {
    expect(thresholdPassed({
      baselineValue: 100,
      currentValue: 111,
      metricSpec: {},
      publicationPolicy: { thresholdType: "relative", thresholdValue: 0.1 },
    })).toBe(true);
    expect(thresholdPassed({
      baselineValue: 100,
      currentValue: 104,
      metricSpec: {},
      publicationPolicy: { thresholdType: "absolute", thresholdValue: 5 },
    })).toBe(false);
    expect(thresholdPassed({
      baselineValue: 0.1,
      currentValue: 0.12,
      metricSpec: { valueFormat: { display: { scale: 100 } } },
      publicationPolicy: { thresholdType: "percentage_points", thresholdValue: 1 },
    })).toBe(true);
  });

  it("stores a completed evaluation without publishing an observation", async () => {
    const periodScenario = scenario("closed-month-additive-flow");
    const monitor = createMonitor(periodScenario, {
      update: vi.fn().mockResolvedValue(undefined),
    });
    const snapshots = periodScenario.input.snapshots.map((snapshot, index) => ({
      ...snapshot,
      id: `snapshot-${index}`,
      result_as_of: periodScenario.input.confirmedAt,
    }));
    vi.spyOn(db.MetricSnapshot, "findAll").mockResolvedValue(snapshots);
    vi.spyOn(db.MetricEvaluation, "findOne").mockResolvedValue(null);
    const createSpy = vi.spyOn(db.MetricEvaluation, "findOrCreate")
      .mockImplementation(async ({ defaults }) => [defaults, true]);
    const observationSpy = vi.spyOn(db.Observation, "create").mockResolvedValue({});

    const result = await evaluateMonitorPeriod(monitor, {
      asOf: periodScenario.now,
      confirmedAt: periodScenario.input.confirmedAt,
    });

    expect(result.status).toBe("final");
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      defaults: expect.objectContaining({
        baseline_value: 100000,
        current_value: 120000,
        passes_threshold: true,
        revision: 1,
      }),
    }));
    expect(observationSpy).not.toHaveBeenCalled();
    expect(monitor.update).toHaveBeenCalledWith(expect.objectContaining({
      last_evaluated_period_end: new Date("2026-08-01T00:00:00.000Z"),
      status: "ready",
    }));
  });

  it("reuses the first revision when two evaluators race", async () => {
    const periodScenario = scenario("closed-month-additive-flow");
    const monitor = createMonitor(periodScenario);
    const result = evaluateScenario("closed-month-additive-flow");
    const existing = {
      baseline_value: result.baselineValue,
      completeness: result.completeness,
      current_value: result.currentValue,
      evidence: result.evidence,
      finality: result.finality,
      revision: 1,
      update: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(db.MetricEvaluation, "findOne").mockResolvedValue(null);
    const findOrCreateSpy = vi.spyOn(db.MetricEvaluation, "findOrCreate")
      .mockResolvedValue([existing, false]);

    const evaluation = await persistEvaluation(
      monitor,
      normalizePeriodContract({
        baselinePolicy: monitor.baseline_policy,
        metricBehavior: monitor.metric_spec.metricBehavior,
        publicationPolicy: monitor.publication_policy,
      }, monitor.metric_spec),
      result,
      new Date(periodScenario.now)
    );

    expect(evaluation).toBe(existing);
    expect(findOrCreateSpy).toHaveBeenCalledTimes(1);
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
      evaluated_at: new Date(periodScenario.now),
    }));
  });

  it("updates settling evidence in place and creates a bounded correction after finality", async () => {
    const periodScenario = scenario("closed-month-additive-flow");
    const monitor = createMonitor(periodScenario);
    const result = evaluateScenario("closed-month-additive-flow");
    const contract = normalizePeriodContract({
      baselinePolicy: monitor.baseline_policy,
      metricBehavior: monitor.metric_spec.metricBehavior,
      publicationPolicy: monitor.publication_policy,
    }, monitor.metric_spec);
    const settling = {
      baseline_value: result.baselineValue,
      completeness: result.completeness,
      current_value: result.currentValue - 1,
      evidence: { inputFingerprint: "old" },
      finality: "settling",
      revision: 1,
      update: vi.fn().mockImplementation(async (values) => ({ ...settling, ...values })),
    };
    vi.spyOn(db.MetricEvaluation, "findOne").mockResolvedValueOnce(settling);

    const updated = await persistEvaluation(
      monitor,
      contract,
      result,
      new Date(periodScenario.now)
    );

    expect(updated.current_value).toBe(result.currentValue);
    expect(settling.update.mock.calls[0][0]).not.toHaveProperty("revision");

    const final = {
      ...settling,
      finality: "final",
      update: vi.fn(),
    };
    vi.spyOn(db.MetricEvaluation, "findOne").mockResolvedValueOnce(final);
    const correctionSpy = vi.spyOn(db.MetricEvaluation, "findOrCreate")
      .mockImplementationOnce(async ({ defaults }) => [defaults, true]);

    const corrected = await persistEvaluation(
      monitor,
      contract,
      result,
      new Date(periodScenario.now)
    );

    expect(corrected).toEqual(expect.objectContaining({
      finality: "revised",
      revision: 2,
    }));
    expect(correctionSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ revision: 2 }),
    }));
  });

  it("returns the confirmed period contract from the monitor API", async () => {
    const periodScenario = scenario("closed-month-additive-flow");
    const monitor = createMonitor(periodScenario, {
      Chart: { name: "Revenue" },
      is_active: true,
      last_evaluated_period_end: new Date("2026-08-01T00:00:00.000Z"),
      name: "Monthly revenue",
      next_evaluation_at: new Date("2026-09-01T06:00:00.000Z"),
      status: "ready",
      status_reason: null,
    });
    vi.spyOn(db.MetricSnapshot, "count").mockResolvedValue(62);

    const serialized = await serializeMonitor(monitor);

    expect(serialized).toEqual(expect.objectContaining({
      comparison: expect.objectContaining({
        mode: "completed",
        period: "month",
        timezone: "UTC",
      }),
      lastEvaluatedPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      metricBehavior: "flow",
      nextEvaluationAt: new Date("2026-09-01T06:00:00.000Z"),
      threshold: { type: "relative", value: 0.1 },
    }));
  });

  it("runs due evaluation checks from stored monitor state", async () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const monitor = {
      baseline_policy: { type: "rolling_median" },
      id: "legacy-monitor",
      metric_spec: {},
      update: vi.fn().mockResolvedValue(undefined),
    };
    const findSpy = vi.spyOn(db.MetricMonitor, "findAll").mockResolvedValue([monitor]);

    const report = await evaluateDuePeriods(now);

    expect(report).toEqual({ evaluated: 0, failed: 0, waiting: 1 });
    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ is_active: true }),
    }));
    expect(monitor.update).toHaveBeenCalledWith(expect.objectContaining({
      next_evaluation_at: null,
      status: "review_required",
    }));
  });
});
