import { afterEach, expect, it, vi } from "vitest";

const db = require("../../models/models");
const { getPlatformAnalytics, getTeamAnalytics } = require("../../modules/platformAnalytics");

afterEach(() => vi.restoreAllMocks());

it.each(["team", "platform"])("connects sparse %s request timings without replacing missing values", async (scope) => {
  vi.spyOn(db.SourceExecution, "findAll").mockResolvedValue([
    { day: "2026-10-16", status: "success", count: 1, durationMs: 123, timedCount: 1 },
    { day: "2026-10-19", status: "success", count: 1, durationMs: 800, timedCount: 1 },
  ]);
  vi.spyOn(db.AiUsage, "findAll").mockResolvedValue([]);
  const now = new Date("2026-10-20T12:00:00Z");
  const result = scope === "team"
    ? await getTeamAnalytics(7, "7", now)
    : await getPlatformAnalytics("7", now);
  const chart = result.charts.duration.configuration;
  const values = [null, null, 0.123, null, null, 0.8, null];

  expect(result.daily.map((day) => day.meanSeconds)).toEqual(values);
  expect(chart.dataset.source.map((row) => row[1])).toEqual(values);
  expect(chart.series[0]).toMatchObject({ type: "line", connectNulls: true, showSymbol: true });
  expect(result.summary.meanSeconds).toBe(0.4615);
  expect(result.charts.outcomes.configuration.series[0].type).toBe("bar");
  expect(result.ai.charts.calls.configuration.series[0].connectNulls).toBe(false);
});
