import {
  describe, expect, it,
} from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { calculateBaseline } = require("../../modules/observations/baseline");
const {
  getCompletedPeriodWindows,
  getPeriodEvaluationSchedule,
} = require("../../modules/observations/periodWindows");
const { scoreCandidate } = require("../../modules/observations/scoreCandidate");
const corpus = require("../fixtures/observation-period-corpus.json");

const ALLOWED_STATUSES = new Set([
  "corrected",
  "data_health_only",
  "final",
  "incomplete",
  "review_required",
  "waiting_for_fresh_data",
  "waiting_for_period_close",
]);

const REQUIRED_TAGS = [
  "absolute_threshold",
  "ambiguous",
  "closed_month",
  "closed_day",
  "closed_week",
  "daily",
  "data_health",
  "delayed_source",
  "dst",
  "flow",
  "late_backfill",
  "month_length",
  "native_period",
  "open_month",
  "open_day",
  "open_week",
  "partial_bucket",
  "percentage_point_threshold",
  "relative_threshold",
  "state",
  "timezone",
];

function findScenario(id) {
  return corpus.scenarios.find((scenario) => scenario.id === id);
}

function crossesThreshold(scenario) {
  const baselineValue = Number(scenario.input.baselineValue);
  const currentValue = Number(scenario.input.currentValue);
  const thresholdValue = Number(scenario.monitor.threshold.value);
  const absoluteDelta = Math.abs(currentValue - baselineValue);

  if (scenario.monitor.threshold.type === "absolute") {
    return absoluteDelta >= thresholdValue;
  }
  if (scenario.monitor.threshold.type === "percentage_points") {
    return absoluteDelta * Number(scenario.monitor.valueScale) >= thresholdValue;
  }
  return baselineValue !== 0 && absoluteDelta / Math.abs(baselineValue) >= thresholdValue;
}

