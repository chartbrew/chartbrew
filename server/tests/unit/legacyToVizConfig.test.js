import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { legacyToVizConfig } = require("../../modules/visualizationV2/legacyToVizConfig.js");

describe("legacyToVizConfig", () => {
  it("builds a deterministic vizConfig for supported legacy line charts", () => {
    const report = legacyToVizConfig({
      chart: {
        id: 10,
        type: "line",
        mode: "chart",
        includeZeros: true,
        timeInterval: "month",
        pointRadius: 2,
      },
      dataset: {
        id: 42,
        xAxis: "root[].created_at",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        dateFormat: "YYYY-MM-DD",
        conditions: [{ field: "root[].status", operator: "is", value: "paid" }],
        fieldsMetadata: [
          {
            id: "created_at",
            legacyPath: "root[].created_at",
            label: "Created At",
            type: "date",
          },
          {
            id: "revenue",
            legacyPath: "root[].revenue",
            label: "Revenue",
            type: "number",
          },
        ],
      },
      cdc: {
        id: "cdc_orders",
        legend: "Revenue",
        datasetColor: "#10b981",
        fillColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        pointRadius: 4,
        sort: "desc",
        maxRecords: 12,
        goal: 10000,
        formula: "${val / 100}",
      },
    });

    expect(report.supported).toBe(true);
    expect(report.status).toBe("ready");
    expect(report.vizVersion).toBe(2);
    expect(report.vizConfig).toMatchObject({
      version: 2,
      dimensions: [{
        id: "dimension_cdc_orders",
        fieldId: "created_at",
        role: "x",
        grain: "month",
      }],
      metrics: [{
        id: "metric_cdc_orders",
        fieldId: "revenue",
        aggregation: "sum",
        label: "Revenue",
        axis: "left",
        enabled: true,
        style: {
          color: "#10b981",
          fillColor: "rgba(16, 185, 129, 0.1)",
          pointRadius: 4,
          goal: 10000,
        },
      }],
      sort: [{ ref: "metric_cdc_orders", dir: "desc" }],
      limit: 12,
      postOperations: [{
        type: "formula",
        metricId: "metric_cdc_orders",
        expression: "${val / 100}",
      }],
      options: {
        includeEmptyBuckets: true,
        compatibility: {
          legacyChartType: "line",
          legacyMode: "chart",
          legacyDateFieldId: "created_at",
          legacyDateFormat: "YYYY-MM-DD",
          preserveDatasetConditions: true,
        },
      },
    });

    expect(report.warnings.map((warning) => warning.code)).toContain("dataset_conditions_preserved");
  });

  it("falls back to legacy paths when field metadata is missing", () => {
    const report = legacyToVizConfig({
      chart: {
        id: 11,
        type: "bar",
        mode: "chart",
        includeZeros: false,
      },
      dataset: {
        id: 51,
        xAxis: "root[].status",
        yAxis: "root[].id",
        yAxisOperation: "count",
        dateField: null,
        fieldsSchema: {
          "root[].status": "string",
          "root[].id": "number",
        },
      },
      cdc: {
        id: "cdc_status",
        legend: "Orders",
        sort: "asc",
      },
    });

    expect(report.supported).toBe(true);
    expect(report.vizConfig.dimensions[0]).toMatchObject({
      fieldId: "root[].status",
      role: "x",
      grain: null,
    });
    expect(report.vizConfig.metrics[0]).toMatchObject({
      fieldId: "root[].id",
      aggregation: "count",
    });
    expect(report.vizConfig.options.includeEmptyBuckets).toBe(false);
  });

  it("supports the categorical legacy chart family", () => {
    ["pie", "doughnut", "radar", "polar"].forEach((chartType) => {
      const report = legacyToVizConfig({
        chart: {
          id: 12,
          type: chartType,
          mode: "chart",
          displayLegend: true,
          dataLabels: true,
        },
        dataset: {
          id: 88,
          xAxis: "root[].status",
          yAxis: "root[].id",
          yAxisOperation: "count",
          fieldsSchema: {
            "root[].status": "string",
            "root[].id": "number",
          },
        },
        cdc: {
          id: `cdc_${chartType}`,
          legend: "Orders",
          fillColor: ["#111111", "#222222"],
        },
      });

      expect(report.supported).toBe(true);
      expect(report.status).toBe("ready");
      expect(report.summary.chartType).toBe(chartType);
      expect(report.vizConfig.metrics[0]).toMatchObject({
        fieldId: "root[].id",
        aggregation: "count",
      });
      expect(report.vizConfig.options.visualization).toMatchObject({
        type: chartType,
        dataMode: "series",
        displayLegend: true,
        dataLabels: true,
      });
    });
  });

  it("captures table chart semantics without requiring a legacy metric field", () => {
    const report = legacyToVizConfig({
      chart: {
        id: 13,
        type: "table",
        mode: "chart",
        defaultRowsPerPage: 25,
      },
      dataset: {
        id: 90,
        xAxis: "root[].orders",
        dateField: "root[].created_at",
        fieldsSchema: {
          "root[].orders": "array",
          "root[].created_at": "date",
        },
      },
      cdc: {
        id: "cdc_table",
        excludedFields: ["status"],
        columnsOrder: ["id", "status", "total"],
        configuration: {
          sum: "total",
          columnsFormatting: {
            total: { type: "currency", symbol: "$" },
          },
        },
        maxRecords: 50,
      },
    });

    expect(report.supported).toBe(true);
    expect(report.summary.chartType).toBe("table");
    expect(report.summary.metricFieldId).toBeNull();
    expect(report.vizConfig.dimensions[0]).toMatchObject({
      fieldId: "root[].orders",
      role: "table",
    });
    expect(report.vizConfig.metrics).toEqual([]);
    expect(report.vizConfig.limit).toBe(50);
    expect(report.vizConfig.options.visualization).toMatchObject({
      type: "table",
      dataMode: "table",
      defaultRowsPerPage: 25,
      table: {
        collectionFieldId: "root[].orders",
        excludedFields: ["status"],
        columnsOrder: ["id", "status", "total"],
        summaryField: "total",
      },
    });
  });

  it("captures single-value legacy chart semantics for kpi, avg, and gauge", () => {
    const kpiReport = legacyToVizConfig({
      chart: {
        id: 14,
        type: "line",
        mode: "kpi",
        showGrowth: true,
      },
      dataset: {
        id: 91,
        xAxis: "root[].created_at",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        fieldsSchema: {
          "root[].created_at": "date",
          "root[].revenue": "number",
        },
      },
      cdc: {
        id: "cdc_kpi",
        legend: "Revenue",
      },
    });

    expect(kpiReport.supported).toBe(true);
    expect(kpiReport.summary.chartType).toBe("kpi");
    expect(kpiReport.vizConfig.options.visualization).toMatchObject({
      type: "kpi",
      dataMode: "latestValue",
      showGrowth: true,
    });
    expect(kpiReport.vizConfig.options.compatibility).toMatchObject({
      legacyRawChartType: "line",
      legacyChartType: "kpi",
    });

    const avgReport = legacyToVizConfig({
      chart: {
        id: 15,
        type: "avg",
        mode: "chart",
      },
      dataset: {
        id: 92,
        xAxis: "root[].created_at",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        fieldsSchema: {
          "root[].created_at": "date",
          "root[].revenue": "number",
        },
      },
      cdc: {
        id: "cdc_avg",
      },
    });

    expect(avgReport.supported).toBe(true);
    expect(avgReport.summary.chartType).toBe("avg");
    expect(avgReport.vizConfig.options.visualization).toMatchObject({
      type: "avg",
      dataMode: "seriesAverage",
    });
    expect(avgReport.vizConfig.postOperations).toContainEqual({
      type: "seriesAverage",
      metricId: "metric_cdc_avg",
    });

    const gaugeReport = legacyToVizConfig({
      chart: {
        id: 16,
        type: "gauge",
        mode: "chart",
        ranges: [
          {
            min: 0,
            max: 50,
            label: "Low",
            color: "#0f0",
          },
          {
            min: 50,
            max: 100,
            label: "High",
            color: "#f00",
          },
        ],
      },
      dataset: {
        id: 93,
        xAxis: "root[].created_at",
        yAxis: "root[].usage",
        yAxisOperation: "avg",
        dateField: "root[].created_at",
        fieldsSchema: {
          "root[].created_at": "date",
          "root[].usage": "number",
        },
      },
      cdc: {
        id: "cdc_gauge",
      },
    });

    expect(gaugeReport.supported).toBe(true);
    expect(gaugeReport.summary.chartType).toBe("gauge");
    expect(gaugeReport.vizConfig.options.visualization).toMatchObject({
      type: "gauge",
      dataMode: "latestValue",
      ranges: [
        {
          min: 0,
          max: 50,
          label: "Low",
          color: "#0f0",
        },
        {
          min: 50,
          max: 100,
          label: "High",
          color: "#f00",
        },
      ],
    });
  });

  it("captures matrix chart semantics as a dedicated temporal heatmap view", () => {
    const report = legacyToVizConfig({
      chart: {
        id: 17,
        type: "matrix",
        mode: "chart",
        timeInterval: "day",
      },
      dataset: {
        id: 94,
        xAxis: "root[].created_at",
        yAxis: "root[].count",
        yAxisOperation: "count",
        dateField: "root[].created_at",
        fieldsMetadata: [
          {
            id: "created_at",
            legacyPath: "root[].created_at",
            type: "date",
          },
          {
            id: "count",
            legacyPath: "root[].count",
            type: "number",
          },
        ],
      },
      cdc: {
        id: "cdc_matrix",
        datasetColor: "#3b82f6",
      },
    });

    expect(report.supported).toBe(true);
    expect(report.summary.chartType).toBe("matrix");
    expect(report.vizConfig.options.visualization).toMatchObject({
      type: "matrix",
      dataMode: "weekdayHeatmap",
    });
  });
});
