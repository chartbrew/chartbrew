import { afterEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const TeamController = require("../../controllers/TeamController");
const DatasetController = require("../../controllers/DatasetController");
const ConnectionController = require("../../controllers/ConnectionController");
const ChartController = require("../../controllers/ChartController");
const ProjectController = require("../../controllers/ProjectController");
const jwt = require("jsonwebtoken");
const settings = require("../../settings");

function routes(module) {
  const result = [];
  const app = { settings };
  for (const method of ["get", "post", "put", "patch", "delete", "all"]) {
    app[method] = (path, ...handlers) => result.push({ method, path, handlers });
  }
  app.route = (path) => {
    const chain = {};
    for (const method of ["get", "post", "put", "patch", "delete", "all"]) {
      chain[method] = (...handlers) => {
        app[method](path, ...handlers);
        return chain;
      };
    }
    return chain;
  };
  require(`../../api/${module}`)(app);
  return result;
}

function response() {
  return { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

afterEach(() => vi.restoreAllMocks());

describe("November advisory checks", () => {
  it.each(["teamOwner", "teamAdmin"])("binds every data request route to the team for %s", async (role) => {
    vi.spyOn(TeamController.prototype, "getTeamRole").mockResolvedValue({ role, team_id: 1 });
    vi.spyOn(DatasetController.prototype, "findByIdAndTeam").mockRejectedValue(new Error("404"));
    for (const route of routes("DataRequestRoute")) {
      const res = response();
      const next = vi.fn();
      await route.handlers[1]({ user: { id: 1 }, params: { team_id: "1", dataset_id: "2" }, body: {} }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it.each(["teamOwner", "teamAdmin"])("binds every Google route to the team for %s", async (role) => {
    vi.spyOn(TeamController.prototype, "getTeamRole").mockResolvedValue({ role, team_id: 1 });
    vi.spyOn(ConnectionController.prototype, "findByIdAndTeam").mockRejectedValue(new Error("404"));
    for (const route of routes("GoogleRoute")) {
      const res = response();
      const next = vi.fn();
      await route.handlers[1]({ user: { id: 1 }, params: { team_id: "1", connection_id: "2" } }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it.each(["teamOwner", "teamAdmin", "projectAdmin"])("preserves same-team access for %s", async (role) => {
    vi.spyOn(TeamController.prototype, "getTeamRole").mockResolvedValue({ role, team_id: 1, projects: [3] });
    vi.spyOn(DatasetController.prototype, "findByIdAndTeam").mockResolvedValue({ team_id: 1, project_ids: [3] });
    vi.spyOn(ConnectionController.prototype, "findByIdAndTeam").mockResolvedValue({ team_id: 1, project_ids: [3] });
    for (const module of role === "projectAdmin" ? ["DataRequestRoute"] : ["DataRequestRoute", "GoogleRoute"]) {
      const next = vi.fn();
      await routes(module)[0].handlers[1]({ user: { id: 1 }, params: { team_id: "1", dataset_id: "2", connection_id: "3" }, body: {} }, response(), next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("rejects a snapshot identifier without a short-lived server credential", async () => {
    vi.spyOn(db.Chart, "findOne").mockResolvedValue({ id: 2 });
    const controller = new ChartController();
    const read = vi.spyOn(controller, "findById").mockResolvedValue({ id: 2 });
    await expect(controller.findByShareString("snapshot-id", { snapshot: "true" })).rejects.toThrow(/jwt|401/);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["wrong-chart", "expired", "wrong-purpose"])("rejects %s snapshot credentials", async (kind) => {
    vi.spyOn(db.Chart, "findOne").mockResolvedValue({ id: 2 });
    const controller = new ChartController();
    vi.spyOn(controller, "findById").mockResolvedValue({ id: 2 });
    const token = jwt.sign({ chartId: 2, snapshotToken: kind === "wrong-chart" ? "other" : "snapshot-id" }, settings.encryptionKey, {
      audience: kind === "wrong-purpose" ? "other" : "chart-snapshot", expiresIn: kind === "expired" ? -1 : 300,
    });
    await expect(controller.findByShareString("snapshot-id", { snapshot: "true", token })).rejects.toThrow(/jwt|401/);
  });

  it("accepts a bounded snapshot credential and returns only chart display fields", async () => {
    vi.spyOn(db.Chart, "findOne").mockResolvedValue({ id: 2 });
    const controller = new ChartController();
    vi.spyOn(controller, "findById").mockResolvedValue({ id: 2, name: "Chart", snapshotToken: "snapshot-id", SharePolicies: [{ id: 3 }] });
    const token = jwt.sign({ chartId: 2, snapshotToken: "snapshot-id" }, settings.encryptionKey, { audience: "chart-snapshot", expiresIn: 300 });
    const chart = await controller.findByShareString("snapshot-id", { snapshot: "true", token });
    expect(chart.id).toBe(2);
    expect(db.Chart.findOne).toHaveBeenCalledWith({ where: { id: 2, snapshotToken: "snapshot-id" } });
    expect(chart).not.toHaveProperty("snapshotToken");
    expect(chart).not.toHaveProperty("SharePolicies");
  });

  it.each(["public", "internal", "policy"])("redacts dashboard passwords with variables through %s access", async (kind) => {
    const project = db.Project.build({ id: 1, team_id: 1, public: true, passwordProtected: false });
    project.setDataValue("password", "stored-password-hash");
    vi.spyOn(ProjectController.prototype, "getPublicDashboard").mockResolvedValue(project);
    vi.spyOn(ProjectController.prototype, "applyVariablesToCharts").mockImplementation(async (value) => value.toJSON());
    const policy = { id: 3, entity_type: "Project", entity_id: 1, visibility: "private", allow_params: true };
    vi.spyOn(db.SharePolicy, "findOne").mockResolvedValue(kind === "policy" ? policy : null);
    const query = { region: "test" };
    if (kind === "internal") query.accessToken = jwt.sign({ project_id: 1 }, settings.encryptionKey, { expiresIn: 300 });
    if (kind === "policy") query.token = jwt.sign({ sub: { type: "Project", id: "1", sharePolicyId: 3 } }, settings.encryptionKey);
    const route = routes("ProjectRoute").find((entry) => entry.path === "/project/dashboard/:brewName");
    const res = response();
    await route.handlers.at(-1)({ params: { brewName: "test" }, query }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0].password).toBe("");
    expect(project.password).toBe("stored-password-hash");
  });
});

describe("chart sharing follows dashboard settings", () => {
  it.each(["legacy", "policy"])("checks visibility and passwords on %s links without changing the link", async (kind) => {
    const chart = { id: 2, project_id: 1, onReport: true, shareable: true };
    const project = { id: 1, team_id: 1, public: true };
    const policy = { id: 3, entity_type: "Chart", entity_id: 2, visibility: "private" };
    vi.spyOn(db.Chartshare, "findOne").mockResolvedValue({ chart_id: 2 });
    vi.spyOn(db.SharePolicy, "findOne").mockResolvedValue(policy);
    vi.spyOn(db.Project, "findByPk").mockResolvedValue(project);
    vi.spyOn(db.Team, "findByPk").mockResolvedValue({});
    const controller = new ChartController();
    vi.spyOn(controller, "findById").mockImplementation(async () => chart);
    const hydrate = vi.spyOn(controller, "hydratePreparedChart").mockImplementation(async (value) => value);
    const token = jwt.sign({ sub: { type: "Chart", id: "2", sharePolicyId: 3 } }, settings.encryptionKey);
    const read = (password) => kind === "legacy"
      ? controller.findByShareString("same-link", { token }, password)
      : controller.findBySharePolicy("same-link", { token }, password);
    await expect(read()).resolves.toMatchObject({ id: 2 });
    for (const [target, field] of [[project, "public"], [chart, "onReport"], [chart, "shareable"]]) {
      target[field] = false;
      hydrate.mockClear();
      await expect(read()).rejects.toBeDefined();
      expect(hydrate).not.toHaveBeenCalled();
      target[field] = true;
      await expect(read()).resolves.toMatchObject({ id: 2 });
    }
    project.passwordProtected = true;
    project.password = await require("bcrypt").hash("dashboard-password", 4);
    await expect(read()).rejects.toMatchObject({ code: "PASSWORD_REQUIRED" });
    await expect(read("wrong")).rejects.toMatchObject({ code: "PASSWORD_REQUIRED" });
    await expect(read("dashboard-password")).resolves.toMatchObject({ id: 2 });
    expect(controller._extractVariablesFromQuery({ pass: "secret", password: "secret", region: "EU" })).toEqual({ region: "EU" });
  });

  it("applies the same rules to chart-token filtering", async () => {
    const chart = { id: 2, project_id: 1, onReport: true, shareable: true };
    const project = { id: 1, team_id: 1, public: false };
    const policy = { id: 3, entity_type: "Chart", entity_id: 2, visibility: "private" };
    vi.spyOn(ProjectController.prototype, "findById").mockResolvedValue(project);
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    vi.spyOn(db.SharePolicy, "findByPk").mockResolvedValue(policy);
    const token = jwt.sign({ sub: { type: "Chart", id: "2", sharePolicyId: 3 } }, settings.encryptionKey);
    const route = routes("ChartRoute").find((entry) => entry.method === "post" && entry.path === "/project/:project_id/chart/:chart_id/filter");
    const guard = route.handlers.find((handler) => handler.name === "checkFilterAccess");
    const req = { params: { project_id: "1", chart_id: "2" }, query: { token }, headers: {} };
    const next = vi.fn();
    await guard(req, response(), next);
    expect(next).not.toHaveBeenCalled();
    project.public = true;
    project.passwordProtected = true;
    project.password = "test-password";
    await guard(req, response(), next);
    expect(next).not.toHaveBeenCalled();
    req.headers.pass = "test-password";
    await guard(req, response(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("internal chart snapshots", () => {
  it("binds a short-lived credential to the chart and keeps it out of image paths", async () => {
    const page = {
      setViewportSize: vi.fn(), goto: vi.fn(), waitForSelector: vi.fn(),
      waitForTimeout: vi.fn(), screenshot: vi.fn(),
    };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    vi.spyOn(require("playwright").chromium, "launch").mockResolvedValue(browser);
    vi.spyOn(require("fs").promises, "mkdir").mockResolvedValue(undefined);
    const identifier = "123e4567-e89b-42d3-a456-426614174000";
    const result = await require("../../modules/snapshots").snapChart(identifier, 2);
    const url = new URL(page.goto.mock.calls[0][0]);
    const token = jwt.verify(url.searchParams.get("token"), settings.encryptionKey, { audience: "chart-snapshot" });
    expect(token.chartId).toBe(2);
    expect(token.snapshotToken).toBe(identifier);
    expect(token.exp - token.iat).toBe(300);
    expect(result).toMatch(/^uploads\/snapshots\/snap-[\w-]{20}\.png$/);
    expect(result).not.toContain(identifier);
    expect(browser.close).toHaveBeenCalled();
  });
});
