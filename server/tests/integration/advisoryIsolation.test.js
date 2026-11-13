import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createTestApp } from "../helpers/testApp.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";

const ChartController = require("../../controllers/ChartController");
const TeamController = require("../../controllers/TeamController");

describe("advisory tenant isolation", () => {
  let db;
  let app;
  let user;
  let token;
  let own;
  let foreign;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });

  beforeEach(async () => {
    app = await createTestApp();
    for (const route of ["DatasetRoute", "DataRequestRoute", "ChartRoute", "TeamRoute", "GoogleRoute"]) {
      require(`../../api/${route}`)(app);
    }
    user = await db.User.create(userFactory.build());
    token = generateTestToken({ id: user.id, email: user.email });
    const tenants = [];
    for (const name of ["Own", "Foreign"]) {
      const team = await db.Team.create({ name });
      const project = await db.Project.create({ team_id: team.id, name, brewName: name.toLowerCase() });
      const dataset = await db.Dataset.create({ team_id: team.id, project_ids: [project.id], name, draft: false });
      const connection = await db.Connection.create({ team_id: team.id, name, type: "api", host: "https://example.com" });
      const dataRequest = await db.DataRequest.create({ dataset_id: dataset.id, connection_id: connection.id, route: "/test", method: "GET" });
      const binding = await db.VariableBinding.create({ entity_type: "DataRequest", entity_id: `${dataRequest.id}`, name: "secret", type: "string", default_value: name });
      tenants.push({ team, project, dataset, connection, dataRequest, binding });
    }
    [own, foreign] = tenants;
    await db.TeamRole.create({ team_id: own.team.id, user_id: user.id, role: "teamOwner" });
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue({});
  });

  afterEach(() => vi.restoreAllMocks());

  it("takes dataset ownership from the authorized path", async () => {
    const result = await request(app).post(`/team/${own.team.id}/datasets`)
      .set("Authorization", `Bearer ${token}`)
      .send({ team_id: foreign.team.id, name: "Injected", project_ids: [] });
    expect(result.status).toBe(200);
    expect(result.body.team_id).toBe(own.team.id);
    expect(await db.Dataset.count({ where: { team_id: foreign.team.id, name: "Injected" } })).toBe(0);
  });

  it.each(["foreign", "restricted", "missing"])("rejects %s quick-create datasets without writing or running a chart", async (kind) => {
    let datasetId = foreign.dataset.id;
    if (kind === "restricted") {
      await db.TeamRole.update({ role: "projectAdmin", projects: [own.project.id] }, { where: { user_id: user.id } });
      await own.dataset.update({ project_ids: [] });
      datasetId = own.dataset.id;
    }
    if (kind === "missing") datasetId = 999999;
    const result = await request(app).post(`/project/${own.project.id}/chart/quick-create`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test", type: "table", chartDatasetConfigs: [{ dataset_id: datasetId, xAxis: "root[]" }] });
    expect(result.status).toBe(403);
    expect(await db.Chart.count()).toBe(0);
    expect(await db.ChartDatasetConfig.count()).toBe(0);
    expect(ChartController.prototype.updateChartData).not.toHaveBeenCalled();
  });

  it("keeps allowed quick-create datasets available", async () => {
    const result = await request(app).post(`/project/${own.project.id}/chart/quick-create`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test", type: "table", chartDatasetConfigs: [{ dataset_id: own.dataset.id, xAxis: "root[]" }] });
    expect(result.status).toBe(200);
    expect(await db.ChartDatasetConfig.count({ where: { dataset_id: own.dataset.id } })).toBe(1);
  });

  it("does not update foreign data request bindings", async () => {
    await request(app).put(`/team/${own.team.id}/datasets/${own.dataset.id}/dataRequests/${own.dataRequest.id}/variableBindings/${foreign.binding.id}`)
      .set("Authorization", `Bearer ${token}`).send({ default_value: "Changed" });
    expect((await foreign.binding.reload()).default_value).toBe("Foreign");
  });

  it.each(["DataRequest", "Dataset"])("keeps %s binding ownership fixed while allowing value edits", async (entityType) => {
    const entityId = entityType === "Dataset" ? own.dataset.id : own.dataRequest.id;
    await own.binding.update({ entity_type: entityType, entity_id: `${entityId}` });
    const suffix = entityType === "DataRequest" ? `/dataRequests/${own.dataRequest.id}` : "";
    const path = `/team/${own.team.id}/datasets/${own.dataset.id}${suffix}`;
    const result = await request(app).put(`${path}/variableBindings/${own.binding.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ entity_id: `${foreign.dataRequest.id}`, entity_type: "DataRequest", default_value: "Changed" });
    expect(result.status).toBe(200);
    await own.binding.reload();
    expect(own.binding.entity_id).toBe(`${entityId}`);
    expect(own.binding.entity_type).toBe(entityType);
    expect(own.binding.default_value).toBe("Changed");
  });

  it("rejects scoped Data API keys on the main API", async () => {
    const key = await new TeamController().createApiKey(own.team.id, user, {
      name: "Read only", scopes: ["data:read"], allProjects: false, projectIds: [own.project.id],
    });
    const result = await request(app).get("/team").set("Authorization", `Bearer ${key.token}`);
    expect(result.status).toBe(401);
  });

  it("blocks foreign data requests and Google connections for team owners", async () => {
    for (const path of [
      `/team/${own.team.id}/datasets/${foreign.dataset.id}/dataRequests`,
      `/team/${own.team.id}/connections/${foreign.connection.id}/google/ga/metadata`,
    ]) {
      const result = await request(app).get(path).set("Authorization", `Bearer ${token}`);
      expect(result.status).toBe(403);
    }
  });
});
