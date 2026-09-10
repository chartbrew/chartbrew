import express from "express";
import request from "supertest";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const TeamController = require("../../controllers/TeamController");
const DatasetController = require("../../controllers/DatasetController");
const ChartController = require("../../controllers/ChartController");
const ChartImageController = require("../../controllers/ChartImageController");
const { normalizeImageRequest } = require("../../modules/chartImage/imageRequest");
const { createMcpError } = require("../../sources/plugins/mcp/mcp.policy");
const { getSourceById } = require("../../sources");
const { getReadyPresets, getMarkDefinition } = require("../../visualization/registry");

describe("Chartbrew MCP private server", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  async function fixture({
    allProjects = true,
    scopes = ["data:read", "data:refresh", "charts:preview", "datasets:write"],
  } = {}) {
    const team = await db.Team.create({ name: "MCP team" });
    const user = await db.User.create({
      email: "mcp-test@example.com",
      name: "MCP owner",
      password: "password",
      active: true,
    });
    const project = await db.Project.create({
      team_id: team.id,
      name: "Visible",
      brewName: "mcp-visible",
      ghost: false,
    });
    const hidden = await db.Project.create({
      team_id: team.id,
      name: "Hidden",
      brewName: "mcp-hidden",
      ghost: false,
    });
    await db.Project.create({
      team_id: team.id,
      name: "Previews",
      brewName: "mcp-previews",
      ghost: true,
    });
    const role = await db.TeamRole.create({
      team_id: team.id,
      user_id: user.id,
      role: "teamOwner",
      projects: [project.id],
    });
    const key = await new TeamController().createApiKey(team.id, user, {
      name: "MCP test",
      scopes,
      allProjects,
      projectIds: allProjects ? [] : [project.id],
    });
    const connection = await db.Connection.create({
      team_id: team.id,
      type: "postgres",
      name: "Orders",
      host: "localhost",
      project_ids: [project.id],
    });
    const dataset = await db.Dataset.create({
      team_id: team.id,
      name: "Orders",
      project_ids: [project.id],
      draft: false,
    });
    await db.Dataset.create({
      team_id: team.id,
      name: "Hidden data",
      project_ids: [hidden.id],
      draft: false,
    });
    const app = express();
    app.use(express.json());
    require("../../api/McpRoute")(app);
    const rpc = (method, params, token = key.token) =>
      request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${token}`)
        .set("Accept", "application/json, text/event-stream")
        .set("Mcp-Method", method)
        .set("Mcp-Name", params?.name || "")
        .set("MCP-Protocol-Version", "2026-07-28")
        .send({
          jsonrpc: "2.0",
          id: 1,
          method,
          params: {
            ...params,
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        });
    const call = (name, args) => rpc("tools/call", { name, arguments: args });
    return { app, team, user, project, hidden, key, role, connection, dataset, rpc, call };
  }

  it("serves discovery, six bounded tools, and scope-filtered definitions without sessions", async () => {
    const { rpc, key } = await fixture();
    const discovery = await rpc("server/discover", {});
    expect(discovery.status).toBe(200);
    expect(discovery.headers["mcp-session-id"]).toBeUndefined();
    const list = await rpc("tools/list", {});
    expect(list.body.result.tools.map((tool) => tool.name)).toEqual([
      "search_workspace",
      "get_workspace_activity",
      "run_dataset",
      "get_chart_data",
      "create_chart_preview",
      "explore_data",
    ]);
    expect(JSON.stringify(list.body.result).length).toBeLessThanOrEqual(8000);
    expect(
      list.body.result.tools.find((tool) => tool.name === "create_chart_preview").inputSchema
        .properties.type.enum
    ).toEqual(
      getReadyPresets()
        .filter((preset) => getMarkDefinition(preset.mark)?.bindingRequired !== false)
        .map((preset) => preset.id)
    );
    await db.Apikey.update({ scopes: ["data:read"] }, { where: { id: key.id } });
    const readList = await rpc("tools/list", {});
    expect(readList.body.result.tools.some((tool) => tool.name === "create_chart_preview")).toBe(
      false
    );
  });

  it("rejects invalid and revoked keys, unsafe origins, invalid arguments, and unsupported HTTP methods", async () => {
    const { app, rpc, key, call } = await fixture();
    expect((await rpc("tools/list", {}, "wrong")).status).toBe(401);
    expect((await request(app).get("/mcp")).status).toBe(405);
    expect(
      (await request(app).post("/mcp").set("Origin", "https://untrusted.example").send({})).status
    ).toBe(403);
    const invalid = await call("run_dataset", { datasetId: -1, teamId: 999 });
    expect(Boolean(invalid.body.error || invalid.body.result?.isError)).toBe(true);
    await db.Apikey.destroy({ where: { id: key.id } });
    expect((await rpc("tools/list", {})).status).toBe(401);
  });

  it("supports legacy initialization and rechecks the key owner's role", async () => {
    const { app, key, call, role } = await fixture();
    const initialized = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${key.token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      });
    expect(initialized.status).toBe(200);
    const response = initialized.body.result
      ? initialized.body
      : JSON.parse(
          initialized.text
            .split("\n")
            .find((line) => line.startsWith("data: "))
            .slice(6)
        );
    expect(response.result.serverInfo.name).toBe("Chartbrew");
    await role.update({ role: "projectViewer" });
    expect((await call("explore_data", { operation: "inspect" })).body.result.isError).toBe(true);
  });

  it("executes bounded read-only SQL against the isolated test database", async () => {
    const { call, connection } = await fixture();
    const details = testDbManager.getConnectionDetails();
    await connection.update({
      type: details.dialect,
      host: details.host,
      port: String(details.port),
      dbName: details.database,
      username: details.username,
      password: details.password,
    });
    const result = await call("explore_data", {
      operation: "preview",
      connectionId: connection.id,
      query: "SELECT 1 AS visits UNION ALL SELECT 2 AS visits",
      limit: 1,
    });
    expect(result.body.result.structuredContent?.result).toMatchObject({ rows: [{ visits: 1 }] });
    expect(
      (
        await call("explore_data", {
          operation: "preview",
          connectionId: connection.id,
          query: "DELETE FROM Dataset",
        })
      ).body.result.isError
    ).toBe(true);
  });

  it("keeps selected-project keys inside their scope and denies raw source access", async () => {
    const { call, hidden } = await fixture({ allProjects: false });
    const result = await call("search_workspace", {});
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain("Hidden");
    expect(
      (await call("get_workspace_activity", { projectId: hidden.id })).body.result.isError
    ).toBe(true);
    expect((await call("explore_data", { operation: "inspect" })).body.result.isError).toBe(true);
  });

  it("uses Data API data, refresh permission, and response size controls", async () => {
    const { call, dataset, key } = await fixture();
    const run = vi
      .spyOn(DatasetController.prototype, "runRequest")
      .mockResolvedValue({ data: [{ country: "UK", visitors: 10 }] });
    const result = await call("run_dataset", { datasetId: dataset.id });
    expect(result.body.result.structuredContent.result.data).toEqual([
      { country: "UK", visitors: 10 },
    ]);
    expect(run).toHaveBeenCalledOnce();
    await db.Apikey.update({ scopes: ["data:read"] }, { where: { id: key.id } });
    expect(
      (await call("run_dataset", { datasetId: dataset.id, refresh: true })).body.result.isError
    ).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    vi.stubEnv("CB_DATA_API_MAX_RESPONSE_BYTES", "50");
    expect((await call("run_dataset", { datasetId: dataset.id })).body.result.isError).toBe(true);
  });

  it("validates source data before saving, requires explicit write scope, and audits without arguments", async () => {
    const { call, connection, project, key } = await fixture();
    const explore = vi
      .spyOn(getSourceById("postgres").backend, "exploreReadOnly")
      .mockResolvedValue({
        rows: [{ visits: 4 }],
        dataRequest: { query: "SELECT 4 AS visits", method: "GET" },
      });
    const args = {
      operation: "save",
      connectionId: connection.id,
      projectId: project.id,
      name: "Visits",
      query: "SELECT 4 AS visits",
    };
    const saved = await call("explore_data", args);
    expect(saved.body.result.structuredContent.result.status).toBe("saved");
    const dataset = await db.Dataset.findByPk(
      saved.body.result.structuredContent.result.dataset.id
    );
    expect(dataset.project_ids).toEqual([project.id]);
    expect((await db.DataRequest.findByPk(dataset.main_dr_id)).query).toBe(args.query);
    const logs = await db.UpdateRun.findAll({ where: { triggerType: "mcp" } });
    expect(JSON.stringify(logs)).not.toContain(args.query);
    await db.Apikey.update({ scopes: ["data:read"] }, { where: { id: key.id } });
    expect((await call("explore_data", args)).body.result.isError).toBe(true);
    expect(explore).toHaveBeenCalledOnce();
  });

  it("does not save after a timeout or an empty preview", async () => {
    const { call, connection, project } = await fixture();
    const explore = vi
      .spyOn(getSourceById("postgres").backend, "exploreReadOnly")
      .mockResolvedValue({ rows: [] });
    const args = {
      operation: "save",
      connectionId: connection.id,
      projectId: project.id,
      name: "Not saved",
      query: "SELECT 1",
    };
    expect((await call("explore_data", args)).body.result.structuredContent.result.status).toBe(
      "not_saved"
    );
    vi.stubEnv("CB_DATA_API_MAX_EXECUTION_MS", "10");
    explore.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ rows: [{ x: 1 }], dataRequest: { query: "SELECT 1" } }), 30)
        )
    );
    expect((await call("explore_data", args)).body.result.isError).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(await db.Dataset.count({ where: { name: "Not saved" } })).toBe(0);
  });

  it("creates a temporary chart and image without a public snapshot or an AI conversation", async () => {
    const { call, dataset } = await fixture();
    vi.spyOn(DatasetController.prototype, "runRequest").mockResolvedValue({
      data: [{ country: "UK", visitors: 10 }],
    });
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue({});
    const snapshot = vi.spyOn(ChartController.prototype, "takeSnapshot");
    vi.spyOn(ChartImageController.prototype, "render").mockImplementation(async (req) => {
      expect(normalizeImageRequest(req.body)).toMatchObject({ version: 1, layout: "chartOnly" });
      return Buffer.from("test PNG");
    });
    const result = await call("create_chart_preview", {
      datasetId: dataset.id,
      name: "Visits",
      type: "bar",
      horizontal: true,
      xAxis: "root[].country",
      yAxis: "root[].visitors",
      includeImage: true,
      displayLegend: false,
      dataLabels: true,
      datasetColor: "#4285F4",
      sort: "desc",
      maxRecords: 10,
      minValue: 0,
      maxValue: 100,
      yAxisOperation: "sum",
    });
    expect(result.body.result.structuredContent.result.status).toBe("preview");
    const chart = await db.Chart.findByPk(result.body.result.structuredContent.result.chart.id, {
      include: [db.Project],
    });
    expect(chart.Project.ghost).toBe(true);
    expect(result.body.result.structuredContent.result.chart.url).toMatch(
      new RegExp(`/previews/${chart.id}$`)
    );
    expect(chart.type).toBe("horizontalBar");
    expect(chart.visualization.layers[0]).toMatchObject({
      mark: "horizontalBar",
      orientation: "horizontal",
      encoding: {
        category: { field: "root[].country" },
        value: { field: "root[].visitors", aggregate: "sum" },
      },
      style: { color: "#4285F4" },
      transforms: [
        { type: "sort", direction: "desc", role: "value" },
        { type: "limit", count: 10 },
      ],
    });
    expect(chart.visualization.settings).toMatchObject({
      dataLabels: true,
      legend: { visible: false },
      minValue: 0,
      maxValue: 100,
    });
    expect(result.body.result.content[1]).toMatchObject({ type: "image", mimeType: "image/png" });
    expect(snapshot).not.toHaveBeenCalled();
    expect(await db.AiConversation.count()).toBe(0);
    expect(await db.AiUsage.count()).toBe(0);
  });

  it("creates every released dataset chart type and keeps the selected options", async () => {
    const { call, dataset } = await fixture();
    vi.spyOn(DatasetController.prototype, "runRequest").mockResolvedValue({
      data: [{ country: "UK", visitors: 10, date: "2026-09-01" }],
    });
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue({});
    const presets = getReadyPresets().filter(
      (preset) => getMarkDefinition(preset.mark)?.bindingRequired !== false
    );
    for (const preset of presets) {
      const metric = ["kpi", "avg", "gauge"].includes(preset.id);
      const result = await call("create_chart_preview", {
        datasetId: dataset.id,
        name: preset.label || preset.id,
        type: preset.id,
        ...(!metric ? { xAxis: preset.id === "matrix" ? "root[].date" : "root[].country" } : {}),
        yAxis: "root[].visitors",
        displayLegend: false,
        dataLabels: true,
        includeZeros: false,
        pointRadius: 3,
        fill: true,
        timeInterval: "month",
        stacked: true,
        minValue: 0,
        maxValue: 100,
        ranges: [{ min: 0, max: 100, label: "Visits", color: "#4285F4" }],
      });
      expect(result.body.result.structuredContent?.result.status).toBe("preview");
      const chart = await db.Chart.findByPk(result.body.result.structuredContent.result.chart.id);
      expect(chart.type).toBe(preset.id);
      expect(chart.visualization.layers[0].mark).toBe(preset.mark);
      expect(chart.visualization.settings).toMatchObject({
        dataLabels: true,
        includeZeros: false,
        timeInterval: "month",
        legend: { visible: false },
      });
    }
    for (const overrides of [
      { type: "scatter" },
      { type: "markdown" },
      { minValue: 10, maxValue: 0 },
      { ranges: [{ min: 10, max: 0 }] },
      { horizontal: "yes" },
      { datasetColor: "not-a-color" },
      { spec: { project_id: 999 } },
    ]) {
      const before = await db.Chart.count();
      const result = await call("create_chart_preview", {
        datasetId: dataset.id,
        name: "Invalid",
        type: "bar",
        xAxis: "root[].country",
        yAxis: "root[].visitors",
        ...overrides,
      });
      expect(result.body.result?.isError || Boolean(result.body.error)).toBe(true);
      expect(await db.Chart.count()).toBe(before);
    }
    const count = await call("create_chart_preview", {
      datasetId: dataset.id,
      name: "Country count",
      type: "kpi",
      yAxis: "root[].country",
      yAxisOperation: "count_unique",
    });
    expect(count.body.result.structuredContent?.result.status).toBe("preview");
  });

  it("returns a safe dataset repair action for a source failure and creates no empty preview", async () => {
    const { call, dataset } = await fixture();
    const failure = createMcpError("MCP_INVALID_ARGUMENTS", "secret query contents");
    failure.datasetId = dataset.id;
    vi.spyOn(DatasetController.prototype, "runRequest").mockRejectedValue(failure);
    const before = await db.Chart.count();
    const response = await call("create_chart_preview", {
      datasetId: dataset.id,
      name: "Visits",
      type: "bar",
      xAxis: "root[].country",
      yAxis: "root[].visitors",
    });
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.structuredContent.result.recovery).toMatchObject({
      code: "MCP_INVALID_ARGUMENTS",
      action: "dataset",
      datasetId: dataset.id,
    });
    expect(JSON.stringify(response.body)).not.toContain("secret query");
    expect(await db.Chart.count()).toBe(before);
  });
});
