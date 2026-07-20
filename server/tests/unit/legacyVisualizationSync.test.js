import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  isLegacyOwnedVisualization,
  shouldSyncLegacyCdc,
  shouldSyncLegacyChart,
} = require("../../visualization/legacyVisualizationSync.js");

describe("legacy visualization synchronization", () => {
  it("recognizes legacy-owned and unmigrated specs", () => {
    expect(isLegacyOwnedVisualization(null)).toBe(true);
    expect(isLegacyOwnedVisualization({ metadata: { migratedFrom: "legacy" } })).toBe(true);
    expect(isLegacyOwnedVisualization({ metadata: { createdBy: "visualization-editor" } })).toBe(false);
  });

  it("syncs chart presentation changes but not chart data persistence", () => {
    expect(shouldSyncLegacyChart({ stacked: true })).toBe(true);
    expect(shouldSyncLegacyChart({ timeInterval: "month" })).toBe(true);
    expect(shouldSyncLegacyChart({ chartData: { data: {} } })).toBe(false);
    expect(shouldSyncLegacyChart({ type: "bar", visualization: { version: 2 } })).toBe(false);
  });

  it("syncs legacy CDC presentation changes but not runtime condition values", () => {
    expect(shouldSyncLegacyCdc({ yAxis: "root[].revenue" })).toBe(true);
    expect(shouldSyncLegacyCdc({ formula: "${val / 100}" })).toBe(true);
    expect(shouldSyncLegacyCdc({ conditions: [] })).toBe(false);
  });
});
