import { afterEach, expect, it, vi } from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const versions = require("../../modules/chartVersions");
const updateChart = require("../../modules/ai/orchestrator/tools/updateChart");

afterEach(() => vi.restoreAllMocks());

it.each([false, true])("builds an empty chart and reuses its binding (explicit visualization: %s)", async (explicitVisualization) => {
  const chart = { id: 1, project_id: 2, name: "Untitled chart", type: "line", ChartDatasetConfigs: [] };
  const transaction = {};
  vi.spyOn(db.Chart, "findByPk").mockResolvedValue(chart);
  vi.spyOn(db.Chart, "update").mockResolvedValue([1]);
  vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 2, team_id: 3 });
  vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({ id: 4, team_id: 3 });
  vi.spyOn(versions, "saveChartVersion").mockImplementation(async (_id, _context, mutate) => mutate({ transaction }));
  vi.spyOn(db.ChartDatasetConfig, "findOne").mockImplementation(async () => chart.ChartDatasetConfigs[0] || null);
  vi.spyOn(db.ChartDatasetConfig, "count").mockImplementation(async () => chart.ChartDatasetConfigs.length);
  const create = vi.spyOn(db.ChartDatasetConfig, "create").mockImplementation(async (data) => {
    const binding = { id: 5, ...data };
    chart.ChartDatasetConfigs.push(binding);
    return binding;
  });
  vi.spyOn(db.ChartDatasetConfig, "update").mockImplementation(async (data) => {
    Object.assign(chart.ChartDatasetConfigs[0], data);
    return [1];
  });
  vi.spyOn(ChartController.prototype, "findById").mockImplementation(async () => chart);
  vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);
  vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

  const payload = {
    chart_id: 1, team_id: 3, user_id: 6, dataset_id: 4,
    xAxis: "root[].month", yAxis: "root[].count", yAxisOperation: "sum",
  };
  if (explicitVisualization) {
    payload.visualization = {
      version: 2,
      layers: [{ id: "count", bindingId: "binding-1", mark: "bar", encoding: {
        category: { field: "root[].month", type: "nominal" },
        value: { field: "root[].count", type: "quantitative", aggregate: "sum" },
      } }],
    };
  }
  await updateChart(payload);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ chart_id: 1, dataset_id: 4 }), { transaction });
  expect(chart.ChartDatasetConfigs[0]).toMatchObject({ xAxis: payload.xAxis, yAxis: payload.yAxis });
  const saved = db.Chart.update.mock.calls.find(([data]) => data.visualization)[0].visualization;
  expect(saved.layers).toHaveLength(1);
  expect(String(saved.layers[0].bindingId)).toBe("5");
  delete payload.visualization;
  await updateChart(payload);
  expect(create).toHaveBeenCalledOnce();
});
