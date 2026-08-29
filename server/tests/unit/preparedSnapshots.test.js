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

function buildLinePreparedData() {
  return {
    frameVersion: 1,
    generatedAt: "2026-08-20T00:00:00.000Z",
    identityVersion: 1,
    resource: { id: 43, kind: "chart" },
    results: [{
      availableSeries: [],
      bindingId: 8,
      fields: [
        { key: "category", role: "dimension", type: "nominal" },
        { key: "value", role: "measure", type: "quantitative" },
      ],
      id: "revenue",
      mark: "line",
      name: "Revenue",
      rows: [{ category: "Jan", seriesId: "series-1111111111111111", value: 10 }],
      series: [{
        id: "series-1111111111111111",
        key: "string:__default__",
        label: "Revenue",
        value: null,
      }],
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

  it("uses the native render envelope for native presets", () => {
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

    expect(rendered).not.toHaveProperty("chartData");
    expect(rendered.render).toMatchObject({
      generatedAt: "2026-08-20T00:00:00.000Z",
      renderer: "native",
      stale: false,
      version: 1,
    });
    expect(rendered.render.configuration.content).toBe("Prepared content");
  });

  it("returns ECharts with renderer-neutral metadata", () => {
    const chart = {
      id: 43,
      name: "Revenue",
      type: "line",
      visualization: {
        layers: [{
          bindingId: 8,
          encoding: {
            category: { field: "root[].month", type: "nominal" },
            value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
          },
          id: "revenue",
          mark: "line",
          name: "Revenue",
          orientation: "vertical",
          stack: "none",
          style: { color: "#048BDE" },
          transforms: [],
        }],
        settings: { legend: { visible: true } },
        status: "ready",
        version: 2,
      },
    };
    const rendered = compilePreparedRender(chart, buildLinePreparedData());

    expect(rendered.render.renderer).toBe("echarts");
    expect(rendered.render.configuration.series[0].id).toBe("series-1111111111111111");
    expect(rendered.render.metadata.series[0].id).toBe("series-1111111111111111");
    expect(rendered.render.tabularData.Revenue).toEqual([
      { Category: "Jan", Revenue: 10 },
    ]);
    expect(rendered).not.toHaveProperty("chartData");
  });

  it("validates snapshots without saving during a dry run", async () => {
    const findAll = vi.fn()
      .mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll });
    const controller = {
      prepareLegacyChartData: vi.fn().mockResolvedValue({
        preparedData: buildPreparedData(),
        snapshot: { saved: false },
      }),
    };
    const onProgress = vi.fn();

    const report = await backfillPreparedSnapshots({
      batchSize: 1,
      controller,
      dryRun: true,
      onProgress,
    });

    expect(report).toMatchObject({
      dryRun: true,
      failed: 0,
      processed: 1,
      saved: 0,
      wouldSave: 1,
      wouldInfer: 1,
    });
    expect(controller.prepareLegacyChartData).toHaveBeenCalledWith(4, { skipSave: true });
    expect(onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({
      chartId: 4,
      type: "chart_started",
    }));
    expect(onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({
      chartId: 4,
      status: "would_infer",
      type: "chart_finished",
    }));
  });

  it("continues after a chart exceeds the execution timeout", async () => {
    const findAll = vi.fn()
      .mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll });
    const controller = {
      prepareLegacyChartData: vi.fn(),
      updateChartData: vi.fn(() => new Promise(() => {})),
    };

    const report = await backfillPreparedSnapshots({
      batchSize: 1,
      controller,
      dryRun: true,
      refreshUnresolved: true,
      timeoutMs: 10,
    });

    expect(report).toMatchObject({
      failed: 1,
      processed: 1,
      timeoutMs: 10,
    });
    expect(report.failures[0]).toMatchObject({
      chartId: 4,
      message: "The request exceeded the execution time limit.",
    });
    expect(controller.prepareLegacyChartData).not.toHaveBeenCalled();
    expect(findAll).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ chartData: expect.any(Object) }),
    }));
  });

  it("uses the live source path only in unresolved refresh mode", async () => {
    const findAll = vi.fn()
      .mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll });
    const controller = {
      prepareLegacyChartData: vi.fn(),
      updateChartData: vi.fn().mockResolvedValue({
        preparedData: buildPreparedData(),
        snapshot: { saved: true },
      }),
    };

    const report = await backfillPreparedSnapshots({
      batchSize: 1,
      controller,
      refreshUnresolved: true,
    });

    expect(report).toMatchObject({
      inferred: 0,
      processed: 1,
      refreshed: 1,
      saved: 1,
    });
    expect(controller.prepareLegacyChartData).not.toHaveBeenCalled();
    expect(controller.updateChartData).toHaveBeenCalledWith(4, null, expect.objectContaining({
      noSource: false,
      skipSave: false,
    }));
  });

  it("reports oversized snapshots during a dry run", async () => {
    process.env.CB_PREPARED_SNAPSHOT_MAX_BYTES = "1";
    const findAll = vi.fn()
      .mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll });
    const controller = {
      prepareLegacyChartData: vi.fn().mockResolvedValue({
        preparedData: buildPreparedData(),
        snapshot: { saved: false },
      }),
    };

    const report = await backfillPreparedSnapshots({
      batchSize: 1,
      controller,
      dryRun: true,
    });

    expect(report).toMatchObject({
      skipped: 1,
      wouldSave: 0,
    });
    expect(report.issues).toEqual([
      expect.objectContaining({
        chartId: 4,
        maxBytes: 1,
        reason: "size_limit_exceeded",
      }),
    ]);
  });

  it("backfills missing snapshots in resumable ID order", async () => {
    const findAll = vi.fn()
      .mockResolvedValueOnce([{ id: 4 }, { id: 9 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll });
    const controller = {
      prepareLegacyChartData: vi.fn()
        .mockResolvedValueOnce({ snapshot: { saved: true } })
        .mockRejectedValueOnce(new Error("Legacy data unavailable")),
    };

    const report = await backfillPreparedSnapshots({ batchSize: 2, controller });

    expect(report).toMatchObject({
      failed: 0,
      inferred: 1,
      lastChartId: 9,
      processed: 2,
      saved: 1,
      unresolved: 1,
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
