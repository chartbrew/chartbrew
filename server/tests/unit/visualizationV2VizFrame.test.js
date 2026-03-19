import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildVizFrame } = require("../../modules/visualizationV2/vizFrame.js");

describe("visualizationV2 VizFrame", () => {
  it("builds zero-filled daily buckets for date series aggregations", () => {
    const frame = buildVizFrame({
      chart: {
        id: 21,
        type: "line",
        timeInterval: "day",
        includeZeros: true,
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T23:59:59.000Z",
        ChartDatasetConfigs: [{
          id: "cdc_timeseries",
          legend: "Revenue",
          vizConfig: {
            options: {
              visualization: {
                dataMode: "series",
              },
            },
          },
        }],
      },
      datasets: [{
        options: {
          id: 61,
          xAxis: "root[].created_at",
          yAxis: "root[].value",
          yAxisOperation: "sum",
          dateField: "root[].created_at",
          conditions: [],
          fieldsSchema: {
            "root[].created_at": "date",
            "root[].value": "number",
          },
        },
        data: [
          { created_at: "2026-03-01T10:00:00.000Z", value: 10 },
          { created_at: "2026-03-03T16:00:00.000Z", value: 30 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
    });

    expect(frame.isTimeseries).toBe(true);
    expect(frame.dateFormat).toBe("YYYY-MM-DD");
    expect(frame.labels.map((label) => label.label)).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
    expect(frame.series[0].data).toEqual([10, 0, 30]);
  });

  it("aggregates count_unique metrics by category", () => {
    const frame = buildVizFrame({
      chart: {
        id: 22,
        type: "bar",
        timeInterval: "day",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_unique",
          legend: "Users",
          vizConfig: {
            options: {
              visualization: {
                dataMode: "series",
              },
            },
          },
        }],
      },
      datasets: [{
        options: {
          id: 62,
          xAxis: "root[].team",
          yAxis: "root[].user_id",
          yAxisOperation: "count_unique",
          conditions: [],
          fieldsSchema: {
            "root[].team": "string",
            "root[].user_id": "string",
          },
        },
        data: [
          { team: "alpha", user_id: "u1" },
          { team: "alpha", user_id: "u2" },
          { team: "alpha", user_id: "u1" },
          { team: "beta", user_id: "u3" },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
    });

    expect(frame.isTimeseries).toBe(false);
    expect(frame.labels.map((label) => label.label)).toEqual(["alpha", "beta"]);
    expect(frame.series[0].data).toEqual([2, 1]);
  });
});
