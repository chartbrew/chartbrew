import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { projectFactory } from "../factories/projectFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { userFactory } from "../factories/userFactory.js";
import { generateTestToken } from "../helpers/authHelpers.js";

const require = createRequire(import.meta.url);
let app;
let models;
let ChartController;

async function seed(report, name) {
  const team = await models.Team.create(teamFactory.build());
  const project = await models.Project.create(projectFactory.build({
    team_id: team.id, public: true, ghost: false, brewName: name,
    passwordProtected: true, password: "batch-secret",
  }));
  const chart = await models.Chart.create({ project_id: project.id, name: "Published", type: "line", draft: false, onReport: true });
  const policy = await models.SharePolicy.create({ entity_type: "Project", entity_id: project.id, visibility: "private" });
  const token = jwt.sign({ sub: { type: "Project", id: project.id, sharePolicyId: policy.id } }, process.env.CB_ENCRYPTION_KEY, { expiresIn: "1h" });
  const prefix = report ? `/project/${name}/report` : `/project/dashboard/${name}`;
  return { team, project, chart, policy, token, prefix };
}

const body = (id, variables = {}) => ({ charts: [{ chart_id: id, filters: [], variables }] });

beforeAll(async () => {
  if (!testDbManager.getSequelize()) await testDbManager.start();
  models = await getModels();
  app = await createTestApp();
  require("../../api/ProjectRoute")(app);
  ChartController = require("../../controllers/ChartController");
});
afterEach(() => vi.restoreAllMocks());

describe("public dashboard batches", () => {
  for (const report of [false, true]) {
    it(`protects ${report ? "report" : "dashboard"} configuration and batches with the same credentials`, async () => {
      const { project, chart, policy, token, prefix } = await seed(report, `batch-${report}`);
      const hidden = await models.Chart.create({ project_id: project.id, name: "Hidden", type: "line", draft: false, onReport: false });
      const draft = await models.Chart.create({ project_id: project.id, name: "Draft", type: "line", draft: true, onReport: true });
      const batch = (id, password = "batch-secret", credential = token) => request(app).post(`${prefix}/charts`)
        .set("X-Forwarded-For", report ? "198.51.100.31" : "198.51.100.30").set("pass", password).query({ token: credential }).send(body(id));
      const hydrate = vi.spyOn(ChartController.prototype, "hydratePreparedCharts");
      await request(app).get(prefix).query({ view: "configuration", token }).set("pass", "wrong").expect(403);
      await batch(chart.id, "wrong").expect(403);
      expect(hydrate).not.toHaveBeenCalled();
      const config = await request(app).get(prefix).query({ view: "configuration", token }).set("pass", "batch-secret").expect(200);
      expect(config.body.password).toBe("");
      expect(config.body.Charts.map(({ id }) => id)).toEqual([chart.id]);
      expect(config.body.Charts[0]).not.toHaveProperty("render");
      expect(hydrate).not.toHaveBeenCalled();
      await batch(chart.id).expect(200);
      await batch(hidden.id).expect(404);
      await batch(draft.id).expect(404);
      await batch(chart.id, "batch-secret", "invalid").expect(401);
      await policy.update({ visibility: "disabled" });
      await batch(chart.id).expect(403);
    });

    it(`keeps policy variables locked and excludes private data in ${report ? "reports" : "dashboards"}`, async () => {
      const { chart, policy, token, prefix } = await seed(report, `policy-${report}`);
      await policy.update({ allow_params: false, params: [{ key: "tenant", value: "locked" }] });
      const update = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue({
        id: chart.id, render: { renderer: "echarts" }, query: "private query", ChartDatasetConfigs: [{ secret: "private source" }],
      });
      const response = await request(app).post(`${prefix}/charts`).set("X-Forwarded-For", report ? "198.51.100.33" : "198.51.100.32")
        .set("pass", "batch-secret").query({ token, tenant: "url-override" }).send(body(chart.id, { tenant: "body-override" })).expect(200);
      expect(update).toHaveBeenCalledOnce();
      expect(update.mock.calls[0][2]).toMatchObject({ variables: { tenant: "locked" }, getCache: true, runtimeOnly: true });
      expect(response.body[0].chart.render.renderer).toBe("echarts");
      expect(JSON.stringify(response.body)).not.toContain("private query");
      expect(JSON.stringify(response.body)).not.toContain("private source");
      await policy.update({ expires_at: new Date(Date.now() - 1000) });
      await request(app).post(`${prefix}/charts`).set("X-Forwarded-For", report ? "198.51.100.33" : "198.51.100.32")
        .set("pass", "batch-secret").query({ token }).send(body(chart.id)).expect(401);
    });
  }

  it("keeps member scope, internal snapshot access, and chart ownership checks", async () => {
    const allowed = await seed(false, "allowed-batch");
    const restricted = await models.Project.create(projectFactory.build({
      team_id: allowed.team.id, public: false, ghost: false, brewName: "restricted-batch",
    }));
    await allowed.project.update({ public: false });
    const hidden = await models.Chart.create({ project_id: restricted.id, name: "Restricted", type: "line", draft: false, onReport: true });
    const user = await models.User.create(userFactory.build());
    await models.TeamRole.create({ user_id: user.id, team_id: allowed.team.id, role: "projectEditor", projects: [allowed.project.id] });
    const authorization = `Bearer ${generateTestToken({ id: user.id, email: user.email, name: user.name })}`;
    const batch = (name, id) => request(app).post(`/project/dashboard/${name}/charts`).set("X-Forwarded-For", "198.51.100.34").send(body(id));
    const memberResponse = await batch(allowed.project.brewName, allowed.chart.id).set("Authorization", authorization).expect(200);
    expect(memberResponse.body[0].chart.id).toBe(allowed.chart.id);
    await batch(allowed.project.brewName, hidden.id).set("Authorization", authorization).expect(404);
    await batch(restricted.brewName, hidden.id).set("Authorization", authorization).expect(401);
    const accessToken = jwt.sign({ project_id: restricted.id }, process.env.CB_ENCRYPTION_KEY, { expiresIn: "1m" });
    await batch(restricted.brewName, hidden.id).query({ accessToken }).expect(200);
    await batch(allowed.project.brewName, allowed.chart.id).query({ accessToken }).expect(401);
  });
});
