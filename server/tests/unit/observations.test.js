import {
  describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { calculateBaseline, median } = require("../../modules/observations/baseline");
const { extractMonitorSnapshots } = require("../../modules/observations/extractMetrics");
const { analyzeDimension } = require("../../modules/observations/driverAnalysis");
const { buildMonitorDefinition } = require("../../modules/observations/monitorSchema");
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
const { isDigestDue } = require("../../modules/observations/digestSchedule");
const db = require("../../models/models");
const { publishObservation } = require("../../modules/observations/processChartResult");
const {
  getSafeViewerFields,
  projectRows,
} = require("../../modules/ai/orchestrator/tools/runExistingDataset");
const { DateTime } = require("luxon");

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
      layerId: "revenue",
      unit: "currency_usd",
    });

    expect(definition.kind).toBe("timeseries");
    expect(definition.metricSpec.metricTitle).toBe("Revenue");
    expect(definition.definitionFingerprint).toHaveLength(64);
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

  it("schedules weekly summaries once in the recipient timezone window", () => {
    const subscription = {
      cadence: "weekly",
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
  });
});
