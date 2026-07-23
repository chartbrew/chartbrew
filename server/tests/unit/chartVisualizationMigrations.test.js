import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const addMigration = require(
  "../../models/migrations/20260719090000-add-chart-visualization.js"
);
const refreshMigration = require(
  "../../models/migrations/20260719100000-refresh-legacy-visualization-specs.js"
);
const retryMigration = require(
  "../../models/migrations/20260723100000-retry-chart-visualization-backfill.js"
);

function createQueryInterface({ charts = [], columnExists = false, updateError = null } = {}) {
  return {
    addColumn: vi.fn().mockResolvedValue(),
    bulkUpdate: updateError
      ? vi.fn().mockRejectedValue(updateError)
      : vi.fn().mockResolvedValue(),
    describeTable: vi.fn().mockResolvedValue(
      columnExists ? { visualization: {} } : {}
    ),
    queryGenerator: {
      quoteIdentifier: vi.fn((value) => `\`${value}\``),
      quoteTable: vi.fn((value) => `\`${value}\``),
    },
    sequelize: {
      query: vi.fn()
        .mockResolvedValueOnce(charts)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    },
  };
}

describe("chart visualization migrations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resumes the initial migration when MySQL already added the column", async () => {
    const queryInterface = createQueryInterface({ columnExists: true });

    await addMigration.up(queryInterface);

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });

  it("does not block startup when individual legacy charts cannot be migrated", async () => {
    const updateError = new Error("Could not store visualization");
    const queryInterface = createQueryInterface({
      charts: [{ id: 58, type: "line", visualization: null }],
      updateError,
    });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(addMigration.up(queryInterface)).resolves.toBeUndefined();

    expect(queryInterface.addColumn).toHaveBeenCalledOnce();
    expect(stderr).toHaveBeenCalledWith(
      "[visualization migration] 1 chart specifications could not be migrated: "
      + `[{"chartId":58,"errors":["${updateError.message}"]}]\n`
    );
  });

  it("does not block the refresh migration on per-chart failures", async () => {
    const updateError = new Error("Could not refresh visualization");
    const queryInterface = createQueryInterface({
      charts: [{
        id: 59,
        type: "line",
        visualization: JSON.stringify({
          layers: [],
          metadata: { migratedFrom: "legacy" },
          version: 2,
        }),
      }],
      updateError,
    });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(refreshMigration.up(queryInterface)).resolves.toBeUndefined();

    expect(stderr).toHaveBeenCalledWith(
      "[visualization migration] 1 legacy chart specifications could not be refreshed: "
      + `[{"chartId":59,"errors":["${updateError.message}"]}]\n`
    );
  });

  it("retries missing visualizations without blocking later migrations", async () => {
    const updateError = new Error("Could not retry visualization");
    const queryInterface = createQueryInterface({
      charts: [{ id: 60, type: "line", visualization: null }],
      columnExists: true,
      updateError,
    });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(retryMigration.up(queryInterface)).resolves.toBeUndefined();

    expect(stderr).toHaveBeenCalledWith(
      "[visualization migration] 1 chart specifications still could not be migrated: "
      + `[{"chartId":60,"errors":["${updateError.message}"]}]\n`
    );
  });
});
