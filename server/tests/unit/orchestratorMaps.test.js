import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const createDashboardChart = require("../../modules/ai/orchestrator/tools/createDashboardChart");
const updateChart = require("../../modules/ai/orchestrator/tools/updateChart");
const suggestChart = require("../../modules/ai/orchestrator/tools/suggestChart");
const { ENTITY_CREATION_RULES } = require("../../modules/ai/orchestrator/entityCreationRules");
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");

function mapSpec(encoding, map, bindingId = "binding-1") {
  return {
    version: 2,
    layers: [{ id: "places", bindingId, mark: "map", encoding, options: { map } }],
  };
}

const regionEncoding = {
  location: { field: "root[].location.country" },
  value: { field: "root[].sales", aggregate: "sum" },
};
const pointEncoding = { point: { field: "root[].location.geo_data", type: "record" } };
const data = [
  { location: { country: "US", geo_data: { type: "Point", coordinates: [26, 44] } }, sales: 3 },
  { location: { country: "USA", geo_data: { type: "Point", coordinates: [26, 44] } }, sales: 4 },
];

function render(chart) {
  return new VisualizationEngine({
    chart,
    datasets: [{ bindingId: chart.visualization.layers[0].bindingId, data }],
  }).render();
}

describe("AI map tools", () => {
  let createSpy;
  let originalClient;

  beforeEach(() => {
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

  it("creates filled-region maps from an existing dataset and preserves nested fields", async () => {
    const result = await createChart({
      team_id: 7, project_id: 10, dataset_id: 20, name: "Sales by country", type: "map",
      visualization: mapSpec(regionEncoding, { area: "world", mode: "regions" }),
    });
    expect(result).toMatchObject({ chart_created: true, type: "map" });
    const chart = createSpy.mock.calls[0][0];
    expect(chart.visualization.layers[0].encoding).toEqual(regionEncoding);
    expect(render(chart).configuration.series[0].data).toContainEqual(
      expect.objectContaining({ name: "US", value: 7 })
    );
  });

  it.each([createTemporaryChart, createDashboardChart])("creates point maps through %s with nested GeoJSON and row counts", async (create) => {
    const result = await create({
      team_id: 7, project_id: 10, connection_id: 40, name: "Places", type: "map",
      query: "SELECT location FROM places",
      visualization: mapSpec(pointEncoding, { area: "europe", mode: "points", coordinates: "geojson" }),
    });
    expect(result).toMatchObject({ chart_created: true, type: "map" });
    const chart = createSpy.mock.calls[0][0];
    expect(chart.visualization.layers[0].options.map.area).toBe("europe");
    expect(render(chart).configuration.series[0].data[0].value).toEqual([26, 44, 2]);
  });

  it("updates a map area and changes filled regions to points without losing its binding", async () => {
    const chart = {
      id: 50, project_id: 10, type: "map", name: "Places",
      visualization: mapSpec(regionEncoding, { area: "world", mode: "regions" }, 60),
    };
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue(chart);
    vi.spyOn(db.Chart, "update").mockResolvedValue([1]);
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);
    const visualization = mapSpec(pointEncoding, { area: "RO", mode: "points", coordinates: "geojson" }, 60);
    await updateChart({ team_id: 7, chart_id: 50, type: "map", spec: {}, visualization });
    const saved = db.Chart.update.mock.calls.find(([fields]) => fields.visualization)[0].visualization;
    expect(saved.layers[0]).toMatchObject(visualization.layers[0]);
    expect(render({ ...chart, visualization: saved }).configuration.geo.map).toBe("RO");
  });

  it("keeps unrelated chart settings when a sparse update has no spec", async () => {
    const chart = {
      id: 50,
      project_id: 10,
      type: "map",
      name: "Places",
      displayLegend: false,
      includeZeros: false,
      pointRadius: 8,
      stacked: true,
      visualization: mapSpec(regionEncoding, { area: "world", mode: "regions" }, 60),
      Project: { id: 10, name: "Dashboard", ghost: false },
    };
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue(chart);
    vi.spyOn(db.Chart, "update").mockResolvedValue([1]);
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);

    const result = await updateChart({ team_id: 7, chart_id: 50, name: "Renamed" });
    const chartFieldUpdate = db.Chart.update.mock.calls.find(([fields]) => fields.name);

    expect(chartFieldUpdate[0]).toEqual({ name: "Renamed" });
    expect(result.updated_fields.chart).toEqual(["name"]);
  });

  it("rejects invalid map areas and incomplete coordinates before chart creation", async () => {
    const payload = { team_id: 7, project_id: 10, dataset_id: 20, name: "Places", type: "map" };
    await expect(createChart({
      ...payload, visualization: mapSpec(regionEncoding, { area: "Atlantis", mode: "regions" }),
    })).rejects.toThrow("available map area");
    await expect(createChart({
      ...payload, visualization: mapSpec({ latitude: { field: "root[].lat" } }, { mode: "points" }),
    })).rejects.toThrow("both latitude and longitude");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("gives chart suggestions the map rules and returns geographic encodings", async () => {
    const suggestion = { type: "map", title: "Places", encodings: pointEncoding, options: { map: { mode: "points", area: "world", coordinates: "geojson" } } };
    const completion = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(suggestion) } }] });
    global.openaiClient = { chat: { completions: { create: completion } } };
    expect(await suggestChart({ question: "Map these places", result_shape: { columns: ["location.geo_data"] } })).toEqual(suggestion);
    const prompt = completion.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("gauge, matrix, map");
    expect(prompt).toContain("GeoJSON coordinate order is longitude, latitude");
    expect(ENTITY_CREATION_RULES).toContain("visualization.layers[0].options.map");
  });
});
