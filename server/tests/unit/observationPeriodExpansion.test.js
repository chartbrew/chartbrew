import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  assertPeriodAvailable,
  getPeriodAvailability,
} = require("../../modules/observations/periodAvailability");
const { addPeriod } = require("../../modules/observations/extractMetrics");
const { normalizePeriodContract } = require("../../modules/observations/periodContract");
const { evaluateCompletedPeriod } = require("../../modules/observations/evaluatePeriod");
const { formatComparisonLabel } = require("../../modules/observations/periodLabels");
const {
  getCompletedPeriodWindows,
  getPeriodEvaluationSchedule,
} = require("../../modules/observations/periodWindows");
const {
  buildTimeRange,
} = require("../../visualization/compilers/chartJsCartesian");

function chartWithRange(start, end) {
  return {
    chartData: {
      meta: {
        timeRange: { end, start },
      },
    },
  };
}

function createMonitor(comparisonPeriod, metricBehavior, timeUnit = "month") {
  return {
    baseline_policy: {
      calendarTimezone: "UTC",
      checkpointToleranceMinutes: 1440,
      comparison: "previous_period",
      comparisonPeriod,
      periodMode: "completed",
      policyVersion: "completed-period-v1",
      settlingDelayMinutes: 360,
      type: "completed_period",
      weekStartsOn: 1,
    },
    definition_fingerprint: "period-expansion-definition",
    id: `monitor-${comparisonPeriod}`,
    kind: "timeseries",
    metric_spec: {
      aggregate: metricBehavior === "flow" ? "sum" : "none",
      metricBehavior,
      timeUnit,
      valueFormat: { display: { scale: 1 }, meaning: "number" },
    },
    publication_policy: {
      thresholdType: "relative",
      thresholdValue: 0.1,
    },
  };
}