describe("observation period regression corpus", () => {
  it("has one valid and unique contract for every scenario", () => {
    expect(corpus.version).toBe(1);
    expect(corpus.scenarios.length).toBeGreaterThan(10);

    const ids = corpus.scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);

    corpus.scenarios.forEach((scenario) => {
      expect(scenario.description.length).toBeGreaterThan(10);
      expect(Number.isNaN(Date.parse(scenario.now))).toBe(false);
      expect(Array.isArray(scenario.tags)).toBe(true);
      expect(scenario.tags.length).toBeGreaterThan(0);
      expect(ALLOWED_STATUSES.has(scenario.expected.status)).toBe(true);
      expect(typeof scenario.expected.publish).toBe("boolean");

      scenario.input.snapshots.forEach((snapshot) => {
        expect(Number.isNaN(Date.parse(snapshot.periodStart))).toBe(false);
        expect(Number.isNaN(Date.parse(snapshot.periodEnd))).toBe(false);
        expect(["complete", "partial", "unknown"]).toContain(snapshot.coverage);
        expect(Number.isFinite(snapshot.value)).toBe(true);
      });
    });

    corpus.scenarios
      .filter((scenario) => scenario.monitor.comparisonPeriod)
      .forEach((scenario) => {
        expect(["day", "month", "week"]).toContain(scenario.monitor.comparisonPeriod);
        expect(scenario.monitor.threshold).toEqual(expect.objectContaining({
          type: expect.stringMatching(/^(absolute|percentage_points|relative)$/),
          value: expect.any(Number),
        }));
      });
  });

  it("covers every first-release risk class", () => {
    const tags = new Set(corpus.scenarios.flatMap((scenario) => scenario.tags));
    REQUIRED_TAGS.forEach((tag) => expect(tags.has(tag)).toBe(true));
  });

  it("records the refresh-bound false positives that the new engine must reject", () => {
    const falsePositiveCases = corpus.scenarios.filter((scenario) => {
      return scenario.tags.includes("legacy_false_positive");
    });

    expect(falsePositiveCases.length).toBeGreaterThanOrEqual(4);
    falsePositiveCases.forEach((scenario) => {
      const baseline = calculateBaseline(scenario.input.snapshots, {
        importance: 1,
        kind: "timeseries",
        metric_spec: { unit: "number" },
        minimum_samples: 2,
      });
      const candidate = scoreCandidate(baseline, {
        importance: 1,
        kind: "timeseries",
        metric_spec: { unit: "number" },
      }, corpus.legacyPolicy);

      expect(candidate.publish).toBe(scenario.legacy.expectedPublish);
      expect(scenario.expected.publish).toBe(false);
      expect(scenario.expected.status).not.toBe("final");
    });
  });

  it("defines deterministic behavior for each threshold type", () => {
    const thresholdCases = corpus.scenarios.filter((scenario) => {
      return scenario.tags.includes("threshold_case");
    });

    expect(thresholdCases.map((scenario) => scenario.monitor.threshold.type).sort()).toEqual([
      "absolute",
      "percentage_points",
      "relative",
    ]);
    thresholdCases.forEach((scenario) => {
      expect(crossesThreshold(scenario)).toBe(scenario.expected.publish);
    });
  });

  it("keeps calendar boundaries explicit across month length and daylight-saving changes", () => {
    const scenarios = [
      findScenario("closed-month-additive-flow"),
      findScenario("closed-day-failed-sync-rate"),
      findScenario("bangkok-month-boundary"),
      findScenario("new-york-dst-week"),
    ];

    scenarios.forEach((scenario) => {
      const windows = getCompletedPeriodWindows({
        asOf: scenario.now,
        comparisonPeriod: scenario.monitor.comparisonPeriod,
        timezone: scenario.monitor.timezone,
        weekStartsOn: scenario.monitor.weekStartsOn || 1,
      });
      expect(windows.current.start.toISOString()).toBe(scenario.expected.currentPeriod.start);
      expect(windows.current.end.toISOString()).toBe(scenario.expected.currentPeriod.end);
    });
    scenarios
      .filter((scenario) => scenario.expected.comparisonPeriod)
      .forEach((scenario) => {
        const windows = getCompletedPeriodWindows({
          asOf: scenario.now,
          comparisonPeriod: scenario.monitor.comparisonPeriod,
          timezone: scenario.monitor.timezone,
          weekStartsOn: scenario.monitor.weekStartsOn || 1,
        });
        expect(windows.comparison.start.toISOString())
          .toBe(scenario.expected.comparisonPeriod.start);
        expect(windows.comparison.end.toISOString()).toBe(scenario.expected.comparisonPeriod.end);
      });
    scenarios
      .filter((scenario) => scenario.expected.currentPeriod.durationHours)
      .forEach((scenario) => {
        const windows = getCompletedPeriodWindows({
          asOf: scenario.now,
          comparisonPeriod: scenario.monitor.comparisonPeriod,
          timezone: scenario.monitor.timezone,
          weekStartsOn: scenario.monitor.weekStartsOn || 1,
        });
        const actualHours = (windows.current.end - windows.current.start) / (60 * 60 * 1000);
        expect(actualHours).toBe(scenario.expected.currentPeriod.durationHours);
      });
  });

  it("rejects comparison settings outside the first period-aware release", () => {
    expect(() => getCompletedPeriodWindows({ comparisonPeriod: "quarter" }))
      .toThrow(/day, week, or month/);
    expect(() => getCompletedPeriodWindows({
      comparisonPeriod: "month",
      periodMode: "period_to_date",
    })).toThrow(/completed/);
    expect(() => getCompletedPeriodWindows({
      comparison: "prior_year",
      comparisonPeriod: "month",
    })).toThrow(/previous_period/);
    expect(() => getCompletedPeriodWindows({
      comparisonPeriod: "week",
      timezone: "Not/A_Zone",
    })).toThrow(/IANA timezone/);
    expect(() => getCompletedPeriodWindows({
      comparisonPeriod: "week",
      weekStartsOn: 0,
    })).toThrow(/1 to 7/);
  });

  it("uses the configured local week start", () => {
    const windows = getCompletedPeriodWindows({
      asOf: "2026-08-09T12:00:00.000Z",
      comparisonPeriod: "week",
      timezone: "UTC",
      weekStartsOn: 7,
    });

    expect(windows.current.start.toISOString()).toBe("2026-08-02T00:00:00.000Z");
    expect(windows.current.end.toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("keeps daily windows on local calendar boundaries", () => {
    const dstWindows = getCompletedPeriodWindows({
      asOf: "2026-03-09T12:00:00.000Z",
      comparisonPeriod: "day",
      timezone: "America/New_York",
      weekStartsOn: 1,
    });
    expect((dstWindows.current.end - dstWindows.current.start) / (60 * 60 * 1000)).toBe(23);

    const schedule = getPeriodEvaluationSchedule({
      asOf: "2026-08-10T03:00:00.000Z",
      comparisonPeriod: "day",
      settlingDelayMinutes: 360,
      timezone: "Asia/Bangkok",
      weekStartsOn: 1,
    });
    expect(schedule.currentDueAt.toISOString()).toBe("2026-08-09T23:00:00.000Z");
    expect(schedule.nextDueAt.toISOString()).toBe("2026-08-10T23:00:00.000Z");
  });

  it("requires review for ambiguous metrics and keeps returned-row volume in Data health", () => {
    expect(findScenario("ambiguous-scalar-without-period-contract").expected).toEqual({
      publish: false,
      status: "review_required",
    });
    expect(findScenario("dataset-returned-row-volume").expected).toEqual({
      publish: false,
      status: "data_health_only",
    });
  });

  it("records late backfill as a labelled correction revision", () => {
    const scenario = findScenario("late-month-backfill-correction");

    expect(scenario.expected.revision).toBe(scenario.input.existingEvaluation.revision + 1);
    expect(scenario.expected.deliveryLabel).toBe("Corrected");
    expect(scenario.expected.currentValue).toBe(128000);
  });
});
