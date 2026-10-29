import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const runtimeCache = require("../../modules/runtimeCache");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const readChartResults = require("../../modules/ai/orchestrator/tools/readChartResults");
const { isDashboardSummary, routeWorkspaceRequest } = require("../../modules/ai/orchestrator/runtime/deterministicRouter");
const { createFactStore, normalizeToolResult } = require("../../modules/ai/orchestrator/runtime/factNormalizer");
const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");
const { VIEWER_REPORTING_AI_TOOLS } = require("../../modules/ai/orchestrator/rolePolicy");

const chart = {
  id: 42, project_id: 7, name: "Revenue", type: "line",
  visualization: {
    version: 2, status: "ready", settings: {},
    layers: [{
      id: "revenue", bindingId: 8, mark: "line", status: "ready",
      encoding: {
        category: { field: "root[].month", type: "nominal" },
        value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
      },
    }],
  },
};
const preparedData = {
  frameVersion: 1, generatedAt: "2026-10-20T00:00:00.000Z", identityVersion: 1,
  resource: { id: 42, kind: "chart" },
  results: [{
    availableSeries: [], bindingId: 8,
    fields: [
      { key: "category", role: "dimension", type: "nominal" },
      { key: "value", role: "measure", type: "quantitative" },
    ],
    id: "revenue", mark: "line", name: "Revenue",
    rows: [
      { category: "Jan", seriesId: "series-1111111111111111", value: 10 },
      { category: "Feb", seriesId: "series-1111111111111111", value: 15 },
    ],
    series: [{ id: "series-1111111111111111", key: "string:__default__", label: "Revenue", value: null }],
    warnings: [],
  }],
  stats: {}, timezone: "UTC", version: 1, warnings: [],
};
let snapshots;
let refresh;
let runDataset;
let background;

beforeEach(() => {
  vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "projectViewer", projects: [7] });
  vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 7, name: "Sales", timezone: "UTC" });
  vi.spyOn(db.Chart, "findAll").mockResolvedValue([chart]);
  snapshots = vi.fn().mockResolvedValue([{
    id: 42, preparedData, preparedDataUpdatedAt: preparedData.generatedAt,
    preparedDataVisualizationFingerprint: "viz", preparedDataSourceFingerprint: "source",
  }]);
  vi.spyOn(db.Chart, "unscoped").mockReturnValue({ findAll: snapshots });
  vi.spyOn(runtimeCache, "buildChartFingerprints").mockResolvedValue({ visualization: "viz", source: "source" });
  refresh = vi.spyOn(ChartController.prototype, "updateChartData").mockRejectedValue(new Error("Forbidden refresh"));
  runDataset = vi.spyOn(DatasetController.prototype, "runRequest").mockRejectedValue(new Error("Forbidden dataset run"));
  background = vi.spyOn(runtimeCache, "triggerBackgroundRefresh").mockImplementation(() => { throw new Error("Forbidden refresh"); });
});

afterEach(() => {
  // These checks apply to every success and failure path.
  /* oxlint-disable vitest/no-standalone-expect */
  expect(refresh).not.toHaveBeenCalled();
  expect(runDataset).not.toHaveBeenCalled();
  expect(background).not.toHaveBeenCalled();
  /* oxlint-enable vitest/no-standalone-expect */
  vi.restoreAllMocks();
});

const payload = { team_id: 1, user_id: 2, project_id: 7 };

