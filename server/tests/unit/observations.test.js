import {
  describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { calculateBaseline, median } = require("../../modules/observations/baseline");
const { extractMonitorSnapshots } = require("../../modules/observations/extractMetrics");
const { analyzeDimension } = require("../../modules/observations/driverAnalysis");
const {
  buildDatasetRecordCountDefinition,
  buildMonitorDefinition,
  getMinimumSamples,
} = require("../../modules/observations/monitorSchema");
const { formatObservationText } = require("../../modules/observations/formatObservation");
const {
  inferChartValueFormat,
  normalizeValueFormat,
} = require("../../modules/observations/valueFormat");
const {
  buildAuditEvidence,
  deterministicSample,
  validateAuditVerdict,
} = require("../../modules/observations/llmAudit");
const {
  groupRawSnapshots,
  normalizeRetentionOptions,
  utcDayRange,
} = require("../../modules/observations/retention");
const { scoreCandidate } = require("../../modules/observations/scoreCandidate");
const { replayCorpus } = require("../../modules/observations/policyReplay");
const {
  getNextDigestDelivery,
  isDigestDue,
} = require("../../modules/observations/digestSchedule");
const { getObservationImpact } = require("../../modules/observations/metricDirection");
const { buildCalibrationReport } = require("../../modules/observations/calibrationReport");
const {
  getHealthRunType,
  partitionRunHealth,
  prioritizeHomeAttention,
  rankObservations,
} = require("../../controllers/HomeController");
const ObservationController = require("../../controllers/ObservationController");
const {
  getIncludes: getObservationIncludes,
  serializeFeedback,
} = require("../../controllers/ObservationController");
const db = require("../../models/models");
const {
  countDatasetRecords,
  persistSnapshots,
  publishObservation,
} = require("../../modules/observations/processChartResult");
const {
  getSafeViewerFields,
  projectRows,
} = require("../../modules/ai/orchestrator/tools/runExistingDataset");
const { DateTime } = require("luxon");
const replayCorpusFixture = require("../fixtures/observation-replay-corpus.json");

function createMonitor(overrides = {}) {
  return {
    id: "monitor-1",
    importance: 1,
    kind: "timeseries",
    metric_spec: {
      layerId: "revenue",
      timeUnit: "day",
      unit: "number",
    },
    minimum_samples: 2,
    ...overrides,
  };
}

describe("workspace observations", () => {
  it("builds a reproducible monitor definition from an explicit chart layer", () => {
    const definition = buildMonitorDefinition({
      chart: {
        id: 4,
        name: "Revenue",
        timeInterval: "day",
        visualization: {
          version: 2,
          layers: [{
            id: "revenue",
            bindingId: "12",
            mark: "line",
            encoding: {
              time: { field: "root[].date", type: "temporal" },
              value: {
                aggregate: "sum",
                field: "root[].amount",
                title: "Revenue",
                type: "quantitative",
              },
            },
          }],
        },
      },
      desiredDirection: "higher",
      layerId: "revenue",
      unit: "currency_usd",
    });

    expect(definition.kind).toBe("timeseries");
    expect(definition.metricSpec.desiredDirection).toBe("higher");
    expect(definition.metricSpec.metricTitle).toBe("Revenue");
    expect(definition.definitionFingerprint).toHaveLength(64);
  });

  it("builds a dataset record-count monitor without requiring a chart", () => {
    const definition = buildDatasetRecordCountDefinition({
      dataset: { id: 9, name: "Orders" },
      desiredDirection: "higher",
    });

    expect(definition.kind).toBe("record_count");
    expect(definition.bindingKey).toBe("dataset-record-count");
    expect(definition.metricSpec).toMatchObject({
      aggregate: "count",
      desiredDirection: "higher",
      metricTitle: "Orders records",
      unit: "number",
    });
    expect(definition.definitionFingerprint).toHaveLength(64);
  });

  it("counts top-level and simply wrapped dataset records", () => {
    expect(countDatasetRecords([{ id: 1 }, { id: 2 }])).toBe(2);
    expect(countDatasetRecords({ results: [{ id: 1 }, { id: 2 }, { id: 3 }] })).toBe(3);
    expect(countDatasetRecords({ id: 1, name: "Single record" })).toBe(1);
    expect(countDatasetRecords(null)).toBe(0);
  });

  it("uses the healthy direction to distinguish useful movement from regressions", () => {
    expect(getObservationImpact("higher", "increase")).toBe("positive");
    expect(getObservationImpact("higher", "decrease")).toBe("negative");
    expect(getObservationImpact("lower", "increase")).toBe("negative");
    expect(getObservationImpact("lower", "decrease")).toBe("positive");
    expect(getObservationImpact("neutral", "increase")).toBe("neutral");
  });

  it("prioritizes harmful changes on Home before positive movement", () => {
    const changes = [{
      impact: "positive",
      lastDetectedAt: "2026-08-03T10:00:00.000Z",
      monitor: { importance: 3 },
      severity: "critical",
    }, {
      impact: "negative",
      lastDetectedAt: "2026-08-03T09:00:00.000Z",
      monitor: { importance: 1 },
      severity: "medium",
    }];

    expect(changes.sort(rankObservations)[0].impact).toBe("negative");
  });

  it("reserves one Home attention slot for data health", () => {
    const changes = Array.from({ length: 4 }, (_, index) => ({
      impact: index === 3 ? "positive" : "negative",
      lastDetectedAt: new Date(Date.UTC(2026, 7, 4, index)).toISOString(),
      monitor: { importance: 1 },
      severity: index === 0 ? "critical" : "medium",
    }));
    const attention = prioritizeHomeAttention(changes, 2);

    expect(attention.showDataHealth).toBe(true);
    expect(attention.observations).toHaveLength(2);
    expect(attention.observations[0].severity).toBe("critical");
  });

  it("separates current data-health failures from recovered history", () => {
    const failedConnection = {
      Connection: { id: 7, name: "Production database" },
      connectionId: 7,
      errorStage: "connection",
      id: 11,
      startedAt: "2026-08-04T08:00:00.000Z",
      status: "failed",
    };
    const recoveredRequest = {
      chartId: 4,
      connectionId: 7,
      id: 12,
      startedAt: "2026-08-04T09:00:00.000Z",
      status: "success",
    };
    const failedDataset = {
      Dataset: { id: 8, name: "Revenue records" },
      datasetId: 8,
      id: 13,
      startedAt: "2026-08-04T10:00:00.000Z",
      status: "failed",
    };
    const health = partitionRunHealth([failedConnection, recoveredRequest, failedDataset]);

    expect(getHealthRunType(failedConnection)).toBe("connection");
    expect(health.resolved).toHaveLength(1);
    expect(health.resolved[0]).toMatchObject({ status: "resolved", type: "connection" });
    expect(health.active).toHaveLength(1);
    expect(health.active[0]).toMatchObject({ status: "active", type: "dataset" });
  });

  it("replays saved cases without publishing or changing the current policy", () => {
    const referencePolicy = {
      minimumPercentagePointChange: 1,
      minimumRelativeChange: 0.1,
      publishScore: 0.75,
      scoringVersion: "deterministic-v1",
    };
    const unchanged = replayCorpus(replayCorpusFixture, referencePolicy, referencePolicy);
    const tuned = replayCorpus(replayCorpusFixture, referencePolicy, {
      ...referencePolicy,
      publishScore: 0.4,
    });

    expect(unchanged.summary.expectedMatches).toBe(5);
    expect(unchanged.summary.decisionsChanged).toBe(0);
    expect(tuned.summary.decisionsChanged).toBe(1);
    expect(tuned.summary.falsePositives).toBe(1);
  });

  it("orders resolved Activity history by when each change ended", async () => {
    const findSpy = vi.spyOn(db.Observation, "findAll").mockResolvedValue([]);

    await new ObservationController().list({
      allProjects: true,
      projectIds: [],
      teamId: 1,
      userId: 2,
    }, { status: "resolved" });

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      order: [["resolved_at", "DESC"], ["id", "ASC"]],
      where: expect.objectContaining({ status: "resolved" }),
    }));
    findSpy.mockRestore();
  });

  it("returns only the current user's observation feedback", () => {
    const feedbackInclude = getObservationIncludes(42).find(
      (include) => include.model === db.ObservationFeedback
    );

    expect(feedbackInclude).toMatchObject({
      attributes: ["reason_code", "verdict"],
      required: false,
      where: { user_id: 42 },
    });
    expect(serializeFeedback(null)).toBeNull();
    expect(serializeFeedback({ reason_code: "too_small", verdict: "not_relevant" }))
      .toEqual({ reasonCode: "too_small", verdict: "not_relevant" });
  });

  it("lets a user revise previously saved observation feedback", async () => {
    const controller = new ObservationController();
    const savedFeedback = {
      reason_code: null,
      update: vi.fn(function update(values) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
      verdict: "relevant",
    };
    vi.spyOn(controller, "findById").mockResolvedValue({});
    const findSpy = vi.spyOn(db.ObservationFeedback, "findOrCreate")
      .mockResolvedValue([savedFeedback, false]);

    const result = await controller.feedback({ userId: 42 }, "observation-1", {
      reasonCode: "expected_change",
      verdict: "not_relevant",
    });

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
      where: { observation_id: "observation-1", user_id: 42 },
    }));
    expect(savedFeedback.update).toHaveBeenCalledWith({
      reason_code: "expected_change",
      verdict: "not_relevant",
    });
    expect(result).toEqual({
      reasonCode: "expected_change",
      verdict: "not_relevant",
    });
    findSpy.mockRestore();
  });

  it("rejects ambiguous breakdown charts", () => {
    expect(() => buildMonitorDefinition({
      chart: {
        id: 4,
        visualization: {
          version: 2,
          layers: [{
            id: "revenue",
            mark: "line",
            encoding: {
              breakdown: { field: "root[].plan", type: "nominal" },
              time: { field: "root[].date", type: "temporal" },
              value: { field: "root[].amount", type: "quantitative" },
            },
          }],
        },
      },
      layerId: "revenue",
    })).toThrow("breakdowns");
  });

  it("inherits currency and percentage meaning from chart value formulas", () => {
    expect(inferChartValueFormat("${val / 100}")).toMatchObject({
      currency: "USD",
      mode: "chart",
      scale: 0.01,
      type: "currency",
    });
    expect(inferChartValueFormat("{val * 100}%")).toMatchObject({
      mode: "chart",
      scale: 100,
      type: "percentage",
    });
  });

  it("validates explicit percentage storage and reports absolute movement in points", () => {
    const valueFormat = normalizeValueFormat({
      mode: "override",
      scale: 100,
      type: "percentage",
    });
    const text = formatObservationText({
      metric_spec: {
        unit: "percent_ratio",
        valueFormat,
      },
      name: "Conversion",
    }, {
      absoluteDelta: -0.022,
      baselineValue: 0.124,
      currentValue: 0.102,
      direction: "decrease",
      relativeDelta: -0.1774,
    });

    expect(text.summary).toContain("12.4% to 10.2%");
    expect(text.summary).toContain("2.2 percentage points");
    expect(() => normalizeValueFormat({
      mode: "override",
      scale: 10,
      type: "percentage",
    })).toThrow("percentage values");
  });

  it("treats an explicit count KPI as a database record monitor", () => {
    const definition = buildMonitorDefinition({
      chart: {
        id: 9,
        name: "Customers",
        visualization: {
          version: 2,
          layers: [{
            id: "customers",
            mark: "kpi",
            encoding: {
              value: {
                aggregate: "count",
                field: "root[].id",
                title: "Customer records",
                type: "quantitative",
              },
            },
          }],
        },
      },
      layerId: "customers",
    });

    expect(definition.kind).toBe("record_count");
    expect(definition.baselinePolicy.type).toBe("rolling_median");
    expect(getMinimumSamples(definition.kind, 7)).toBe(7);
    expect(getMinimumSamples("timeseries", 7)).toBe(2);
  });

  it("extracts compact timeseries snapshots from the renderer-neutral frame", () => {
    const extraction = extractMonitorSnapshots(createMonitor(), {
      layers: [{
        fields: {
          time: { field: "date" },
          value: { field: "amount" },
        },
        id: "revenue",
        mark: "line",
        rows: [
          { time: Date.UTC(2026, 6, 27), value: 100 },
          { time: Date.UTC(2026, 6, 28), value: 82 },
        ],
        warnings: [],
      }],
    });

    expect(extraction.status).toBe("ready");
    expect(extraction.snapshots.map((snapshot) => snapshot.value)).toEqual([100, 82]);
    expect(extraction.snapshots[0].periodStart).toEqual(new Date("2026-07-27T00:00:00.000Z"));
  });

  it("calculates previous-period baseline and publishes a material deterministic change", () => {
    const monitor = createMonitor();
    const baseline = calculateBaseline([
      {
        completeness: 1,
        periodEnd: new Date("2026-07-28T00:00:00.000Z"),
        periodStart: new Date("2026-07-27T00:00:00.000Z"),
        value: 100,
      },
      {
        completeness: 1,
        periodEnd: new Date("2026-07-29T00:00:00.000Z"),
        periodStart: new Date("2026-07-28T00:00:00.000Z"),
        value: 82,
      },
    ], monitor);
    const candidate = scoreCandidate(baseline, monitor, {
      minimumRelativeChange: 0.1,
      publishScore: 0.75,
    });

    expect(candidate.publish).toBe(true);
    expect(candidate.direction).toBe("decrease");
    expect(candidate.relativeDelta).toBeCloseTo(-0.18);
  });

  it("suppresses a large relative rate change when the absolute movement is under one point", () => {
    const monitor = createMonitor({
      metric_spec: {
        layerId: "failure-rate",
        unit: "percent_ratio",
        valueFormat: { mode: "override", scale: 100, type: "percentage" },
      },
    });
    const candidate = scoreCandidate({
      baseline: 0.01,
      comparison: { completeness: 1 },
      current: { completeness: 1, value: 0.019 },
      eligible: true,
      historyValues: [0.01],
      sampleCount: 2,
    }, monitor, {
      minimumPercentagePointChange: 1,
      minimumRelativeChange: 0.1,
      publishScore: 0.75,
    });

    expect(candidate.relativeDelta).toBeCloseTo(0.9);
    expect(candidate.features.percentagePointMagnitude).toBeCloseTo(0.9);
    expect(candidate.publish).toBe(false);
    expect(candidate.reason).toBe("below_absolute_threshold");
  });

  it("does not treat an unchanged timeseries refresh as new evidence", async () => {
    const record = {
      completeness: 1,
      sample_count: 1,
      update: vi.fn().mockResolvedValue(undefined),
      update_run_id: null,
      value: 100,
    };
    const findSpy = vi.spyOn(db.MetricSnapshot, "findOrCreate")
      .mockResolvedValue([record, false]);
    const result = await persistSnapshots(createMonitor({
      definition_fingerprint: "definition",
      team_id: 1,
    }), [{
      completeness: 1,
      granularity: "day",
      periodEnd: new Date("2026-08-02T00:00:00.000Z"),
      periodStart: new Date("2026-08-01T00:00:00.000Z"),
      sampleCount: 1,
      value: 100,
    }], "run-2");

    expect(result).toEqual({ changed: false, createdCount: 0 });
    expect(record.update).toHaveBeenCalled();
    findSpy.mockRestore();
  });

  it("reopens the same resolved incident when its deterministic window recurs", async () => {
    const existing = {
      deduplication_key: "same-incident",
      evidence_revision: 2,
      update: vi.fn().mockResolvedValue({ id: "observation-1" }),
    };
    const updateSpy = vi.spyOn(db.Observation, "update").mockResolvedValue([0]);
    const findSpy = vi.spyOn(db.Observation, "findOne")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const createSpy = vi.spyOn(db.Observation, "create").mockResolvedValue({});
    const monitor = createMonitor({
      baseline_policy: { type: "previous_period" },
      chart_id: 4,
      dataset_id: 8,
      definition_fingerprint: "definition",
      metric_spec: {
        aggregate: "sum",
        layerId: "revenue",
        timeUnit: "day",
        unit: "currency_usd",
      },
      name: "Revenue",
      project_id: 2,
      team_id: 1,
    });
    const baseline = {
      comparison: {
        periodEnd: new Date("2026-07-29T00:00:00.000Z"),
        periodStart: new Date("2026-07-28T00:00:00.000Z"),
      },
      current: {
        periodEnd: new Date("2026-07-30T00:00:00.000Z"),
        periodStart: new Date("2026-07-29T00:00:00.000Z"),
      },
      sampleCount: 14,
    };
    const candidate = {
      absoluteDelta: -30,
      baselineValue: 100,
      confidence: "high",
      currentValue: 70,
      direction: "decrease",
      features: { completeness: 1 },
      relativeDelta: -0.3,
      score: 1,
      scoreVersion: "deterministic-v1",
      severity: "high",
    };

    await publishObservation(monitor, baseline, candidate, {
      deduplicationCooldownDays: 7,
    });

    expect(createSpy).not.toHaveBeenCalled();
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
      evidence_revision: 3,
      resolved_at: null,
      status: "open",
    }));

    createSpy.mockRestore();
    findSpy.mockRestore();
    updateSpy.mockRestore();
  });

  it("only reports additive segment movement when totals reconcile", () => {
    const rows = [
      { amount: 60, country: "US", date: "2026-07-27T12:00:00.000Z" },
      { amount: 40, country: "CA", date: "2026-07-27T12:00:00.000Z" },
      { amount: 30, country: "US", date: "2026-07-28T12:00:00.000Z" },
      { amount: 50, country: "CA", date: "2026-07-28T12:00:00.000Z" },
    ];
    const monitor = createMonitor({
      metric_spec: {
        aggregate: "sum",
        metricField: "root[].amount",
        timeField: "root[].date",
      },
    });
    const observation = {
      baseline_value: 100,
      comparison_period_end: new Date("2026-07-28T00:00:00.000Z"),
      comparison_period_start: new Date("2026-07-27T00:00:00.000Z"),
      current_period_end: new Date("2026-07-29T00:00:00.000Z"),
      current_period_start: new Date("2026-07-28T00:00:00.000Z"),
      current_value: 80,
    };

    const analysis = analyzeDimension(rows, observation, monitor, "root[].country");

    expect(analysis.segments[0]).toMatchObject({
      comparison: 60,
      current: 30,
      delta: -30,
      segment: "US",
    });
    expect(analyzeDimension(rows, { ...observation, current_value: 90 }, monitor, "root[].country"))
      .toBeNull();
  });

  it("projects viewer dataset results to safe fields used by accessible dashboards", () => {
    const profile = {
      fields: {
        "root[].amount": { role: "measure", semanticType: "currency" },
        "root[].customer_email": { role: "dimension", semanticType: "email" },
        "root[].internal_id": { role: "identifier", semanticType: null },
        "root[].phone": { role: "dimension", semanticType: null },
        "root[].plan": { role: "dimension", semanticType: null },
      },
      usage: {
        dimensions: [
          { dashboardId: 4, field: "root[].plan" },
          { dashboardId: 4, field: "root[].customer_email" },
          { dashboardId: 4, field: "root[].phone" },
        ],
        filters: [],
        metrics: [
          { dashboardId: 4, field: "root[].amount" },
          { dashboardId: 9, field: "root[].internal_id" },
        ],
      },
    };
    const fields = getSafeViewerFields(profile, [4]);

    expect(fields).toEqual(["root[].amount", "root[].plan"]);
    expect(projectRows([{
      amount: 42,
      customer_email: "hidden@example.com",
      internal_id: "secret",
      phone: "+1 555 0100",
      plan: "Pro",
    }], fields)).toEqual([{
      "root[].amount": 42,
      "root[].plan": "Pro",
    }]);
  });

  it("requires enough scalar samples and uses the rolling median", () => {
    const monitor = createMonitor({ kind: "scalar", minimum_samples: 4 });
    const baseline = calculateBaseline([100, 105, 95, 120].map((value, index) => ({
      completeness: 1,
      periodEnd: new Date(Date.UTC(2026, 6, index + 2)),
      periodStart: new Date(Date.UTC(2026, 6, index + 1)),
      value,
    })), monitor);

    expect(median([100, 105, 95])).toBe(100);
    expect(baseline.eligible).toBe(true);
    expect(baseline.baseline).toBe(100);
    expect(baseline.current.value).toBe(120);
  });

  it("publishes a material record-count regression after the rolling baseline is ready", () => {
    const monitor = createMonitor({
      kind: "record_count",
      metric_spec: { layerId: "records", unit: "number" },
      minimum_samples: 4,
    });
    const baseline = calculateBaseline([100, 102, 98, 70].map((value, index) => ({
      completeness: 1,
      periodEnd: new Date(Date.UTC(2026, 7, index + 2)),
      periodStart: new Date(Date.UTC(2026, 7, index + 1)),
      value,
    })), monitor);
    const candidate = scoreCandidate(baseline, monitor, {
      minimumPercentagePointChange: 1,
      minimumRelativeChange: 0.1,
      publishScore: 0.75,
    });

    expect(candidate.publish).toBe(true);
    expect(candidate.direction).toBe("decrease");
  });

  it("builds weighted daily rollups before raw snapshot cleanup", () => {
    const snapshots = [
      {
        completeness: 1,
        definition_fingerprint: "fingerprint",
        monitor_id: "monitor-1",
        period_end: new Date("2026-07-20T03:00:00.000Z"),
        sample_count: 2,
        team_id: 1,
        value: 10,
      },
      {
        completeness: 0.5,
        definition_fingerprint: "fingerprint",
        monitor_id: "monitor-1",
        period_end: new Date("2026-07-20T18:00:00.000Z"),
        sample_count: 1,
        team_id: 1,
        value: 16,
      },
    ];
    const [group] = groupRawSnapshots(snapshots).values();
    const range = utcDayRange(snapshots[0].period_end);

    expect(group.sampleCount).toBe(3);
    expect(group.valueTotal / group.sampleCount).toBe(12);
    expect(range.start.toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("allows zero to explicitly disable an intelligence retention category", () => {
    const options = normalizeRetentionOptions({
      auditDays: "0",
      rawSnapshotDays: "0",
    });
    expect(options.auditDays).toBe(0);
    expect(options.rawSnapshotDays).toBe(0);
    expect(options.rollupDays).toBe(730);
  });

  it("redacts shadow audit evidence and validates bounded output", () => {
    const evidence = buildAuditEvidence({
      aggregate: "sum",
      features: {
        completeness: 1,
        relativeMagnitude: 0.2,
        secretField: "customer_email",
      },
      published: true,
      relativeDelta: -0.2,
      sampleCount: 7,
      unit: "currency",
    });
    const verdict = validateAuditVerdict({
      evidenceSupported: true,
      reasonCodes: ["material_change", "made_up_code"],
      relevanceScore: 0.8,
      relevant: true,
      suggestedWeightChanges: [{
        direction: "decrease",
        feature: "relativeMagnitude",
        rationale: "The threshold may be too strict.",
      }],
    });

    expect(evidence.features.secretField).toBeUndefined();
    expect(verdict.reasonCodes).toEqual(["material_change"]);
    expect(deterministicSample("same-candidate", 0.5)).toBe(
      deterministicSample("same-candidate", 0.5),
    );
  });

  it("joins user feedback to deterministic features and sampled audits", () => {
    const createFeedback = ({
      desiredDirection,
      id,
      kind,
      reasonCode,
      verdict,
    }) => ({
      Observation: {
        MetricMonitor: {
          baseline_policy: { type: "rolling_median" },
          kind,
          metric_spec: { desiredDirection },
        },
        direction: "decrease",
        evidence: {
          completeness: 1,
          featureValues: { magnitudeScore: 0.8, relativeMagnitude: 0.3 },
          sampleCount: 14,
        },
        id,
        relative_delta: -0.3,
        score: 0.9,
        score_version: "deterministic-v1",
        severity: "high",
      },
      reason_code: reasonCode,
      verdict,
    });
    const feedback = [
      createFeedback({
        desiredDirection: "higher",
        id: "observation-1",
        kind: "timeseries",
        verdict: "relevant",
      }),
      createFeedback({
        desiredDirection: "neutral",
        id: "observation-2",
        kind: "record_count",
        reasonCode: "expected_change",
        verdict: "not_relevant",
      }),
    ];
    const audits = [{
      observation_id: "observation-1",
      verdict: { evidenceSupported: true, relevant: true, suggestedWeightChanges: [] },
    }, {
      observation_id: "observation-2",
      verdict: { evidenceSupported: true, relevant: true, suggestedWeightChanges: [] },
    }];

    const report = buildCalibrationReport({
      audits,
      feedback,
      generatedAt: new Date("2026-08-05T00:00:00.000Z"),
    });

    expect(report.feedback.overall).toMatchObject({
      lowSample: true,
      notRelevant: 1,
      relevanceRate: 0.5,
      relevant: 1,
      total: 2,
    });
    expect(report.feedback.cohorts.monitorKind.timeseries.relevant).toBe(1);
    expect(report.feedback.cohorts.impact.negative.relevant).toBe(1);
    expect(report.feedback.falsePositiveReasons.expected_change).toBe(1);
    expect(report.feedback.llmAgreement).toMatchObject({
      agreed: 1,
      compared: 2,
      disagreed: 1,
      lowSample: true,
    });
    expect(report.feedback.featureAverages.relevant.relativeMagnitude)
      .toEqual({ average: 0.3, samples: 1 });
    expect(JSON.stringify(report)).not.toContain("metricTitle");
  });

  it("schedules weekly summaries once in the recipient timezone window", () => {
    const subscription = {
      cadence: "weekly",
      day_of_week: 1,
      last_delivered_at: null,
      last_noop_at: null,
      local_delivery_time: "09:00",
      timezone: "Asia/Bangkok",
    };
    expect(isDigestDue(
      subscription,
      DateTime.fromISO("2026-08-03T09:05:00", { zone: "Asia/Bangkok" }),
    )).toBe(true);
    expect(isDigestDue(
      subscription,
      DateTime.fromISO("2026-08-04T09:05:00", { zone: "Asia/Bangkok" }),
    )).toBe(false);
    expect(getNextDigestDelivery(
      { ...subscription, day_of_week: 5, enabled: true },
      DateTime.fromISO("2026-08-04T10:00:00", { zone: "Asia/Bangkok" }),
    )).toBe("2026-08-07T02:00:00.000Z");
  });

  it("limits daily summaries to the selected delivery days", () => {
    const subscription = {
      cadence: "daily",
      delivery_days: ["monday", "wednesday", "friday"],
      enabled: true,
      last_attempted_at: null,
      last_delivered_at: null,
      last_noop_at: null,
      local_delivery_time: "09:00",
      timezone: "UTC",
    };

    expect(isDigestDue(
      subscription,
      DateTime.fromISO("2026-08-04T09:05:00", { zone: "UTC" }),
    )).toBe(false);
    expect(isDigestDue(
      subscription,
      DateTime.fromISO("2026-08-05T09:05:00", { zone: "UTC" }),
    )).toBe(true);
    expect(getNextDigestDelivery(
      subscription,
      DateTime.fromISO("2026-08-04T10:00:00", { zone: "UTC" }),
    )).toBe("2026-08-05T09:00:00.000Z");
  });
});
