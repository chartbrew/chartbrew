import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { legacyToVizConfig } = require("../../modules/visualizationV2/legacyToVizConfig.js");
const {
  createVisualizationRuntimePayload,
  isVisualizationV2Chart,
  runVisualizationV2,
} = require("../../modules/visualizationV2/runtime.js");

describe("visualizationV2 runtime", () => {
  it("detects charts where every cdc is migrated to vizVersion 2", () => {
    expect(isVisualizationV2Chart({
      ChartDatasetConfigs: [
        { vizVersion: 2, vizConfig: { version: 2 } },
        { vizVersion: 2, vizConfig: { version: 2 } },
      ],
    })).toBe(true);

    expect(isVisualizationV2Chart({
      ChartDatasetConfigs: [
        { vizVersion: 1, vizConfig: null },
        { vizVersion: 2, vizConfig: { version: 2 } },
      ],
    })).toBe(false);
  });

  it("builds runtime dataset selectors from migrated vizConfig for regular charts", () => {
    const fieldsMetadata = [
      {
        id: "step",
        legacyPath: "root[].step",
        type: "number",
        label: "Step",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 10,
        type: "bar",
        mode: "chart",
        includeZeros: true,
      },
      dataset: {
        id: 42,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_bar",
        legend: "Value",
      },
    });

    const payload = createVisualizationRuntimePayload({
      id: 10,
      type: "bar",
      mode: "chart",
      includeZeros: true,
      ChartDatasetConfigs: [{
        id: "cdc_bar",
        legend: "Value",
        vizVersion: 2,
        vizConfig: migration.vizConfig,
      }],
    }, [{
      options: {
        id: 42,
        name: "Demo dataset",
        fieldsMetadata,
        fieldsSchema: {
          "root[].step": "number",
          "root[].value": "number",
        },
        conditions: [],
      },
      data: [
        { step: 1, value: 10 },
        { step: 2, value: 20 },
      ],
    }]);

    expect(payload.datasets[0].options).toMatchObject({
      xAxis: "root[].step",
      yAxis: "root[].value",
      yAxisOperation: "sum",
      legend: "Value",
    });
  });

  it("runs migrated bar charts through the V2 runtime and preserves chartData shape", () => {
    const fieldsMetadata = [
      {
        id: "step",
        legacyPath: "root[].step",
        type: "number",
        label: "Step",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 11,
        type: "bar",
        mode: "chart",
        includeZeros: true,
      },
      dataset: {
        id: 50,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_runtime_bar",
        legend: "Revenue",
        datasetColor: "#10b981",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 11,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        pointRadius: 0,
        displayLegend: false,
        ChartDatasetConfigs: [{
          id: "cdc_runtime_bar",
          legend: "Revenue",
          datasetColor: "#10b981",
          fill: false,
          pointRadius: 0,
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 50,
          name: "Revenue",
          fieldsMetadata,
          fieldsSchema: {
            "root[].step": "number",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { step: 1, value: 10 },
          { step: 2, value: 20 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.isTimeseries).toBe(false);
    expect(result.configuration.data.labels).toEqual(["1", "2"]);
    expect(result.configuration.data.datasets[0]).toMatchObject({
      label: "Revenue",
      data: [10, 20],
      borderColor: "#10b981",
    });
  });

  it("runs migrated table charts through the V2 runtime and preserves table output shape", () => {
    const fieldsMetadata = [{
      id: "orders",
      legacyPath: "root.orders[]",
      type: "array",
      label: "Orders",
    }];

    const migration = legacyToVizConfig({
      chart: {
        id: 12,
        type: "table",
        mode: "chart",
      },
      dataset: {
        id: 51,
        xAxis: "root.orders[]",
        fieldsMetadata,
        fieldsSchema: {
          "root.orders[]": "array",
        },
      },
      cdc: {
        id: "cdc_runtime_table",
        legend: "Orders Table",
        excludedFields: ["status"],
        columnsOrder: ["id", "total"],
        configuration: {
          sum: "total",
        },
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 12,
        type: "table",
        mode: "chart",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_table",
          legend: "Orders Table",
          excludedFields: ["status"],
          columnsOrder: ["id", "total"],
          configuration: {
            sum: "total",
          },
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 51,
          name: "Orders dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root.orders[]": "array",
          },
          conditions: [],
        },
        data: {
          orders: [
            { id: 1, status: "paid", total: 100 },
            { id: 2, status: "pending", total: 50 },
          ],
        },
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration["Orders Table"]).toBeDefined();
    expect(result.configuration["Orders Table"].data).toHaveLength(2);
    expect(result.configuration["Orders Table"].columns.map((column) => column.Header)).toEqual([
      "id",
      "total",
    ]);
  });

  it("runs migrated matrix charts through the V2 runtime and preserves matrix output shape", () => {
    const fieldsMetadata = [
      {
        id: "created_at",
        legacyPath: "root[].created_at",
        type: "date",
        label: "Created At",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 18,
        type: "matrix",
        mode: "chart",
        timeInterval: "day",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T23:59:59.000Z",
      },
      dataset: {
        id: 57,
        xAxis: "root[].created_at",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_runtime_matrix",
        legend: "Activity",
        datasetColor: "#0ea5e9",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 18,
        type: "matrix",
        mode: "chart",
        timeInterval: "day",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T23:59:59.000Z",
        xLabelTicks: "showAll",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_matrix",
          legend: "Activity",
          datasetColor: "#0ea5e9",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 57,
          name: "Activity dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].created_at": "date",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { created_at: "2026-03-01T12:00:00.000Z", value: 2 },
          { created_at: "2026-03-03T12:00:00.000Z", value: 5 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.isTimeseries).toBe(true);
    expect(result.configuration.data.labels).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
    expect(result.configuration.data.datasets[0]).toMatchObject({
      type: "matrix",
      label: "Activity",
    });
    expect(result.configuration.data.datasets[0].data).toEqual([
      expect.objectContaining({ x: "2026-03-01", v: 2 }),
      expect.objectContaining({ x: "2026-03-02", v: 0 }),
      expect.objectContaining({ x: "2026-03-03", v: 5 }),
    ]);
  });

  it("returns export-ready rows for migrated charts without table or chart formatting", () => {
    const fieldsMetadata = [{
      id: "orders",
      legacyPath: "root.orders[]",
      type: "array",
      label: "Orders",
    }];

    const migration = legacyToVizConfig({
      chart: {
        id: 19,
        type: "table",
        mode: "chart",
      },
      dataset: {
        id: 58,
        xAxis: "root.orders[]",
        fieldsMetadata,
        fieldsSchema: {
          "root.orders[]": "array",
        },
      },
      cdc: {
        id: "cdc_runtime_table_export",
        legend: "Orders Export",
        excludedFields: ["status"],
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 19,
        type: "table",
        mode: "chart",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_table_export",
          legend: "Orders Export",
          excludedFields: ["status"],
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 58,
          name: "Orders dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root.orders[]": "array",
          },
          conditions: [],
        },
        data: {
          orders: [
            { id: 1, status: "paid", total: 100 },
            { id: 2, status: "pending", total: 50 },
          ],
        },
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      isExport: true,
      skipParsing: false,
    });

    expect(result.configuration).toEqual({
      "Orders Export": [
        { id: 1, status: "paid", total: 100 },
        { id: 2, status: "pending", total: 50 },
      ],
    });
  });

  it("applies runtime fieldId filters through the V2 runtime", () => {
    const fieldsMetadata = [
      {
        id: "step",
        legacyPath: "root[].step",
        type: "number",
        label: "Step",
      },
      {
        id: "status",
        legacyPath: "root[].status",
        type: "string",
        label: "Status",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 13,
        type: "bar",
        mode: "chart",
        includeZeros: true,
      },
      dataset: {
        id: 52,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_runtime_status",
        legend: "Filtered revenue",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 13,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_runtime_status",
          legend: "Filtered revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 52,
          name: "Revenue",
          fieldsMetadata,
          fieldsSchema: {
            "root[].step": "number",
            "root[].status": "string",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { step: 1, status: "paid", value: 10 },
          { step: 2, status: "pending", value: 20 },
          { step: 3, status: "paid", value: 30 },
        ],
      }],
      filters: [{
        id: "status_filter",
        fieldId: "status",
        operator: "is",
        value: "paid",
      }],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["1", "3"]);
    expect(result.configuration.data.datasets[0].data).toEqual([10, 30]);
  });

  it("applies V2 question filters resolved from runtime variables", () => {
    const vizConfig = {
      version: 2,
      dimensions: [{
        id: "dimension_orders",
        fieldId: "step",
        role: "x",
      }],
      metrics: [{
        id: "metric_orders",
        fieldId: "value",
        aggregation: "sum",
        label: "Revenue",
        axis: "left",
        enabled: true,
        style: {
          color: "#2563eb",
          fillColor: "transparent",
          lineStyle: "solid",
          pointRadius: 0,
          goal: null,
        },
      }],
      filters: [{
        id: "status_question_filter",
        fieldId: "status",
        operator: "is",
        valueSource: "variable",
        value: "{{status}}",
      }],
      filterControls: [],
      sort: [],
      limit: null,
      postOperations: [],
      options: {
        includeEmptyBuckets: true,
        visualization: {
          type: "bar",
          dataMode: "series",
        },
        compatibility: {
          legacyRawChartType: "bar",
          legacyChartType: "bar",
          legacyDimensionFieldId: "step",
          legacyMetricFieldId: "value",
        },
      },
    };

    const result = runVisualizationV2({
      chart: {
        id: 14,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_runtime_question_filter",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 53,
          name: "Revenue",
          fieldsMetadata: [
            { id: "step", legacyPath: "root[].step", type: "number" },
            { id: "status", legacyPath: "root[].status", type: "string" },
            { id: "value", legacyPath: "root[].value", type: "number" },
          ],
          fieldsSchema: {
            "root[].step": "number",
            "root[].status": "string",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { step: 1, status: "paid", value: 10 },
          { step: 2, status: "pending", value: 20 },
          { step: 3, status: "paid", value: 30 },
        ],
      }],
      filters: [],
      variables: {
        status: "pending",
      },
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["2"]);
    expect(result.configuration.data.datasets[0].data).toEqual([20]);
  });

  it("applies explicit V2 date filters without relying on dataset.dateField", () => {
    const vizConfig = {
      version: 2,
      dimensions: [{
        id: "dimension_label",
        fieldId: "label",
        role: "x",
      }],
      metrics: [{
        id: "metric_value",
        fieldId: "value",
        aggregation: "sum",
        label: "Revenue",
        axis: "left",
        enabled: true,
        style: {
          color: "#2563eb",
          fillColor: "transparent",
          lineStyle: "solid",
          pointRadius: 0,
          goal: null,
        },
      }],
      filters: [],
      filterControls: [],
      sort: [],
      limit: null,
      postOperations: [],
      options: {
        includeEmptyBuckets: true,
        visualization: {
          type: "bar",
          dataMode: "series",
        },
        compatibility: {
          legacyRawChartType: "bar",
          legacyChartType: "bar",
          legacyDimensionFieldId: "label",
          legacyMetricFieldId: "value",
        },
      },
    };

    const result = runVisualizationV2({
      chart: {
        id: 15,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_runtime_date_filter",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 54,
          name: "Revenue",
          fieldsMetadata: [
            { id: "label", legacyPath: "root[].label", type: "string" },
            { id: "created_at", legacyPath: "root[].created_at", type: "date" },
            { id: "value", legacyPath: "root[].value", type: "number" },
          ],
          fieldsSchema: {
            "root[].label": "string",
            "root[].created_at": "date",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { label: "A", created_at: "2026-03-01T12:00:00.000Z", value: 10 },
          { label: "B", created_at: "2026-03-10T12:00:00.000Z", value: 20 },
          { label: "C", created_at: "2026-03-20T12:00:00.000Z", value: 30 },
        ],
      }],
      filters: [{
        id: "runtime_date_filter",
        type: "date",
        fieldId: "created_at",
        startDate: "2026-03-05T00:00:00.000Z",
        endDate: "2026-03-15T23:59:59.000Z",
      }],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["B"]);
    expect(result.configuration.data.datasets[0].data).toEqual([20]);
  });

  it("renders deterministic zero-filled timeseries labels through the VizFrame path", () => {
    const fieldsMetadata = [
      {
        id: "created_at",
        legacyPath: "root[].created_at",
        type: "date",
        label: "Created At",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 16,
        type: "line",
        mode: "chart",
        includeZeros: true,
        timeInterval: "day",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T23:59:59.000Z",
      },
      dataset: {
        id: 55,
        xAxis: "root[].created_at",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_runtime_timeseries",
        legend: "Revenue",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 16,
        type: "line",
        mode: "chart",
        includeZeros: true,
        timeInterval: "day",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T23:59:59.000Z",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_timeseries",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 55,
          name: "Revenue",
          fieldsMetadata,
          fieldsSchema: {
            "root[].created_at": "date",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { created_at: "2026-03-01T12:00:00.000Z", value: 10 },
          { created_at: "2026-03-03T12:00:00.000Z", value: 30 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.isTimeseries).toBe(true);
    expect(result.dateFormat).toBe("YYYY-MM-DD");
    expect(result.configuration.data.labels).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
    expect(result.configuration.data.datasets[0].data).toEqual([10, 0, 30]);
  });

  it("renders avg charts from the VizFrame path as single-value series", () => {
    const fieldsMetadata = [
      {
        id: "created_at",
        legacyPath: "root[].created_at",
        type: "date",
        label: "Created At",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 17,
        type: "avg",
        mode: "chart",
        timeInterval: "day",
      },
      dataset: {
        id: 56,
        xAxis: "root[].created_at",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_runtime_avg",
        legend: "Average revenue",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 17,
        type: "avg",
        mode: "chart",
        timeInterval: "day",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_avg",
          legend: "Average revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 56,
          name: "Revenue",
          fieldsMetadata,
          fieldsSchema: {
            "root[].created_at": "date",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { created_at: "2026-03-01T12:00:00.000Z", value: 10 },
          { created_at: "2026-03-02T12:00:00.000Z", value: 20 },
          { created_at: "2026-03-03T12:00:00.000Z", value: 30 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.datasets[0].data).toEqual([20]);
  });
});