describe("quarterly and yearly observation periods", () => {
  it("builds completed calendar quarter windows and their next schedule", () => {
    const schedule = getPeriodEvaluationSchedule({
      asOf: "2026-08-11T12:00:00.000Z",
      comparisonPeriod: "quarter",
      settlingDelayMinutes: 360,
      timezone: "UTC",
      weekStartsOn: 1,
    });

    expect(schedule.windows.comparison.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(schedule.windows.comparison.end.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(schedule.windows.current.start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(schedule.windows.current.end.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(schedule.currentDueAt.toISOString()).toBe("2026-07-01T06:00:00.000Z");
    expect(schedule.nextDueAt.toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });

  it("builds completed calendar year windows across a leap year", () => {
    const windows = getCompletedPeriodWindows({
      asOf: "2026-08-11T12:00:00.000Z",
      comparisonPeriod: "year",
      timezone: "America/New_York",
      weekStartsOn: 1,
    });

    expect(windows.comparison.start.toISOString()).toBe("2024-01-01T05:00:00.000Z");
    expect(windows.comparison.end.toISOString()).toBe("2025-01-01T05:00:00.000Z");
    expect(windows.current.start.toISOString()).toBe("2025-01-01T05:00:00.000Z");
    expect(windows.current.end.toISOString()).toBe("2026-01-01T05:00:00.000Z");
  });

  it("uses short business labels for quarters and years", () => {
    const quarterWindows = getCompletedPeriodWindows({
      asOf: "2026-08-11T12:00:00.000Z",
      comparisonPeriod: "quarter",
      timezone: "UTC",
      weekStartsOn: 1,
    });
    const yearWindows = getCompletedPeriodWindows({
      asOf: "2026-08-11T12:00:00.000Z",
      comparisonPeriod: "year",
      timezone: "UTC",
      weekStartsOn: 1,
    });

    expect(formatComparisonLabel({ ...quarterWindows }))
      .toBe("Q2 2026 compared with Q1 2026");
    expect(formatComparisonLabel({ ...yearWindows }))
      .toBe("2025 compared with 2024");
    expect(addPeriod(new Date("2026-04-01T00:00:00.000Z"), "quarter", "UTC").toISOString())
      .toBe("2026-07-01T00:00:00.000Z");
  });

  it("accepts quarterly and yearly completed-period contracts", () => {
    ["quarter", "year"].forEach((comparisonPeriod) => {
      expect(normalizePeriodContract({
        calendarTimezone: "UTC",
        comparisonPeriod,
        metricBehavior: "flow",
        threshold: { type: "relative", value: 0.1 },
      }, {
        aggregate: "sum",
        timeUnit: "day",
      }).baselinePolicy.comparisonPeriod).toBe(comparisonPeriod);
    });
  });

  it("rejects period totals that the chart cannot reproduce", () => {
    expect(() => normalizePeriodContract({
      calendarTimezone: "UTC",
      comparisonPeriod: "quarter",
      metricBehavior: "flow",
      threshold: { type: "relative", value: 0.1 },
    }, {
      aggregate: "sum",
      kind: "timeseries",
      timeUnit: "hour",
    })).toThrow(/cannot build a complete total/);

    expect(() => normalizePeriodContract({
      calendarTimezone: "UTC",
      comparisonPeriod: "month",
      metricBehavior: "flow",
      threshold: { type: "relative", value: 0.1 },
    }, {
      aggregate: "count",
      kind: "record_count",
      timeUnit: "day",
    })).toThrow(/complete time-series values/);
  });

  it("evaluates a quarter from complete monthly flow values", () => {
    const snapshots = [
      ["2026-01-01", "2026-02-01", 10],
      ["2026-02-01", "2026-03-01", 20],
      ["2026-03-01", "2026-04-01", 30],
      ["2026-04-01", "2026-05-01", 30],
      ["2026-05-01", "2026-06-01", 30],
      ["2026-06-01", "2026-07-01", 30],
    ].map(([periodStart, periodEnd, value]) => ({
      completeness: 1,
      coverage: "complete",
      periodEnd: `${periodEnd}T00:00:00.000Z`,
      periodStart: `${periodStart}T00:00:00.000Z`,
      value,
    }));
    const result = evaluateCompletedPeriod({
      asOf: "2026-08-11T12:00:00.000Z",
      confirmedAt: "2026-07-01T06:00:00.000Z",
      monitor: createMonitor("quarter", "flow"),
      snapshots,
    });

    expect(result).toEqual(expect.objectContaining({
      baselineValue: 60,
      currentValue: 90,
      eligible: true,
      finality: "final",
      passesThreshold: true,
      sourceBucketCount: 6,
    }));
  });

  it("evaluates a year from aligned state checkpoints", () => {
    const result = evaluateCompletedPeriod({
      asOf: "2026-08-11T12:00:00.000Z",
      confirmedAt: "2026-01-01T06:00:00.000Z",
      monitor: createMonitor("year", "state", "day"),
      snapshots: [{
        completeness: 1,
        coverage: "complete",
        periodEnd: "2025-01-01T00:00:00.000Z",
        periodStart: "2024-12-31T00:00:00.000Z",
        value: 100,
      }, {
        completeness: 1,
        coverage: "complete",
        periodEnd: "2026-01-01T00:00:00.000Z",
        periodStart: "2025-12-31T00:00:00.000Z",
        value: 120,
      }],
    });

    expect(result).toEqual(expect.objectContaining({
      baselineValue: 100,
      currentValue: 120,
      eligible: true,
      finality: "final",
      passesThreshold: true,
      sourceCheckpointCount: 2,
    }));
  });
});

describe("comparison period availability", () => {
  const asOf = "2026-08-11T12:00:00.000Z";

  it("disables long comparisons for a chart with only 30 days of history", () => {
    const availability = getPeriodAvailability(
      chartWithRange("2026-07-12T00:00:00.000Z", "2026-08-12T00:00:00.000Z"),
      { asOf, timezone: "UTC" }
    );

    expect(availability.day.available).toBe(true);
    expect(availability.week.available).toBe(true);
    expect(availability.month).toEqual(expect.objectContaining({
      available: false,
      reason: "Needs the last two complete months in this chart",
    }));
    expect(availability.quarter.available).toBe(false);
    expect(availability.year.available).toBe(false);
  });

  it("enables a quarter only when both completed quarters are in the chart", () => {
    const availability = getPeriodAvailability(
      chartWithRange("2026-01-01T00:00:00.000Z", "2026-08-12T00:00:00.000Z"),
      { asOf, timezone: "UTC" }
    );

    expect(availability.quarter.available).toBe(true);
    expect(availability.year.available).toBe(false);
  });

  it("does not block a chart when its time range is unknown", () => {
    const availability = getPeriodAvailability({}, { asOf, timezone: "UTC" });

    expect(Object.values(availability).every((period) => {
      return period.available && period.known === false;
    })).toBe(true);
  });

  it("rejects an unavailable period through the server contract boundary", () => {
    expect(() => assertPeriodAvailable(
      chartWithRange("2026-07-12T00:00:00.000Z", "2026-08-12T00:00:00.000Z"),
      { asOf, comparisonPeriod: "quarter", timezone: "UTC" }
    )).toThrow(/last two complete quarters/);
  });

  it("stores the effective rendered time range with an exclusive end", () => {
    expect(buildTimeRange({
      effectiveDateRange: {
        endDate: "2026-08-10T23:59:59.999Z",
        startDate: "2026-07-12T00:00:00.000Z",
      },
    }, [], "day", "UTC")).toEqual({
      end: "2026-08-11T00:00:00.000Z",
      start: "2026-07-12T00:00:00.000Z",
    });
  });
});
