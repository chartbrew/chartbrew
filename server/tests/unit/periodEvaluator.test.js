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
const {
  getEvaluationDeduplicationKey,
  publishMetricEvaluation,
} = require("../../modules/observations/publishEvaluation");
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
      desiredDirection: "higher",
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

function createFinalEvaluation(overrides = {}) {
  return {
    absolute_delta: 20,
    baseline_value: 100,
    calendar_timezone: "UTC",
    comparison_period: "month",
    comparison_period_end: new Date("2026-07-01T00:00:00.000Z"),
    comparison_period_start: new Date("2026-06-01T00:00:00.000Z"),
    corrected_at: null,
    current_period_end: new Date("2026-08-01T00:00:00.000Z"),
    current_period_start: new Date("2026-07-01T00:00:00.000Z"),
    current_value: 120,
    evaluated_at: new Date("2026-08-01T06:00:00.000Z"),
    evaluation_key: "july-vs-june",
    finality: "final",
    finalized_at: new Date("2026-08-01T06:00:00.000Z"),
    id: "evaluation-1",
    passes_threshold: true,
    policy_version: "completed-period-v1",
    publication_threshold_type: "relative",
    publication_threshold_value: 0.1,
    relative_delta: 0.2,
    revision: 1,
    source_bucket_count: 61,
    source_checkpoint_count: 0,
    completeness: 1,
    ...overrides,
  };
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

  it("uses the completed bucket at a boundary for a daily state series", () => {
    const periodScenario = scenario("closed-day-failed-sync-rate");
    const monitor = createMonitor(periodScenario, {
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
      kind: "timeseries",
      metric_spec: {
        aggregate: "sum",
        desiredDirection: "higher",
        metricBehavior: "state",
        timeUnit: "day",
        valueFormat: { display: { scale: 1 }, meaning: "number" },
      },
      publication_policy: {
        thresholdType: "absolute",
        thresholdValue: 1,
      },
    });
    const result = evaluateCompletedPeriod({
      asOf: "2026-08-03T12:00:00.000Z",
      confirmedAt: "2026-08-03T06:00:00.000Z",
      monitor,
      snapshots: [{
        completeness: 1,
        coverage: "complete",
        periodStart: "2026-08-01T00:00:00.000Z",
        periodEnd: "2026-08-02T00:00:00.000Z",
        value: 8,
      }, {
        completeness: 1,
        coverage: "complete",
        periodStart: "2026-08-02T00:00:00.000Z",
        periodEnd: "2026-08-03T00:00:00.000Z",
        value: 9,
      }],
    });

    expect(result).toEqual(expect.objectContaining({
      baselineValue: 8,
      currentValue: 9,
      eligible: true,
      passesThreshold: true,
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

  it("accepts an explicit zero bucket but rejects a missing bucket", () => {
    const periodScenario = scenario("closed-month-additive-flow");
    const monitor = createMonitor(periodScenario);
    const common = {
      completeness: 1,
      coverage: "complete",
    };
    const explicitZero = evaluateCompletedPeriod({
      asOf: periodScenario.now,
      confirmedAt: periodScenario.input.confirmedAt,
      monitor,
      snapshots: [
        {
          ...common,
          periodStart: "2026-06-01T00:00:00.000Z",
          periodEnd: "2026-07-01T00:00:00.000Z",
          value: 100,
        },
        {
          ...common,
          periodStart: "2026-07-01T00:00:00.000Z",
          periodEnd: "2026-07-16T00:00:00.000Z",
          value: 120,
        },
        {
          ...common,
          periodStart: "2026-07-16T00:00:00.000Z",
          periodEnd: "2026-07-17T00:00:00.000Z",
          value: 0,
        },
        {
          ...common,
          periodStart: "2026-07-17T00:00:00.000Z",
          periodEnd: "2026-08-01T00:00:00.000Z",
          value: 80,
        },
      ],
    });
    const missingBucket = evaluateCompletedPeriod({
      asOf: periodScenario.now,
      confirmedAt: periodScenario.input.confirmedAt,
      monitor,
      snapshots: [
        {
          ...common,
          periodStart: "2026-06-01T00:00:00.000Z",
          periodEnd: "2026-07-01T00:00:00.000Z",
          value: 100,
        },
        {
          ...common,
          periodStart: "2026-07-01T00:00:00.000Z",
          periodEnd: "2026-07-16T00:00:00.000Z",
          value: 120,
        },
        {
          ...common,
          periodStart: "2026-07-17T00:00:00.000Z",
          periodEnd: "2026-08-01T00:00:00.000Z",
          value: 80,
        },
      ],
    });

    expect(explicitZero).toEqual(expect.objectContaining({
      currentValue: 200,
      eligible: true,
    }));
    expect(missingBucket).toEqual(expect.objectContaining({
      eligible: false,
      reason: "incomplete_coverage",
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

  it("publishes one observation from a final threshold-passing evaluation", async () => {
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
      .mockImplementation(async ({ defaults }) => [{ ...defaults, id: "evaluation-1" }, true]);
    vi.spyOn(db.Observation, "findOne").mockResolvedValue(null);
    vi.spyOn(db.Observation, "update").mockResolvedValue([0]);
    const observationSpy = vi.spyOn(db.Observation, "create")
      .mockImplementation(async (values) => ({ ...values, id: "observation-1" }));

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
    expect(observationSpy).toHaveBeenCalledWith(expect.objectContaining({
      metric_evaluation_id: "evaluation-1",
      monitor_id: "monitor-1",
    }));
    expect(result.publication).toEqual(expect.objectContaining({
      status: "published",
    }));
    expect(monitor.update).toHaveBeenCalledWith(expect.objectContaining({
      last_evaluated_period_end: new Date("2026-08-01T00:00:00.000Z"),
      status: "ready",
    }));
  });

  it("does not query or publish observations for a settling evaluation", async () => {
    const monitor = createMonitor(scenario("closed-month-additive-flow"));
    const findSpy = vi.spyOn(db.Observation, "findOne");
    const createSpy = vi.spyOn(db.Observation, "create");

    const publication = await publishMetricEvaluation(monitor, createFinalEvaluation({
      finality: "settling",
      finalized_at: null,
    }));

    expect(publication).toEqual({ status: "not_final" });
    expect(findSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("keeps a final below-threshold evaluation out of Activity", async () => {
    const monitor = createMonitor(scenario("closed-month-additive-flow"));
    vi.spyOn(db.Observation, "findOne").mockResolvedValue(null);
    const resolveSpy = vi.spyOn(db.Observation, "update").mockResolvedValue([0]);
    const createSpy = vi.spyOn(db.Observation, "create");

    const publication = await publishMetricEvaluation(monitor, createFinalEvaluation({
      absolute_delta: 5,
      current_value: 105,
      passes_threshold: false,
      relative_delta: 0.05,
    }));

    expect(publication).toEqual({ observation: null, status: "below_threshold" });
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).not.toHaveBeenCalled();
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

  it("uses the evaluation window as observation identity and does not publish it twice", async () => {
    const monitor = createMonitor(scenario("closed-month-additive-flow"), {
      chart_id: 4,
      dataset_id: 7,
      name: "Revenue",
      project_id: 3,
    });
    const evaluation = createFinalEvaluation();
    const deduplicationKey = getEvaluationDeduplicationKey(monitor, evaluation);
    const existing = {
      deduplication_key: deduplicationKey,
      evidence_revision: 1,
      metric_evaluation_id: evaluation.id,
      status: "open",
      update: vi.fn(),
    };
    vi.spyOn(db.Observation, "findOne").mockResolvedValue(existing);
    vi.spyOn(db.Observation, "update").mockResolvedValue([0]);
    const createSpy = vi.spyOn(db.Observation, "create").mockResolvedValue({});

    const publication = await publishMetricEvaluation(monitor, evaluation);

    expect(publication).toEqual({ observation: existing, status: "unchanged" });
    expect(existing.update).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("updates the same observation for a corrected evaluation revision", async () => {
    const monitor = createMonitor(scenario("closed-month-additive-flow"), {
      name: "Revenue",
    });
    const evaluation = createFinalEvaluation({
      absolute_delta: 28,
      corrected_at: new Date("2026-08-05T06:00:00.000Z"),
      current_value: 128,
      finality: "revised",
      id: "evaluation-2",
      relative_delta: 0.28,
      revision: 2,
    });
    const existing = {
      evidence_revision: 1,
      metric_evaluation_id: "evaluation-1",
      status: "open",
      update: vi.fn().mockImplementation(async (values) => ({ ...existing, ...values })),
    };
    vi.spyOn(db.Observation, "findOne").mockResolvedValue(existing);
    vi.spyOn(db.Observation, "update").mockResolvedValue([0]);

    const publication = await publishMetricEvaluation(monitor, evaluation);

    expect(publication.status).toBe("corrected");
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
      evidence_revision: 2,
      metric_evaluation_id: "evaluation-2",
      status: "open",
    }));
  });

  it("keeps unhealthy attention open below threshold and resolves it after healthy movement", async () => {
    const monitor = createMonitor(scenario("closed-month-additive-flow"), {
      name: "Revenue",
    });
    vi.spyOn(db.Observation, "findOne").mockResolvedValue(null);
    const resolveSpy = vi.spyOn(db.Observation, "update").mockResolvedValue([1]);

    const unhealthy = await publishMetricEvaluation(monitor, createFinalEvaluation({
      absolute_delta: -5,
      current_value: 95,
      evaluation_key: "august-vs-july",
      id: "evaluation-3",
      passes_threshold: false,
      relative_delta: -0.05,
    }));
    expect(unhealthy.status).toBe("below_threshold");
    expect(resolveSpy).not.toHaveBeenCalled();

    const healthy = await publishMetricEvaluation(monitor, createFinalEvaluation({
      absolute_delta: 5,
      current_value: 105,
      evaluation_key: "september-vs-august",
      id: "evaluation-4",
      passes_threshold: false,
      relative_delta: 0.05,
    }));
    expect(healthy.status).toBe("below_threshold");
    expect(resolveSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: "resolved",
    }), expect.objectContaining({
      where: expect.objectContaining({ monitor_id: "monitor-1", status: "open" }),
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

    expect(report).toEqual({ evaluated: 0, failed: 0, published: 0, waiting: 1 });
    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ is_active: true }),
    }));
    expect(monitor.update).toHaveBeenCalledWith(expect.objectContaining({
      next_evaluation_at: null,
      status: "review_required",
    }));
  });
});
