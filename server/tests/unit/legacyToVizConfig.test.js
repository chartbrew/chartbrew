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

  it("reports unsupported chart types instead of generating a config", () => {
    const report = legacyToVizConfig({
      chart: {
        id: 12,
        type: "pie",
        mode: "chart",
      },
      dataset: {
        id: 88,
        xAxis: "root[].status",
        yAxis: "root[].id",
        yAxisOperation: "count",
      },
      cdc: {
        id: "cdc_pie",
      },
    });

    expect(report.supported).toBe(false);
    expect(report.status).toBe("unsupported");
    expect(report.vizConfig).toBeNull();
    expect(report.reasons.map((reason) => reason.code)).toContain("unsupported_chart_type");
  });
});
