import { randomUUID } from "node:crypto";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const DatasetController = require("../../controllers/DatasetController");
const ChartController = require("../../controllers/ChartController");
const orchestrator = require("../../modules/ai/orchestrator/orchestrator");
const originalProvider = orchestrator.getChartCreationProvider;
const provider = { responses: { create: vi.fn() } };
orchestrator.getChartCreationProvider = () => ({ client: provider, model: "test" });
const creation = require("../../modules/chartCreation");
orchestrator.getChartCreationProvider = originalProvider;
const postgres = require("../../sources/plugins/postgres/postgres.plugin");
const registerRoutes = require("../../api/ChartCreationRoute");
const express = require("express");

function toolResponse(name, args) {
  return { output: [{ type: "function_call", name, arguments: JSON.stringify(args), call_id: randomUUID() }] };
}

describe("Inline chart creation", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => { vi.restoreAllMocks(); provider.responses.create.mockReset(); });

  async function fixture() {
    const team = await db.Team.create({ name: "Inline", aiEnabled: false });
    const user = await db.User.create({ name: "Editor", email: `${randomUUID()}@example.test`, password: "test-only" });
    const project = await db.Project.create({ team_id: team.id, name: "Inline", brewName: randomUUID(), ghost: false });
    const role = await db.TeamRole.create({ team_id: team.id, user_id: user.id, role: "teamOwner" });
    const dataset = await db.Dataset.create({ team_id: team.id, name: "Visits by country", project_ids: [], draft: false,
      xAxis: "root[].country", yAxis: "root[].visits", yAxisOperation: "none" });
    const read = vi.spyOn(DatasetController.prototype, "runRequest").mockResolvedValue({ data: [{ country: "GB", visits: 12 }, { country: "FR", visits: 6 }] });
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);
    const input = { requestId: randomUUID(), mode: "dataset", datasetId: dataset.id };
    const run = (body = input, chartId) => creation.run(project.id, user.id, body, chartId);
    return { team, user, project, role, dataset, input, run, read };
  }

  it("mounts with the same route contract as the server", () => {
    const app = express();
    expect(() => app.use("chartCreation", registerRoutes(app))).not.toThrow();
  });

  it("waits for saved chart data before reporting completion", async () => {
    const f = await fixture();
    let finishRender;
    let renderStarted;
    const started = new Promise((resolve) => { renderStarted = resolve; });
    ChartController.prototype.updateChartData.mockImplementation(() => {
      renderStarted();
      return new Promise((resolve) => { finishRender = resolve; });
    });
    const pending = f.run();
    await started;
    const loading = await creation.status(f.project.id, f.user.id, f.input.requestId);
    expect(loading.state).toBe("running");
    expect(loading.chartId).toBeTruthy();
    finishRender();
    expect((await pending).state).toBe("succeeded");
  });

  it("does not save an automatic world map using country names instead of codes", async () => {
    const f = await fixture();
    await f.team.update({ aiEnabled: true });
    f.read.mockResolvedValue({ data: [{ country: "United Kingdom", visits: 12 }] });
    provider.responses.create.mockResolvedValue(toolResponse("prepare_chart", {
      name: "Visits", dataset_id: f.dataset.id, type: "map",
      visualization: { version: 2, layers: [{ id: "visits", bindingId: "binding-1", mark: "map",
        encoding: { location: { field: "root[].country" }, value: { field: "root[].visits", aggregate: "sum" } },
        options: { map: { area: "world", mode: "regions" } } }] },
    }));
    const result = await f.run({ requestId: randomUUID(), mode: "prompt", prompt: "Map visits around the world" });
    expect(result.state).toBe("failed");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(0);
  });

  it("lists each dataset connection once with only its logo metadata", async () => {
    const f = await fixture();
    const connection = await db.Connection.create({ team_id: f.team.id, type: "mcp", subType: "mcp", name: "Analytics", active: true,
      schema: { mcp: { server: { icon: "https://example.test/logo.svg" }, tools: ["private"] }, secret: "hidden" } });
    const second = await db.Connection.create({ team_id: f.team.id, type: "postgres", name: "Reports", active: true });
    await db.DataRequest.bulkCreate([connection, connection, second].map((item) => ({ dataset_id: f.dataset.id, connection_id: item.id })));
    const { access } = await creation.getAccess(f.project.id, f.user.id);
    const result = await creation.searchDatasets(access, f.project.id);
    const listed = result.datasets.find((item) => item.dataset_id === f.dataset.id);
    expect(listed.connections).toHaveLength(2);
    expect(listed.connections).toContainEqual({ id: connection.id, name: "Analytics", type: "mcp", subType: "mcp", icon: "https://example.test/logo.svg" });
    expect(listed.connections).toContainEqual(expect.objectContaining({ id: second.id, type: "postgres" }));
    expect(JSON.stringify(listed)).not.toMatch(/private|hidden|schema/);
  });

  it("creates a source dataset and chart together with the server's dashboard target", async () => {
    const f = await fixture();
    await f.team.update({ aiEnabled: true });
    const connection = await db.Connection.create({ team_id: f.team.id, type: "postgres", name: "Read-only test", active: true });
    vi.spyOn(postgres.backend, "exploreReadOnly").mockResolvedValue({ rows: [{ country: "GB", visits: 12 }] });
    provider.responses.create.mockResolvedValue(toolResponse("prepare_chart", {
      project_id: f.project.id + 1000, connection_id: String(connection.id), name: "Visits", type: "bar",
      query: "SELECT country, visits FROM visits", xAxis: "root[].country", yAxis: "root[].visits", yAxisOperation: "none",
    }));
    const result = await f.run({ requestId: randomUUID(), mode: "prompt", prompt: "Visits by country" });
    expect(result.state).toBe("succeeded");
    expect((await db.Chart.findByPk(result.chartId)).project_id).toBe(f.project.id);
    const configs = await db.ChartDatasetConfig.findAll({ where: { chart_id: result.chartId } });
    expect(configs).toHaveLength(1);
    const request = await db.DataRequest.findOne({ where: { dataset_id: configs[0].dataset_id } });
    expect(request.connection_id).toBe(connection.id);
    expect(await db.Dataset.count({ where: { team_id: f.team.id } })).toBe(2);
    const sentTools = provider.responses.create.mock.calls[0][0].tools.map((tool) => tool.name);
    expect(sentTools).not.toContain("create_dashboard");
    expect(sentTools).not.toContain("create_temporary_chart");
  });

  it("repairs an empty map before saving a single chart", async () => {
    const f = await fixture();
    await f.team.update({ aiEnabled: true });
    const plan = (area) => ({ dataset_id: f.dataset.id, name: "Visits around the world", type: "map",
      visualization: { version: 2, layers: [{ id: "visits", bindingId: "binding-1", mark: "map",
        encoding: { location: { field: "root[].country" }, value: { field: "root[].visits", aggregate: "sum" } },
        options: { map: { area, mode: "regions" } } }] } });
    provider.responses.create.mockResolvedValueOnce(toolResponse("prepare_chart", plan("US")))
      .mockResolvedValueOnce(toolResponse("prepare_chart", plan("world")));
    const result = await f.run({ requestId: randomUUID(), mode: "prompt", prompt: "Map visits around the world" });
    expect(result.state).toBe("succeeded");
    expect(provider.responses.create).toHaveBeenCalledTimes(2);
    const chart = await db.Chart.findByPk(result.chartId);
    expect(chart.type).toBe("map");
    expect(chart.visualization.layers[0].options.map.area).toBe("world");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(1);
  });

  it("rolls back a new source dataset when chart placement fails", async () => {
    const f = await fixture();
    await f.team.update({ aiEnabled: true });
    const connection = await db.Connection.create({ team_id: f.team.id, type: "postgres", active: true });
    vi.spyOn(postgres.backend, "exploreReadOnly").mockResolvedValue({ rows: [{ visits: 12 }] });
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockRejectedValue(new Error("Placement failed"));
    provider.responses.create.mockResolvedValue(toolResponse("prepare_chart", { connection_id: String(connection.id), name: "Visits", type: "kpi", query: "SELECT 12 AS visits", yAxis: "root[].visits", yAxisOperation: "none" }));
    expect((await f.run({ requestId: randomUUID(), mode: "prompt", prompt: "Total visits" })).state).toBe("failed");
    expect(await db.Dataset.count({ where: { team_id: f.team.id } })).toBe(1);
    expect(await db.DataRequest.count({ where: { connection_id: connection.id } })).toBe(0);
  });

  it("keeps a chosen dataset fixed and stops when the model tries another one", async () => {
    const f = await fixture();
    await f.team.update({ aiEnabled: true });
    provider.responses.create.mockResolvedValue(toolResponse("prepare_chart", { dataset_id: String(f.dataset.id + 1), name: "Other", type: "kpi" }));
    expect((await f.run({ ...f.input, mode: "prompt", prompt: "Total visits" })).state).toBe("failed");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(0);
  });

  it("saves one real chart, reuses its dataset, and returns the same result on retry", async () => {
    const f = await fixture();
    const result = await f.run();
    expect(result.state).toBe("succeeded");
    const chart = await db.Chart.findByPk(result.chartId);
    expect({ draft: chart.draft, onReport: chart.onReport, project: chart.project_id }).toEqual({ draft: false, onReport: true, project: f.project.id });
    expect(await f.run()).toEqual(result);
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(1);
    expect((await f.dataset.reload()).project_ids).toContain(f.project.id);
    expect((await f.project.reload()).layoutOrder).toContain(String(chart.id));
  });

  it("keeps the saved chart ID on edits and rejects stale edits", async () => {
    const f = await fixture();
    const saved = await f.run();
    expect(saved.state).toBe("succeeded");
    const settings = await creation.details(f.project.id, f.user.id, saved.chartId);
    const edit = { requestId: randomUUID(), mode: "settings", expectedVersion: settings.version, choices: { name: "Countries" } };
    const result = await f.run(edit, saved.chartId);
    expect(result.state).toBe("succeeded");
    expect(result.chartId).toBe(saved.chartId);
    expect((await db.Chart.findByPk(saved.chartId)).name).toBe("Countries");
    expect(await f.run(edit, saved.chartId)).toEqual(result);
    expect((await f.run({ ...edit, requestId: randomUUID() }, saved.chartId)).state).toBe("failed");
  });

  it("does not leave a chart or dataset link when final placement fails", async () => {
    const f = await fixture();
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockRejectedValue(new Error("Placement failed"));
    expect((await f.run()).state).toBe("failed");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(0);
    expect((await f.dataset.reload()).project_ids).toEqual([]);
  });

  it("does not save after cancellation wins the race", async () => {
    const f = await fixture();
    let release;
    let entered;
    const reading = new Promise((resolve) => { entered = resolve; });
    f.read.mockImplementationOnce(() => { entered(); return new Promise((resolve) => { release = resolve; }); });
    const pending = f.run();
    await reading;
    expect((await creation.cancel(f.project.id, f.user.id, f.input.requestId)).state).toBe("cancelled");
    release({ data: [{ country: "GB", visits: 12 }] });
    expect((await pending).state).toBe("cancelled");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(0);
  });

  it("asks for missing meaning without creating records and rejects empty data", async () => {
    const f = await fixture();
    await f.dataset.update({ yAxis: null });
    expect((await f.run()).state).toBe("needs_input");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(0);
    await f.dataset.update({ yAxis: "root[].visits" });
    f.read.mockResolvedValue({ data: [] });
    expect((await f.run({ ...f.input, requestId: randomUUID() })).state).not.toBe("succeeded");
  });

  it("enforces dashboard roles and dataset access before reading data", async () => {
    const f = await fixture();
    await f.role.update({ role: "projectViewer", projects: [f.project.id] });
    await expect(f.run()).rejects.toMatchObject({ statusCode: 403 });
    await f.role.update({ role: "projectEditor" });
    await expect(f.run()).rejects.toMatchObject({ statusCode: 403 });
    expect(f.read).not.toHaveBeenCalled();
  });

  it("checks AI encoding fields against the project editor's available fields", async () => {
    const f = await fixture();
    await f.team.update({ aiEnabled: true });
    await f.role.update({ role: "projectEditor", projects: [f.project.id] });
    await f.dataset.update({ project_ids: [f.project.id] });
    await db.DatasetIntelligence.create({ dataset_id: f.dataset.id, team_id: f.team.id, status: "ready",
      profile: {
        fields: { "root[].country": { role: "dimension" }, "root[].visits": { role: "metric" } },
        usage: { metrics: [{ dashboardId: f.project.id, field: "root[].visits" }],
          dimensions: [{ dashboardId: f.project.id, field: "root[].country" }] },
      } });
    f.read.mockResolvedValue({ data: [{ country: "GB", visits: 12, privateValue: 99 }] });
    provider.responses.create.mockResolvedValue(toolResponse("prepare_chart", {
      dataset_id: f.dataset.id, name: "Visits", type: "bar",
      xAxis: "root[].country", yAxis: "root[].visits", yAxisOperation: "none",
      encoding: { category: { field: "root[].country", type: "nominal" },
        value: { field: "root[].privateValue", type: "quantitative" } },
    }));
    const result = await f.run({ requestId: randomUUID(), mode: "prompt", prompt: "Visits by country", datasetId: f.dataset.id });
    expect(result.state).toBe("failed");
    expect(result.message).toContain("available dataset field");
    expect(await db.Chart.count({ where: { project_id: f.project.id } })).toBe(0);
  });
});
