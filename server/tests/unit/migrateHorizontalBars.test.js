import { createRequire } from "module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  migrateHorizontalBars,
  transformHorizontalBarChart,
} = require("../../models/scripts/migrateHorizontalBars.js");

describe("horizontal bar preset migration", () => {
  it("moves the chart, visualization, and prepared snapshot to horizontalBar", () => {
    const update = transformHorizontalBarChart({
      horizontal: true,
      preparedData: JSON.stringify({ results: [{ id: "layer-1", mark: "bar" }] }),
      type: "bar",
      visualization: JSON.stringify({
        layers: [{ id: "layer-1", mark: "bar", orientation: "horizontal" }],
        version: 2,
      }),
    });

    expect(update).toMatchObject({
      horizontal: false,
      preparedDataFingerprint: null,
      preparedDataVisualizationFingerprint: null,
      type: "horizontalBar",
    });
    expect(JSON.parse(update.visualization).layers[0]).toMatchObject({
      mark: "horizontalBar",
      orientation: "horizontal",
    });
    expect(JSON.parse(update.preparedData).results[0].mark).toBe("horizontalBar");
  });

  it("does not change vertical bars or already migrated rows", () => {
    expect(transformHorizontalBarChart({ horizontal: false, type: "bar" })).toBeNull();
    expect(transformHorizontalBarChart({ horizontal: false, type: "horizontalBar" })).toBeNull();
  });

  it("supports dry-run reports without writes", async () => {
    const queryInterface = {
      bulkUpdate: vi.fn(),
      queryGenerator: {
        quoteIdentifier: (value) => `\`${value}\``,
        quoteTable: (value) => `\`${value}\``,
      },
      sequelize: {
        query: vi.fn().mockResolvedValue([
          { horizontal: true, id: 1, type: "bar" },
          { horizontal: false, id: 2, type: "bar" },
        ]),
      },
    };

    await expect(migrateHorizontalBars(queryInterface, { dryRun: true })).resolves.toEqual({
      migrated: 1,
      skipped: 1,
      total: 2,
    });
    expect(queryInterface.bulkUpdate).not.toHaveBeenCalled();
  });

  it("reverses the preset and orientation in the down migration", () => {
    const update = transformHorizontalBarChart({
      horizontal: false,
      preparedData: { results: [{ mark: "horizontalBar" }] },
      type: "horizontalBar",
      visualization: { layers: [{ mark: "horizontalBar", orientation: "horizontal" }] },
    }, "down");

    expect(update).toMatchObject({ horizontal: true, type: "bar" });
    expect(JSON.parse(update.visualization).layers[0]).toMatchObject({
      mark: "bar",
      orientation: "horizontal",
    });
    expect(JSON.parse(update.preparedData).results[0].mark).toBe("bar");
  });
});
