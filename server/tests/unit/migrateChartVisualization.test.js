import { describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  hydrateRow,
  migrateChartVisualization,
} = require("../../models/scripts/migrateChartVisualization.js");

function createQueryInterface({ charts, cdcs = [], datasets = [] }) {
  return {
    bulkUpdate: vi.fn().mockResolvedValue(),
    queryGenerator: {
      quoteIdentifier: vi.fn((value) => `\`${value}\``),
      quoteTable: vi.fn((value) => `\`${value}\``),
    },
    sequelize: {
      query: vi.fn()
        .mockResolvedValueOnce(charts)
        .mockResolvedValueOnce(cdcs)
        .mockResolvedValueOnce(datasets),
    },
  };
}

describe("chart visualization migration", () => {
  it("hydrates JSON-backed legacy fields before conversion", () => {
    expect(hydrateRow({
      id: 1,
      fieldsSchema: "{\"root[].total\":\"number\"}",
      fillColor: "[\"#111111\",\"#222222\"]",
      legend: "Revenue",
    })).toEqual({
      id: 1,
      fieldsSchema: { "root[].total": "number" },
      fillColor: ["#111111", "#222222"],
      legend: "Revenue",
    });
  });

  it("backfills canonical specs, preserves existing specs, and reports orphans", async () => {
    const queryInterface = createQueryInterface({
      charts: [{
        id: 1,
        type: "bar",
        visualization: null,
      }, {
        id: 2,
        type: "line",
        visualization: JSON.stringify({ version: 2, layers: [] }),
      }, {
        id: 3,
        type: "line",
        visualization: null,
      }],
      cdcs: [{
        id: "cdc-1",
        chart_id: 1,
        dataset_id: 10,
        xAxis: "root[].category",
        yAxis: "root[].amount",
        yAxisOperation: "sum",
        legend: "Amount",
        order: 1,
      }],
      datasets: [{
        id: 10,
        name: "Orders",
        fieldsSchema: JSON.stringify({
          "root[].category": "string",
          "root[].amount": "number",
        }),
      }],
    });

    const report = await migrateChartVisualization(queryInterface, { batchSize: 1 });

    expect(report).toEqual({
      draft: 0,
      failed: 0,
      failures: [],
      migrated: 2,
      orphan: 1,
      refreshed: 0,
      skipped: 1,
      total: 3,
    });
    expect(queryInterface.bulkUpdate).toHaveBeenCalledTimes(2);

    const migratedSpec = JSON.parse(queryInterface.bulkUpdate.mock.calls[0][1].visualization);
    expect(migratedSpec.version).toBe(2);
    expect(migratedSpec.layers[0].bindingId).toBe("cdc-1");
    expect(migratedSpec.layers[0].encoding.value.aggregate).toBe("sum");

    const orphanSpec = JSON.parse(queryInterface.bulkUpdate.mock.calls[1][1].visualization);
    expect(orphanSpec.status).toBe("orphan");
  });

  it("supports a dry run without writing chart rows", async () => {
    const queryInterface = createQueryInterface({
      charts: [{ id: 7, type: "line", visualization: null }],
    });

    const report = await migrateChartVisualization(queryInterface, { dryRun: true });

    expect(report.migrated).toBe(1);
    expect(report.orphan).toBe(1);
    expect(queryInterface.bulkUpdate).not.toHaveBeenCalled();
  });

  it("refreshes only legacy-owned specs and preserves native specs", async () => {
    const queryInterface = createQueryInterface({
      charts: [{
        id: 9,
        subType: "AddTimeseries",
        type: "line",
        visualization: JSON.stringify({
          version: 2,
          layers: [],
          metadata: { migratedFrom: "legacy" },
        }),
      }, {
        id: 10,
        type: "line",
        visualization: JSON.stringify({
          version: 2,
          layers: [],
          metadata: { createdBy: "visualization-editor" },
        }),
      }],
      cdcs: [{
        id: "cdc-9",
        chart_id: 9,
        dataset_id: 90,
        xAxis: "root[].month",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
      }],
      datasets: [{ id: 90, name: "Revenue" }],
    });

    const report = await migrateChartVisualization(queryInterface, {
      refreshLegacy: true,
    });

    expect(report.refreshed).toBe(1);
    expect(report.skipped).toBe(1);
    expect(report.migrated).toBe(0);
    expect(queryInterface.bulkUpdate).toHaveBeenCalledTimes(1);
    const refreshed = JSON.parse(queryInterface.bulkUpdate.mock.calls[0][1].visualization);
    expect(refreshed.layers[0].transforms[0].operation).toBe("cumulativeSum");
  });

  it("audits databases before the visualization column is added", async () => {
    const queryInterface = createQueryInterface({
      charts: [{ id: 8, type: "line" }],
    });

    await migrateChartVisualization(queryInterface, {
      dryRun: true,
      hasVisualizationColumn: false,
    });

    const chartQuery = queryInterface.sequelize.query.mock.calls[0][0];
    expect(chartQuery).not.toContain("visualization");
  });
});
