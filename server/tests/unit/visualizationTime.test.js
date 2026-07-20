import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");
const {
  bucketTime,
  createMoment,
  expandTimeValues,
  formatTimeValues,
} = require("../../visualization/time.js");

describe("visualization time handling", () => {
  it("buckets timestamps before aggregation", () => {
    const result = new VisualizationEngine({
      chart: {
        id: 1,
        type: "line",
        timeInterval: "month",
        displayLegend: true,
        includeZeros: false,
        visualization: {
          version: 2,
          settings: { timeInterval: "month" },
          layers: [{
            id: "created",
            bindingId: "cdc-1",
            mark: "line",
            encoding: {
              time: { field: "root[].period", type: "temporal" },
              value: { field: "root[].created", type: "quantitative", aggregate: "sum" },
            },
          }],
        },
      },
      datasets: [{
        options: { id: "cdc-1" },
        data: [
          { period: "2026-04-02T00:00:00.000Z", created: 1 },
          { period: "2026-04-14T00:00:00.000Z", created: 3 },
          { period: "2026-05-01T00:00:00.000Z", created: 2 },
        ],
      }],
      timezone: "UTC",
    }).render();

    expect(result.configuration.data.labels).toEqual(["Apr", "May"]);
    expect(result.configuration.data.datasets[0].data).toEqual([4, 2]);
    expect(result.dateFormat).toBe("MMM");
    expect(result.isTimeseries).toBe(true);
  });

  it("uses the project timezone when selecting a time bucket", () => {
    const timestamp = "2026-01-01T00:30:00.000Z";
    const utcBucket = bucketTime(timestamp, "day", "UTC");
    const losAngelesBucket = bucketTime(timestamp, "day", "America/Los_Angeles");

    expect(formatTimeValues([utcBucket], "day", "UTC").labels).toEqual(["Jan 1"]);
    expect(formatTimeValues([losAngelesBucket], "day", "America/Los_Angeles").labels)
      .toEqual(["2025 Dec 31"]);
  });

  it("fills missing time buckets inside a configured date window", () => {
    const expanded = expandTimeValues([
      "2026-07-01T12:00:00Z",
      "2026-07-03T12:00:00Z",
    ], "day", "UTC", {
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-03T23:59:59Z",
    });

    expect(expanded.map((value) => createMoment(value, "UTC").format("YYYY-MM-DD"))).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });
});
