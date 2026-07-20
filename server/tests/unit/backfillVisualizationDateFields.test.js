import { describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  backfillVisualizationDateFields,
  getVisualizationTimeFields,
} = require("../../models/scripts/backfillVisualizationDateFields.js");

describe("visualization date-field backfill", () => {
  it("maps semantic time fields by binding ID", () => {
    const fields = getVisualizationTimeFields({
      layers: [{
        bindingId: "cdc-events",
        encoding: { time: { field: "root[].createdAt", type: "temporal" } },
      }, {
        bindingId: "cdc-category",
        encoding: { category: { field: "root[].type", type: "nominal" } },
      }],
    });

    expect(fields.get("cdc-events")).toBe("root[].createdAt");
    expect(fields.has("cdc-category")).toBe(false);
  });

  it("only backfills missing CDC date fields with matching time bindings", async () => {
    const bulkUpdate = vi.fn();
    const query = vi.fn()
      .mockResolvedValueOnce([{
        id: 1,
        visualization: JSON.stringify({
          layers: [{
            bindingId: "cdc-events",
            encoding: { time: { field: "root[].createdAt", type: "temporal" } },
          }],
        }),
      }])
      .mockResolvedValueOnce([{
        id: "cdc-events",
        chart_id: 1,
        dateField: null,
      }, {
        id: "cdc-existing",
        chart_id: 1,
        dateField: "root[].updatedAt",
      }]);
    const queryInterface = {
      bulkUpdate,
      queryGenerator: {
        quoteIdentifier: (column) => `\`${column}\``,
        quoteTable: (table) => `\`${table}\``,
      },
      sequelize: { query },
    };

    const report = await backfillVisualizationDateFields(queryInterface);

    expect(report).toEqual({ scanned: 2, skipped: 1, updated: 1 });
    expect(bulkUpdate).toHaveBeenCalledWith(
      "ChartDatasetConfig",
      { dateField: "root[].createdAt" },
      { id: "cdc-events" }
    );
  });
});
