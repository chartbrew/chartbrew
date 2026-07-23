import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  legacyChartToVisualization,
} = require("../../visualization/legacyChartToVisualization.js");

describe("legacy chart visualization conversion", () => {
  it("converts an axis CDC into one canonical layer", () => {
    const result = legacyChartToVisualization({
      id: 1,
      type: "bar",
      stacked: true,
      horizontal: false,
      displayLegend: true,
      ChartDatasetConfigs: [{
        id: "cdc-1",
        dataset_id: 10,
        xAxis: "root[].program",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        legend: "Income",
        datasetColor: "#123456",
        Dataset: { id: 10, name: "Programs" },
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.visualization.layers).toEqual([expect.objectContaining({
      bindingId: "cdc-1",
      id: "legacy-cdc-1",
      mark: "bar",
      stack: "normal",
      encoding: {
        category: { field: "root[].program", type: "nominal" },
        value: {
          aggregate: "sum",
          field: "root[].revenue",
          title: "Income",
          type: "quantitative",
        },
      },
    })]);
  });

  it("converts KPI count bindings into a value-only encoding", () => {
    const result = legacyChartToVisualization({
      id: 2,
      type: "kpi",
      ChartDatasetConfigs: [{
        id: "cdc-2",
        dataset_id: 11,
        yAxis: "root[]._id",
        yAxisOperation: "count",
        legend: "Users",
        Dataset: { id: 11, name: "Users" },
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.visualization.layers[0].encoding).toEqual({
      value: {
        aggregate: "count",
        field: "root[]._id",
        title: "Users",
        type: "quantitative",
      },
    });
  });

  it("preserves legacy unique-count aggregation", () => {
    const result = legacyChartToVisualization({
      id: 6,
      type: "bar",
      ChartDatasetConfigs: [{
        id: "cdc-unique",
        dataset_id: 14,
        xAxis: "root[].month",
        yAxis: "root[].email",
        yAxisOperation: "count_unique",
        Dataset: { id: 14, name: "Signups" },
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.visualization.layers[0].encoding.value.aggregate).toBe("count_unique");
  });

  it.each(["pie", "doughnut", "radar", "polar"])(
    "uses a categorical date dimension for legacy %s charts",
    (type) => {
      const result = legacyChartToVisualization({
        id: 7,
        type,
        ChartDatasetConfigs: [{
          id: `cdc-${type}`,
          dataset_id: 15,
          xAxis: "root[].createdAt",
          yAxis: "root[].revenue",
          yAxisOperation: "sum",
          dateField: "root[].createdAt",
          Dataset: {
            id: 15,
            name: "Revenue",
            fieldsSchema: {
              "root[].createdAt": "date",
              "root[].revenue": "number",
            },
          },
        }],
      });

      expect(result.valid).toBe(true);
      expect(result.visualization.layers[0].encoding.category).toEqual({
        field: "root[].createdAt",
        type: "nominal",
      });
      expect(result.visualization.layers[0].encoding.time).toBeUndefined();
    }
  );

  it("carries the legacy table collection and presentation into the canonical layer", () => {
    const result = legacyChartToVisualization({
      id: 4,
      type: "table",
      ChartDatasetConfigs: [{
        id: "cdc-table",
        dataset_id: 12,
        xAxis: "root.payload.rows[]",
        columnsOrder: ["name", "revenue"],
        excludedFields: ["internal"],
        legend: "Programs",
        Dataset: { id: 12, name: "Programs" },
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.visualization.layers[0]).toEqual(expect.objectContaining({
      mark: "table",
      rowPath: "root.payload.rows[]",
      options: expect.objectContaining({
        columnsOrder: ["name", "revenue"],
        excludedFields: ["internal"],
      }),
    }));
  });

  it("converts accumulation into an explicit window transform", () => {
    const result = legacyChartToVisualization({
      id: 5,
      subType: "AddTimeseries",
      type: "line",
      ChartDatasetConfigs: [{
        id: "cdc-running",
        dataset_id: 13,
        xAxis: "root[].month",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        Dataset: { id: 13, name: "Revenue" },
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.visualization.layers[0].transforms).toEqual([{
      operation: "cumulativeSum",
      role: "value",
      type: "window",
    }]);
  });

  it("marks charts without bindings as migration orphans", () => {
    const result = legacyChartToVisualization({
      id: 3,
      type: "line",
      ChartDatasetConfigs: [],
    });

    expect(result.valid).toBe(true);
    expect(result.visualization.status).toBe("orphan");
    expect(result.visualization.layers).toEqual([]);
  });
});
