import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const db = require("../../models/models");
const migration = require("../../models/migrations/20260820090000-add-chart-prepared-data");
const {
  compilePreparedRender,
  persistPreparedSnapshot,
} = require("../../modules/preparedSnapshot");
const {
  backfillPreparedSnapshots,
} = require("../../modules/backfillPreparedSnapshots");
const {
  getChartTimeRange,
} = require("../../modules/observations/periodAvailability");
const {
  serializePreparedDataSnapshot,
} = require("../../visualization/preparedData");

function buildPreparedData() {
  return {
    frameVersion: 1,
    generatedAt: "2026-08-20T00:00:00.000Z",
    identityVersion: 1,
    resource: { id: 42, kind: "chart" },
    results: [{
      availableSeries: [],
      bindingId: 7,
      fields: [{ key: "content", role: "dimension", type: "nominal" }],
      id: "notes",
      mark: "markdown",
      name: "Notes",
      rows: [{ content: "Prepared content" }],
      series: [],
      sourceOptions: { legend: "Notes" },
      warnings: [],
    }],
    stats: {},
    timezone: "UTC",
    version: 1,
    warnings: [],
  };
}

afterEach(() => {
  delete process.env.CB_PREPARED_SNAPSHOT_MAX_BYTES;
  vi.restoreAllMocks();
});

describe("prepared snapshots", () => {
  it("keeps internal preparation data in canonical snapshot serialization", () => {
    const serialized = serializePreparedDataSnapshot(buildPreparedData());
    expect(JSON.parse(serialized).results[0]).toMatchObject({
      bindingId: 7,
      sourceOptions: { legend: "Notes" },
    });
  });

  it("does not replace the durable snapshot when the size limit is exceeded", async () => {
    process.env.CB_PREPARED_SNAPSHOT_MAX_BYTES = "1";
    const update = vi.fn();
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ update });

    const result = await persistPreparedSnapshot({
      chartId: 42,
      fingerprints: { combined: "c", source: "s", visualization: "v" },
      preparedData: buildPreparedData(),
    });

    expect(result).toMatchObject({ reason: "size_limit_exceeded", saved: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("stores the prepared snapshot and its split fingerprints", async () => {
    process.env.CB_PREPARED_SNAPSHOT_MAX_BYTES = "100000";
    const update = vi.fn().mockResolvedValue([1]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ update });

    const result = await persistPreparedSnapshot({
      chartId: 42,
      fingerprints: { combined: "c", source: "s", visualization: "v" },
      preparedData: buildPreparedData(),
    });

    expect(result.saved).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      preparedDataFingerprint: "c",
      preparedDataSourceFingerprint: "s",
      preparedDataVisualizationFingerprint: "v",
    }), expect.objectContaining({ where: { id: 42 } }));
  });

  it("compiles Chart.js at read time and keeps chartData as the response alias", () => {
    const chart = {
      content: "Legacy content",
      id: 42,
      name: "Notes",
      type: "markdown",
      visualization: {
        layers: [{
          encoding: {},
          id: "notes",
          mark: "markdown",
          name: "Notes",
          status: "ready",
        }],
        settings: {},
        status: "ready",
        version: 2,
      },
    };
    const rendered = compilePreparedRender(chart, buildPreparedData(), {
      updatedAt: "2026-08-20T00:00:00.000Z",
    });

    expect(rendered.chartData).toBe(rendered.render.configuration);
    expect(rendered.render).toMatchObject({
      generatedAt: "2026-08-20T00:00:00.000Z",
      renderer: "chartjs",
      stale: false,
      version: 1,
    });
    expect(rendered.chartData.content).toBe("Prepared content");
  });

  it("backfills missing snapshots in resumable ID order", async () => {
    const findAll = vi.fn()
      .mockResolvedValueOnce([{ id: 4 }, { id: 9 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll });
    const controller = {
      updateChartData: vi.fn()
        .mockResolvedValueOnce({ snapshot: { saved: true } })
        .mockRejectedValueOnce(new Error("Source unavailable")),
    };

    const report = await backfillPreparedSnapshots({ batchSize: 2, controller });

    expect(report).toMatchObject({
      failed: 1,
      lastChartId: 9,
      processed: 2,
      saved: 1,
    });
    expect(findAll).toHaveBeenNthCalledWith(1, expect.objectContaining({
      order: [["id", "ASC"]],
      where: expect.objectContaining({ preparedData: expect.any(Object) }),
    }));
  });

  it("derives observation coverage from PreparedData without renderer output", () => {
    const range = getChartTimeRange({
      preparedData: {
        results: [{
          fields: [{ key: "time", type: "temporal" }],
          rows: [{ time: "2026-08-01T00:00:00.000Z" }, {
            time: "2026-08-02T00:00:00.000Z",
          }],
        }],
      },
      timeInterval: "day",
    });

    expect(range.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });
});

describe("prepared snapshot migration", () => {
  it("adds every field only once", async () => {
    const columns = {};
    const queryInterface = {
      addColumn: vi.fn(async (_table, name) => {
        columns[name] = {};
      }),
      describeTable: vi.fn(async () => columns),
    };

    await migration.up(queryInterface);
    await migration.up(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledTimes(5);
  });
});