describe("read_chart_results", () => {
  it("reads plotted values from the saved default view without source execution", async () => {
    const result = await readChartResults(payload);
    expect(result.items[0]).toMatchObject({
      chartId: 42, status: "available", view: "saved_default", updatedAt: preparedData.generatedAt,
      sourceChanged: false,
      tables: [{ values: [[{ value: "Jan", trust: "untrusted_data" }, 10], [{ value: "Feb", trust: "untrusted_data" }, 15]] }],
    });
    expect(db.Chart.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { project_id: 7, draft: false } }));
    const facts = normalizeToolResult("read_chart_results", result, createFactStore({ visibleProjectIds: [7] }));
    expect(facts.facts[0]).toMatchObject({ factType: "chart_result", projectRef: "project:7", state: "available" });
  });

  it("returns missing results without recovery or refresh", async () => {
    snapshots.mockResolvedValue([]);
    expect((await readChartResults(payload)).items[0].status).toBe("unavailable");
    expect(runtimeCache.buildChartFingerprints).not.toHaveBeenCalled();
  });

  it("does not render an old result with changed chart settings", async () => {
    runtimeCache.buildChartFingerprints.mockResolvedValue({ visualization: "changed", source: "source" });
    expect((await readChartResults(payload)).items[0]).toMatchObject({ status: "configuration_changed" });
  });

  it("marks changed source settings without refreshing", async () => {
    runtimeCache.buildChartFingerprints.mockResolvedValue({ visualization: "viz", source: "changed" });
    expect((await readChartResults(payload)).items[0]).toMatchObject({ status: "available", sourceChanged: true });
  });

  it("rejects unavailable dashboards before loading charts", async () => {
    db.Project.findOne.mockResolvedValue(null);
    await expect(readChartResults(payload)).rejects.toThrow("not available");
    expect(db.Project.findOne.mock.calls[0][0].where.team_id).toBe(1);
    expect(db.Chart.findAll).not.toHaveBeenCalled();
    expect(snapshots).not.toHaveBeenCalled();
  });

  it("respects the narrower caller project scope", async () => {
    await expect(readChartResults({ ...payload, allowed_project_ids: [8] })).rejects.toThrow("not available");
    expect(snapshots).not.toHaveBeenCalled();
  });

  it("requires a dashboard and a valid page offset", async () => {
    await expect(readChartResults({ ...payload, project_id: null })).rejects.toThrow("Select a dashboard");
    await expect(readChartResults({ ...payload, offset: -1 })).rejects.toThrow("offset");
  });

  it("keeps the displayed KPI value and its unit", async () => {
    const metricChart = structuredClone(chart);
    metricChart.type = "kpi";
    metricChart.visualization.layers[0].mark = "kpi";
    delete metricChart.visualization.layers[0].encoding.category;
    metricChart.visualization.layers[0].encoding.value.formula = "${val}";
    const metricData = structuredClone(preparedData);
    metricData.results[0].mark = "kpi";
    metricData.results[0].fields = metricData.results[0].fields.filter((field) => field.key === "value");
    metricData.results[0].rows = [{ seriesId: "series-1111111111111111", value: 25 }];
    db.Chart.findAll.mockResolvedValue([metricChart]);
    snapshots.mockResolvedValue([{
      id: 42, preparedData: metricData, preparedDataUpdatedAt: metricData.generatedAt,
      preparedDataVisualizationFingerprint: "viz", preparedDataSourceFingerprint: "source",
    }]);
    const result = await readChartResults(payload);
    expect(result.items[0].status).toBe("available");
    expect(result.items[0].metrics[0].value.value).toContain("$");
    expect(result.items[0].metrics[0].valueNumber).toBeTypeOf("number");
  });

  it("bounds result rows and preserves their full count", async () => {
    const manyRows = structuredClone(preparedData);
    manyRows.results[0].rows = Array.from({ length: 100 }, (_, index) => ({
      category: `Category ${index}`, seriesId: "series-1111111111111111", value: index,
    }));
    snapshots.mockResolvedValue([{
      id: 42, preparedData: manyRows, preparedDataUpdatedAt: manyRows.generatedAt,
      preparedDataVisualizationFingerprint: "viz", preparedDataSourceFingerprint: "source",
    }]);
    const result = await readChartResults(payload);
    expect(result.truncated).toBe(true);
    expect(result.items[0].tables[0].rowCount).toBe(100);
    expect(result.items[0].tables[0].values).toHaveLength(30);
    expect(result.items[0].tables[0].values.at(-1)[1]).toBe(99);
  });

  it("returns the next chart page when a dashboard exceeds the limit", async () => {
    db.Chart.findAll.mockResolvedValue(Array.from({ length: 26 }, (_, index) => ({ ...chart, id: index + 1 })));
    snapshots.mockResolvedValue([]);
    const result = await readChartResults(payload);
    expect(result.items).toHaveLength(25);
    expect(result.nextOffset).toBe(25);
    expect(result.truncated).toBe(true);
    await readChartResults({ ...payload, offset: 25 });
    expect(db.Chart.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 25 }));
  });

  it("marks missing saved evidence as incomplete", async () => {
    snapshots.mockResolvedValue([]);
    const result = await readChartResults(payload);
    const normalized = normalizeToolResult("read_chart_results", result, createFactStore({ visibleProjectIds: [7] }));
    expect(normalized.coverage).toMatchObject({ complete: false, missingEvidence: ["saved_chart_results_unavailable"] });
  });

  it("returns an unavailable result when rendering fails", async () => {
    db.Chart.findAll.mockResolvedValue([{ ...chart, visualization: { version: 2, layers: [] } }]);
    const result = await readChartResults(payload);
    expect(result.items[0].status).toBe("unavailable");
    expect(result.items[0]).not.toHaveProperty("tables");
  });

  it("bounds large chart output and returns the next chart offset", async () => {
    const largeData = structuredClone(preparedData);
    largeData.results[0].rows = Array.from({ length: 30 }, (_, index) => ({
      category: `${index} ${"x".repeat(200)}`, seriesId: "series-1111111111111111", value: index,
    }));
    const charts = Array.from({ length: 25 }, (_, index) => ({ ...chart, id: index + 1 }));
    db.Chart.findAll.mockResolvedValue(charts);
    snapshots.mockResolvedValue(charts.map((entry) => ({
      id: entry.id, preparedData: largeData, preparedDataUpdatedAt: largeData.generatedAt,
      preparedDataVisualizationFingerprint: "viz", preparedDataSourceFingerprint: "source",
    })));
    const result = await readChartResults(payload);
    expect(JSON.stringify(result).length).toBeLessThan(25000);
    expect(result.items.length).toBeLessThan(25);
    expect(result.nextOffset).toBe(result.items.length);
    expect(result.items.every((item) => item.truncated)).toBe(true);
  });

  it("registers a read-only tool for viewers", async () => {
    expect(VIEWER_REPORTING_AI_TOOLS).toContain("read_chart_results");
    const tool = (await availableTools()).find((item) => item.name === "read_chart_results");
    expect(tool.parameters.required).toEqual(["project_id"]);
    expect(tool.description).toContain("Use FIRST");
  });

  it("routes dashboard summaries away from activity-only replies", () => {
    expect(isDashboardSummary("Summarize my dashboard")).toBe(true);
    expect(routeWorkspaceRequest({ message: "What happened on my dashboard?" })).toBeNull();
    expect(isDashboardSummary("Any interesting developments in the last days for Chartbrew Open?", [{ name: "Chartbrew Open" }])).toBe(true);
    expect(isDashboardSummary("Create a dashboard summary chart")).toBe(false);
  });
});
