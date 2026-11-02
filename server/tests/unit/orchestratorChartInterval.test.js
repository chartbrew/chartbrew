import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const chartVersions = require("../../modules/chartVersions");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const updateChart = require("../../modules/ai/orchestrator/tools/updateChart");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const createDashboardChart = require("../../modules/ai/orchestrator/tools/createDashboardChart");
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");

describe("AI chart intervals", () => {
  let createSpy;
  let originalClient;

  beforeEach(() => {
    vi.spyOn(db.AiUsage, "create").mockImplementation(async (record) => record);
    vi.spyOn(db.AiUsage, "update").mockResolvedValue([1]);
    vi.spyOn(chartVersions, "saveChartVersion").mockImplementation(async (_id, _context, save) => save({ transaction: {} }));
    originalClient = global.openaiClient;
    const dataset = { id: 20, team_id: 7, project_ids: [10], name: "Places", DataRequests: [{ id: 30 }], update: vi.fn() };
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue(dataset);
    vi.spyOn(db.Project, "findByPk").mockImplementation(async (id) => ({ id, team_id: 7, ghost: id === 11 }));
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 11, team_id: 7, ghost: true });
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({ id: 40, team_id: 7, type: "postgres" });
    vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue(dataset);
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);
    createSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs")
      .mockImplementation(async (chart) => ({ ...chart, id: 50 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.openaiClient = originalClient;
  });

  it.each([["saved", createChart], ["temporary", createTemporaryChart], ["dashboard", createDashboardChart]])("saves and renders the requested interval for %s charts", async (_name, create) => {
    const encoding = {
      time: { field: "root[].month", type: "temporal" },
      value: { field: "root[].count", type: "quantitative", aggregate: "sum" },
    };
    await create({
      team_id: 7, project_id: 10, dataset_id: 20, connection_id: 40,
      name: "Monthly jobs", type: "line", timeInterval: "month", includeZeros: true,
      query: "SELECT month, count FROM jobs", encoding,
      spec: { type: "line", timeInterval: "day" },
    });
    const chart = createSpy.mock.calls[0][0];
    expect(chart.timeInterval).toBe("month");
    expect(chart.visualization.settings.timeInterval).toBe("month");
    const rendered = new VisualizationEngine({
      chart,
      datasets: [{
        bindingId: "binding-1",
        data: [{ month: "2025-01-01", count: 3 }, { month: "2025-02-01", count: 4 }],
      }],
      timezone: "America/Chicago",
    }).render();
    expect(rendered.preparedData.results[0].rows.map((row) => row.value)).toEqual([3, 4]);
    expect(rendered.configuration.dataset.source).toHaveLength(2);
  });
  it.each([false, true])("keeps monthly updates consistent with a supplied visualization: %s", async (supplied) => {
    const visualization = {
      version: 2, settings: { timeInterval: "day" },
      layers: [{
        id: "jobs", bindingId: "binding-1", mark: "line",
        encoding: {
          time: { field: "root[].month", type: "temporal" },
          value: { field: "root[].count", type: "quantitative" },
        },
      }],
    };
    const chart = {
      id: 50, project_id: 10, type: "line", timeInterval: "day", visualization,
      Project: { id: 10, name: "Jobs", ghost: false },
    };
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue(chart);
    vi.spyOn(db.Chart, "update").mockResolvedValue([1]);
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);
    await updateChart({
      team_id: 7, user_id: 1, chart_id: 50, timeInterval: "month",
      ...(supplied ? { visualization } : {}),
    });
    const saved = db.Chart.update.mock.calls.find(([fields]) => fields.visualization)[0];
    expect(saved.timeInterval).toBe("month");
    expect(saved.visualization.settings.timeInterval).toBe("month");
  });

});
