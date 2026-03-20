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

  it("falls back to row counts when a V2 chart has no explicit metric field", () => {
    const fieldsMetadata = [
      {
        id: "name",
        legacyPath: "root[].name",
        type: "string",
        label: "Name",
      },
      {
        id: "email",
        legacyPath: "root[].email",
        type: "string",
        label: "Email",
      },
      {
        id: "createdAt",
        legacyPath: "root[].createdAt",
        type: "date",
        label: "Created At",
      },
    ];

    const result = runVisualizationV2({
      chart: {
        id: 111,
        type: "line",
        mode: "chart",
        includeZeros: true,
        timeInterval: "day",
        pointRadius: 0,
        displayLegend: false,
        ChartDatasetConfigs: [{
          id: "cdc_runtime_count_fallback",
          legend: "Row count",
          datasetColor: "#2563eb",
          fill: false,
          pointRadius: 0,
          vizVersion: 2,
          vizConfig: {
            version: 2,
            dimensions: [{
              id: "dimension_primary",
              fieldId: "createdAt",
              role: "x",
              grain: "day",
            }],
            metrics: [],
            filters: [],
            sort: [],
            limit: null,
            postOperations: [],
            options: {
              includeEmptyBuckets: true,
              visualization: {
                type: "line",
                dataMode: "series",
                mode: "chart",
                subType: "timeseries",
              },
              compatibility: {
                legacyDateFieldId: "createdAt",
                legacyDimensionFieldId: "createdAt",
                legacyMetricFieldId: null,
              },
            },
          },
        }],
      },
      datasets: [{
        options: {
          id: 61,
          name: "Contacts dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].name": "string",
            "root[].email": "string",
            "root[].createdAt": "date",
          },
          conditions: [],
        },
        data: [
          { name: "Ada", email: "ada@example.com", createdAt: "2026-03-01T10:00:00Z" },
          { name: "Grace", email: "grace@example.com", createdAt: "2026-03-01T14:00:00Z" },
          { name: "Linus", email: "linus@example.com", createdAt: "2026-03-02T09:00:00Z" },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.isTimeseries).toBe(true);
    expect(result.configuration.data.labels).toEqual(["2026-03-01", "2026-03-02"]);
    expect(result.configuration.data.datasets[0]).toMatchObject({
      label: "Row count",
      data: [2, 1],
      borderColor: "#2563eb",
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

  it("ignores stale legacy dataset selectors when a V2 table uses a non-date dimension", () => {
    const result = runVisualizationV2({
      chart: {
        id: 120,
        type: "table",
        mode: "chart",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-31T23:59:59.000Z",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_table_stale_selectors",
          legend: "Connection types",
          vizVersion: 2,
          vizConfig: {
            version: 2,
            dimensions: [{
              id: "dimension_primary",
              fieldId: "type",
              role: "table",
              grain: null,
            }],
            metrics: [],
            filters: [],
            sort: [],
            limit: null,
            postOperations: [],
            options: {
              includeEmptyBuckets: true,
              visualization: {
                type: "table",
                dataMode: "table",
                mode: "chart",
                table: {
                  collectionFieldId: "type",
                },
              },
              compatibility: {
                legacyDimensionFieldId: "type",
                legacyDateFieldId: null,
                legacyMetricFieldId: null,
              },
            },
          },
        }],
      },
      datasets: [{
        options: {
          id: 59,
          name: "Connection counts",
          xAxis: "root[].createdAt",
          yAxis: "root[].count",
          dateField: "root[].createdAt",
          fieldsMetadata: [
            {
              id: "type",
              legacyPath: "root[].type",
              type: "string",
              label: "Type",
            },
            {
              id: "count",
              legacyPath: "root[].count",
              type: "number",
              label: "Count",
            },
            {
              id: "createdAt",
              legacyPath: "root[].createdAt",
              type: "date",
              label: "Created At",
            },
          ],
          fieldsSchema: {
            "root[].type": "string",
            "root[].count": "number",
            "root[].createdAt": "date",
          },
          conditions: [],
        },
        data: [
          { type: "api", count: 554 },
          { type: "mysql", count: 47 },
          { type: "googleAnalytics", count: 28 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration["Connection types"]).toBeDefined();
    expect(result.configuration["Connection types"].data).toHaveLength(3);
    expect(result.configuration["Connection types"].data[0]).toMatchObject({
      type: "api",
      count: 554,
    });
  });

  it("ignores empty exposed dataset filter values for V2 table charts", () => {
    const result = runVisualizationV2({
      chart: {
        id: 121,
        type: "table",
        mode: "chart",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_table_empty_exposed_filter",
          legend: "Connection types",
          vizVersion: 2,
          vizConfig: {
            version: 2,
            dimensions: [{
              id: "dimension_primary",
              fieldId: "root[].type",
              role: "table",
              grain: null,
            }],
            metrics: [],
            filters: [],
            sort: [],
            limit: null,
            postOperations: [],
            options: {
              includeEmptyBuckets: true,
              visualization: {
                type: "table",
                dataMode: "table",
                mode: "chart",
                table: {
                  collectionFieldId: "root[].type",
                },
              },
              compatibility: {
                legacyDimensionFieldId: "root[].type",
                legacyDateFieldId: null,
                legacyMetricFieldId: null,
                preserveDatasetConditions: true,
              },
            },
          },
        }],
      },
      datasets: [{
        options: {
          id: 60,
          name: "Connection counts",
          fieldsMetadata: [
            {
              id: "root[].type",
              legacyPath: "root[].type",
              type: "string",
              label: "Type",
            },
            {
              id: "root[].count",
              legacyPath: "root[].count",
              type: "number",
              label: "Count",
            },
          ],
          fieldsSchema: {
            "root[].type": "string",
            "root[].count": "number",
          },
          conditions: [{
            id: "dataset_filter_type_empty",
            field: "root[].type",
            operator: "is",
            value: "",
            exposed: true,
            type: "string",
            values: ["api", "mysql", "googleAnalytics"],
          }],
        },
        data: [
          { type: "api", count: 554 },
          { type: "mysql", count: 47 },
          { type: "googleAnalytics", count: 28 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration["Connection types"]).toBeDefined();
    expect(result.configuration["Connection types"].data).toHaveLength(3);
    expect(result.configuration["Connection types"].data.map((row) => row.type)).toEqual([
      "api",
      "mysql",
      "googleAnalytics",
    ]);
    expect(result.conditionsOptions).toEqual([{
      dataset_id: 60,
      conditions: [{
        id: "dataset_filter_type_empty",
        field: "root[].type",
        exposed: true,
        source: null,
        bindingId: null,
        filterId: null,
        values: ["api", "mysql", "googleAnalytics"],
      }],
    }]);
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

  it("resolves nested joined-style selector paths through the V2 runtime", () => {
    const fieldsMetadata = [
      {
        id: "company_name",
        legacyPath: "root[].company.name",
        type: "string",
        label: "Company Name",
      },
      {
        id: "revenue",
        legacyPath: "root[].revenue",
        type: "number",
        label: "Revenue",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 20,
        type: "bar",
        mode: "chart",
      },
      dataset: {
        id: 59,
        xAxis: "root[].company.name",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_joined_runtime",
        legend: "Revenue",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 20,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_joined_runtime",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 59,
          name: "Joined dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].company.name": "string",
            "root[].revenue": "number",
          },
          conditions: [],
        },
        data: [
          { company: { name: "Acme" }, revenue: 10 },
          { company: { name: "Globex" }, revenue: 20 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["Acme", "Globex"]);
    expect(result.configuration.data.datasets[0].data).toEqual([10, 20]);
  });

  it("applies dataset VariableBindings-backed conditions through the V2 runtime", () => {
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
        id: 21,
        type: "bar",
        mode: "chart",
      },
      dataset: {
        id: 60,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
        conditions: [{
          id: "dataset_binding_filter",
          field: "root[].status",
          operator: "is",
          value: "{{selected_status}}",
        }],
      },
      cdc: {
        id: "cdc_dataset_variable_runtime",
        legend: "Revenue",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 21,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_dataset_variable_runtime",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 60,
          name: "Variable dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].step": "number",
            "root[].status": "string",
            "root[].value": "number",
          },
          conditions: [{
            id: "dataset_binding_filter",
            field: "root[].status",
            operator: "is",
            value: "{{selected_status}}",
          }],
          VariableBindings: [{
            name: "selected_status",
            type: "string",
          }],
        },
        data: [
          { step: 1, status: "paid", value: 10 },
          { step: 2, status: "pending", value: 20 },
          { step: 3, status: "paid", value: 30 },
        ],
      }],
      filters: [],
      variables: {
        selected_status: "paid",
      },
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["1", "3"]);
    expect(result.configuration.data.datasets[0].data).toEqual([10, 30]);
  });

  it("applies dataset VariableBindings default values through the V2 runtime", () => {
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
        id: 22,
        type: "bar",
        mode: "chart",
      },
      dataset: {
        id: 61,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
        conditions: [{
          id: "dataset_binding_filter",
          field: "root[].status",
          operator: "is",
          value: "{{selected_status}}",
        }],
      },
      cdc: {
        id: "cdc_dataset_variable_default_runtime",
        legend: "Revenue",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 22,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_dataset_variable_default_runtime",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 61,
          name: "Variable dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].step": "number",
            "root[].status": "string",
            "root[].value": "number",
          },
          conditions: [{
            id: "dataset_binding_filter",
            field: "root[].status",
            operator: "is",
            value: "{{selected_status}}",
          }],
          VariableBindings: [{
            name: "selected_status",
            type: "string",
            default_value: "pending",
          }],
        },
        data: [
          { step: 1, status: "paid", value: 10 },
          { step: 2, status: "pending", value: 20 },
          { step: 3, status: "paid", value: 30 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["2"]);
    expect(result.configuration.data.datasets[0].data).toEqual([20]);
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

  it("emits reusable filter metadata for dataset conditions and V2 question filters", () => {
    const vizConfig = {
      version: 2,
      dimensions: [{
        id: "dimension_step",
        fieldId: "step",
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
      filters: [{
        id: "region_question_filter",
        fieldId: "region",
        operator: "is",
        valueSource: "dashboardFilter",
        bindingId: "region_binding",
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
        id: 18,
        type: "bar",
        mode: "chart",
        includeZeros: true,
        ChartDatasetConfigs: [{
          id: "cdc_runtime_filter_metadata",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 57,
          name: "Revenue",
          fieldsMetadata: [
            { id: "step", legacyPath: "root[].step", type: "number" },
            { id: "status", legacyPath: "root[].status", type: "string" },
            { id: "region", legacyPath: "root[].region", type: "string" },
            { id: "value", legacyPath: "root[].value", type: "number" },
          ],
          fieldsSchema: {
            "root[].step": "number",
            "root[].status": "string",
            "root[].region": "string",
            "root[].value": "number",
          },
          conditions: [{
            id: "dataset_status_filter",
            field: "root[].status",
            operator: "is",
            value: "paid",
            exposed: true,
          }],
        },
        data: [
          {
            step: 1,
            status: "paid",
            region: "east",
            value: 10,
          },
          {
            step: 2,
            status: "pending",
            region: "west",
            value: 20,
          },
          {
            step: 3,
            status: "paid",
            region: "west",
            value: 30,
          },
        ],
      }],
      filters: [{
        id: "region_binding",
        fieldId: "region",
        operator: "is",
        value: "west",
      }],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(result.configuration.data.labels).toEqual(["3"]);
    expect(result.configuration.data.datasets[0].data).toEqual([30]);
    expect(result.conditionsOptions).toEqual([{
      dataset_id: 57,
      conditions: [
        {
          id: "dataset_status_filter",
          field: "root[].status",
          exposed: true,
          source: null,
          bindingId: null,
          filterId: null,
          values: ["paid", "pending"],
        },
        {
          id: "v2_question_region_question_filter",
          field: "root[].region",
          exposed: false,
          source: "v2_question",
          bindingId: "region_binding",
          filterId: "region_question_filter",
          values: ["east", "west"],
        },
      ],
    }]);
  });

  it("preserves reusable filter metadata on the V2 export path", () => {
    const migration = legacyToVizConfig({
      chart: {
        id: 19,
        type: "table",
        mode: "chart",
      },
      dataset: {
        id: 58,
        xAxis: "root.orders[]",
        fieldsMetadata: [{
          id: "orders",
          legacyPath: "root.orders[]",
          type: "array",
          label: "Orders",
        }],
        fieldsSchema: {
          "root.orders[]": "array",
        },
        conditions: [{
          id: "dataset_order_status_filter",
          field: "root.orders[].status",
          operator: "is",
          value: "paid",
          exposed: true,
        }],
      },
      cdc: {
        id: "cdc_runtime_export_filters",
        legend: "Orders Export",
      },
    });

    const result = runVisualizationV2({
      chart: {
        id: 19,
        type: "table",
        mode: "chart",
        ChartDatasetConfigs: [{
          id: "cdc_runtime_export_filters",
          legend: "Orders Export",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 58,
          name: "Orders dataset",
          fieldsMetadata: [{
            id: "orders",
            legacyPath: "root.orders[]",
            type: "array",
            label: "Orders",
          }],
          fieldsSchema: {
            "root.orders[]": "array",
          },
          conditions: [{
            id: "dataset_order_status_filter",
            field: "root.orders[].status",
            operator: "is",
            value: "paid",
            exposed: true,
          }],
        },
        data: {
          orders: [
            { id: 1, status: "paid", total: 100 },
            { id: 2, status: "pending", total: 50 },
            { id: 3, status: "paid", total: 75 },
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
        { id: 3, status: "paid", total: 75 },
      ],
    });
    expect(result.conditionsOptions).toEqual([{
      dataset_id: 58,
      conditions: [{
        id: "dataset_order_status_filter",
        field: "root.orders[].status",
        exposed: true,
        source: null,
        bindingId: null,
        filterId: null,
        values: ["paid", "pending"],
      }],
    }]);
  });
});
