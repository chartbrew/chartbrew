import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const AxisChart = require("../../charts/AxisChart.js");

describe("AxisChart runtime date handling", () => {
  it("uses yAxis as the xAxis fallback for KPI-style count charts", async () => {
    const chart = {
      id: 1491,
      type: "kpi",
      timeInterval: "day",
      includeZeros: true,
      ChartDatasetConfigs: [{
        id: "cdc-1",
        legend: "Users",
      }],
    };

    const datasets = [{
      options: {
        id: "cdc-1",
        yAxis: "root[]._id",
        yAxisOperation: "count",
        legend: "Users",
      },
      data: [
        { _id: "user-1" },
        { _id: "user-2" },
      ],
    }];

    const axisChart = new AxisChart({ chart, datasets }, "UTC");
    const result = await axisChart.plot(false, [], {});

    expect(result.configuration.data.datasets[0].data.length).toBeGreaterThan(0);
  });

  it("supports normal chart refreshes with chart date windows and multiple datasets", async () => {
    const chart = {
      id: 1490,
      type: "bar",
      timeInterval: "day",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-05T00:00:00.000Z",
      fixedStartDate: true,
      includeZeros: false,
      displayLegend: true,
      ChartDatasetConfigs: [{
        id: "cdc-1",
        legend: "Dataset 1",
        fill: true,
        fillColor: "#111111",
      }, {
        id: "cdc-2",
        legend: "Dataset 2",
        fill: true,
        fillColor: "#222222",
      }],
    };

    const datasets = [{
      options: {
        id: "cdc-1",
        dateField: "root[].createdAt",
        xAxis: "root[].createdAt",
        yAxis: "root[].count",
        yAxisOperation: "none",
        legend: "Dataset 1",
        fieldsSchema: {
          "root[].createdAt": "date",
          "root[].count": "number",
        },
      },
      data: [
        { createdAt: "2026-04-01T00:00:00.000Z", count: 3 },
        { createdAt: "2026-04-02T00:00:00.000Z", count: 5 },
      ],
    }, {
      options: {
        id: "cdc-2",
        dateField: "root[].createdAt",
        xAxis: "root[].createdAt",
        yAxis: "root[].count",
        yAxisOperation: "none",
        legend: "Dataset 2",
        fieldsSchema: {
          "root[].createdAt": "date",
          "root[].count": "number",
        },
      },
      data: [
        { createdAt: "2026-04-01T00:00:00.000Z", count: 7 },
        { createdAt: "2026-04-03T00:00:00.000Z", count: 9 },
      ],
    }];

    const axisChart = new AxisChart({ chart, datasets }, "UTC");
    const result = await axisChart.plot(false, [], {});

    expect(result.configuration.data.labels.length).toBeGreaterThan(0);
    expect(result.configuration.data.datasets).toHaveLength(2);
    expect(result.configuration.data.datasets[0].label).toBe("Dataset 1");
    expect(result.configuration.data.datasets[1].label).toBe("Dataset 2");
  });

  it("sums numeric rows in the same date bucket when sum is selected", async () => {
    const chart = {
      id: 1492,
      type: "line",
      timeInterval: "month",
      includeZeros: false,
      displayLegend: true,
      ChartDatasetConfigs: [{
        id: "cdc-1",
        legend: "Created",
      }],
    };

    const datasets = [{
      options: {
        id: "cdc-1",
        dateField: "root[].period",
        xAxis: "root[].period",
        yAxis: "root[].created",
        yAxisOperation: "sum",
        legend: "Created",
        fieldsSchema: {
          "root[].period": "date",
          "root[].created": "number",
        },
      },
      data: [
        { period: "2026-04-02T00:00:00.000Z", created: 1 },
        { period: "2026-04-14T00:00:00.000Z", created: 3 },
        { period: "2026-05-01T00:00:00.000Z", created: 2 },
      ],
    }];

    const axisChart = new AxisChart({ chart, datasets }, "UTC");
    const result = await axisChart.plot(false, [], {});

    expect(result.configuration.data.labels).toEqual(["Apr", "May"]);
    expect(result.configuration.data.datasets[0].data).toEqual([4, 2]);
  });

  it("keeps the latest numeric row in a date bucket when no y-axis operation is selected", async () => {
    const chart = {
      id: 1493,
      type: "line",
      timeInterval: "month",
      includeZeros: false,
      displayLegend: true,
      ChartDatasetConfigs: [{
        id: "cdc-1",
        legend: "MRR",
      }],
    };

    const datasets = [{
      options: {
        id: "cdc-1",
        dateField: "root[].date",
        xAxis: "root[].date",
        yAxis: "root[].mrr",
        yAxisOperation: "none",
        legend: "MRR",
        fieldsSchema: {
          "root[].date": "date",
          "root[].mrr": "number",
        },
      },
      data: [
        { date: "2026-05-01T00:00:00.000Z", mrr: 105783 },
        { date: "2026-05-05T00:00:00.000Z", mrr: 108683 },
        { date: "2026-05-20T00:00:00.000Z", mrr: 114483 },
      ],
    }];

    const axisChart = new AxisChart({ chart, datasets }, "UTC");
    const result = await axisChart.plot(false, [], {});

    expect(result.configuration.data.labels).toEqual(["May"]);
    expect(result.configuration.data.datasets[0].data).toEqual([114483]);
  });
});
