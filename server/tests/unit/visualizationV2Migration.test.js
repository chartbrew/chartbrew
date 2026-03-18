import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyChartVisualizationMigrationReport,
  buildChartVisualizationMigrationReport,
  summarizeVisualizationMigrationReports,
} = require("../../modules/visualizationV2/migration.js");

describe("visualizationV2 migration", () => {
  it("builds an apply-safe report for supported legacy charts", () => {
    const chart = {
      id: 100,
      project_id: 12,
      type: "line",
      mode: "chart",
      includeZeros: true,
      timeInterval: "day",
      ChartDatasetConfigs: [{
        id: "cdc_ready",
        dataset_id: 42,
        vizVersion: 1,
        legend: "Revenue",
        Dataset: {
          id: 42,
          xAxis: "root[].created_at",
          yAxis: "root[].revenue",
          yAxisOperation: "sum",
          dateField: "root[].created_at",
          fieldsMetadata: [
            {
              id: "created_at",
              legacyPath: "root[].created_at",
              type: "date",
              label: "Created At",
            },
            {
              id: "revenue",
              legacyPath: "root[].revenue",
              type: "number",
              label: "Revenue",
            },
          ],
        },
      }],
    };

    const report = buildChartVisualizationMigrationReport(chart);

    expect(report.status).toBe("ready");
    expect(report.supported).toBe(true);
    expect(report.canApply).toBe(true);
    expect(report.cdcReports).toHaveLength(1);
    expect(report.cdcReports[0].vizConfig.metrics[0].fieldId).toBe("revenue");
  });

  it("blocks charts that already contain mixed legacy and V2 CDC versions", () => {
    const chart = {
      id: 101,
      project_id: 12,
      type: "line",
      mode: "chart",
      ChartDatasetConfigs: [
        {
          id: "cdc_v1",
          dataset_id: 42,
          vizVersion: 1,
          Dataset: {
            id: 42,
            xAxis: "root[].created_at",
            yAxis: "root[].revenue",
            yAxisOperation: "sum",
          },
        },
        {
          id: "cdc_v2",
          dataset_id: 43,
          vizVersion: 2,
          vizConfig: { version: 2, dimensions: [], metrics: [] },
          Dataset: {
            id: 43,
            xAxis: "root[].created_at",
            yAxis: "root[].count",
            yAxisOperation: "count",
          },
        },
      ],
    };

    const report = buildChartVisualizationMigrationReport(chart);

    expect(report.status).toBe("unsupported");
    expect(report.canApply).toBe(false);
    expect(report.reasons.map((reason) => reason.code)).toContain("mixed_viz_versions");
  });

  it("applies a ready migration report by updating all CDCs", async () => {
    const update = vi.fn(async () => null);
    const chart = {
      id: 102,
      project_id: 12,
      type: "bar",
      mode: "chart",
      includeZeros: true,
      ChartDatasetConfigs: [{
        id: "cdc_apply",
        dataset_id: 44,
        vizVersion: 1,
        update,
        Dataset: {
          id: 44,
          xAxis: "root[].status",
          yAxis: "root[].id",
          yAxisOperation: "count",
          fieldsSchema: {
            "root[].status": "string",
            "root[].id": "number",
          },
        },
      }],
    };

    const report = buildChartVisualizationMigrationReport(chart);
    const result = await applyChartVisualizationMigrationReport(chart, report);

    expect(result).toEqual({
      chartId: 102,
      appliedCdcCount: 1,
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({
      vizVersion: 2,
      vizConfig: expect.objectContaining({
        version: 2,
        metrics: [expect.objectContaining({ aggregation: "count" })],
      }),
    });
  });

  it("summarizes chart-level migration results", () => {
    const summary = summarizeVisualizationMigrationReports([
      {
        status: "ready",
        cdcReports: [{ status: "ready" }, { status: "ready" }],
      },
      {
        status: "already_migrated",
        cdcReports: [{ status: "already_migrated" }],
      },
      {
        status: "unsupported",
        cdcReports: [{ status: "unsupported" }],
      },
    ]);

    expect(summary).toEqual({
      chartCount: 3,
      readyChartCount: 1,
      alreadyMigratedChartCount: 1,
      unsupportedChartCount: 1,
      cdcCount: 4,
      readyCdcCount: 2,
      alreadyMigratedCdcCount: 1,
      unsupportedCdcCount: 1,
    });
  });
});
