import {
  afterEach, describe, expect, it, vi,
} from "vitest";

const db = require("../../models/models");
const TeamController = require("../../controllers/TeamController");
const ProjectController = require("../../controllers/ProjectController");
const ChartController = require("../../controllers/ChartController");
const integrations = require("../../controllers/IntegrationController");
const buildTemplate = require("../../templates/custom/builder");
const { runSourceDataRequest } = require("../../sources/runSourceDataRequest");
const { getSourceById } = require("../../sources");
const webhook = require("../../modules/alerts/webhookAlerts");
const jwt = require("jsonwebtoken");
const settings = require("../../settings-dev");

function routeHandler(routeModule, method, route) {
  const routes = new Map();
  const app = { settings };
  ["get", "post", "put", "delete"].forEach((verb) => {
    app[verb] = (path, ...handlers) => routes.set(`${verb} ${path}`, handlers);
  });
  routeModule(app);
  return routes.get(`${method} ${route}`).at(-1);
}

function response() {
  return { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("security advisory regressions", () => {
  it("rejects owner invitations at issue time and rejects previously signed owner invitations", async () => {
    const team = new TeamController();
    const create = vi.spyOn(db.TeamRole, "create");
    const issue = routeHandler(require("../../api/TeamRoute"), "post", "/team/:id/invite");
    const res = response();
    issue({ body: { role: "teamOwner" }, params: { id: 7 }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    await expect(team.addTeamRole(7, 2, "teamOwner")).rejects.toThrow("Invalid invitation role");
    await expect(team.addTeamRole(7, 2, "unknown")).rejects.toThrow("Invalid invitation role");
    expect(create).not.toHaveBeenCalled();

    const accept = routeHandler(require("../../api/TeamRoute"), "post", "/team/user/:user_id");
    const oldToken = jwt.sign({ team_id: 7, role: "teamOwner" }, settings.encryptionKey);
    const accepted = response();
    await accept({ body: { token: oldToken }, params: { user_id: "2" }, user: { id: 2 } }, accepted);
    await new Promise((resolve) => setImmediate(resolve));
    expect(accepted.status).toHaveBeenCalledWith(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps normal invitations available and rejects invalid tokens", async () => {
    const team = new TeamController();
    expect(team.isInvitableRole("teamAdmin")).toBe(true);
    expect(team.isInvitableRole("projectViewer")).toBe(true);
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue(null);
    vi.spyOn(db.TeamRole, "create").mockResolvedValue({ id: 4 });
    vi.spyOn(db.TeamRole, "findByPk").mockResolvedValue({ id: 4, role: "projectViewer" });
    await expect(team.addTeamRole(7, 2, "projectViewer")).resolves.toMatchObject({ role: "projectViewer" });
    const accept = routeHandler(require("../../api/TeamRoute"), "post", "/team/user/:user_id");
    const res = response();
    accept({ body: { token: "invalid" }, params: { user_id: "2" }, user: { id: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it.each([false, true])("applies share policy to body variables, allow_params=%s", async (allowParams) => {
    vi.spyOn(ProjectController.prototype, "findById").mockResolvedValue({ id: 1, team_id: 7, public: true });
    vi.spyOn(TeamController.prototype, "findById").mockResolvedValue({ allowReportRefresh: true });
    vi.spyOn(db.SharePolicy, "findOne").mockResolvedValue({ allow_params: allowParams, params: [{ key: "tenant", value: "public" }] });
    const update = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue({ id: 2 });
    const filter = routeHandler(require("../../api/ChartRoute"), "post", "/project/:project_id/chart/:chart_id/filter");
    await filter({ params: { project_id: "1", chart_id: "2" }, query: {}, body: { filters: [], variables: { tenant: "victim", extra: "hidden" } } }, response());
    expect(update).toHaveBeenCalledWith("2", undefined, expect.objectContaining({
      variables: allowParams ? { tenant: "victim", extra: "hidden" } : { tenant: "public" },
    }));
  });

  it("keeps dashboard variables editable for a member with project access", async () => {
    vi.spyOn(ProjectController.prototype, "findById").mockResolvedValue({ id: 1, team_id: 7, public: false });
    vi.spyOn(TeamController.prototype, "findById").mockResolvedValue({});
    vi.spyOn(TeamController.prototype, "getTeamRole").mockResolvedValue({ role: "teamAdmin" });
    const update = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue({ id: 2 });
    const filter = routeHandler(require("../../api/ChartRoute"), "post", "/project/:project_id/chart/:chart_id/filter");
    await filter({ user: { id: 3 }, params: { project_id: "1", chart_id: "2" }, query: {}, body: { filters: [], variables: { tenant: "internal" } } }, response());
    expect(update).toHaveBeenCalledWith("2", expect.any(Object), expect.objectContaining({ variables: { tenant: "internal" } }));
  });

  it("rejects foreign templates, dataset references, and connection mappings before writing", async () => {
    const templateLookup = vi.spyOn(db.Template, "findOne").mockResolvedValue(null);
    const create = vi.spyOn(db.Dataset, "create");
    const chartCreate = vi.spyOn(db.Chart, "create");
    await expect(buildTemplate(7, 1, { template_id: 2 })).rejects.toThrow("403");
    expect(templateLookup).toHaveBeenCalledWith({ where: { id: 2, team_id: 7 } });
    templateLookup.mockResolvedValue({ model: { Datasets: [{ id: 3 }], Charts: [] } });
    const datasets = vi.spyOn(db.Dataset, "findAll").mockResolvedValue([]);
    await expect(buildTemplate(7, 1, { template_id: 2, newDatasets: true })).rejects.toThrow("403");
    datasets.mockResolvedValue([{ id: 3, DataRequests: [{ connection_id: 4 }] }]);
    vi.spyOn(db.Connection, "count").mockResolvedValue(0);
    await expect(buildTemplate(7, 1, { template_id: 2, newDatasets: true, connections: { 4: 9 } })).rejects.toThrow("403");
    expect(create).not.toHaveBeenCalled();
    expect(chartCreate).not.toHaveBeenCalled();
  });

  it("checks chart bindings even when datasets are reused", async () => {
    vi.spyOn(db.Template, "findOne").mockResolvedValue({ model: { Datasets: [], Charts: [{ ChartDatasetConfigs: [{ dataset_id: 99 }] }] } });
    const datasets = vi.spyOn(db.Dataset, "findAll").mockResolvedValue([]);
    await expect(buildTemplate(7, 1, { template_id: 2, newDatasets: false })).rejects.toThrow("403");
    expect(datasets).toHaveBeenCalledWith(expect.objectContaining({ where: { id: [99], team_id: 7 } }));
  });

  it("allows same-team dataset copies with same-team connections", async () => {
    const source = { id: 3, team_id: 7, DataRequests: [{ connection_id: 4, toJSON: () => ({ id: 5, connection_id: 4 }) }], toJSON: () => ({ id: 3, team_id: 7 }) };
    vi.spyOn(db.Template, "findOne").mockResolvedValue({ model: { Datasets: [{ id: 3 }], Charts: [] } });
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([source]);
    vi.spyOn(db.Dataset, "findOne").mockResolvedValue(source);
    vi.spyOn(db.Connection, "count").mockResolvedValue(1);
    vi.spyOn(db.Dataset, "create").mockResolvedValue({ id: 10 });
    const requests = vi.spyOn(db.DataRequest, "bulkCreate").mockResolvedValue([]);
    await buildTemplate(7, 1, { template_id: 2, newDatasets: true, connections: { 4: 8 } });
    expect(requests).toHaveBeenCalledWith([{ connection_id: 8, dataset_id: 10 }]);
  });

  it("blocks previously stored foreign connections at execution time", async () => {
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({ team_id: 7 });
    const connection = vi.spyOn(db.Connection, "findByPk").mockResolvedValue({ team_id: 8 });
    const run = vi.spyOn(getSourceById("postgres").backend, "runDataRequest").mockResolvedValue({ success: true });
    const options = { connection: { id: 4, type: "postgres" }, dataRequest: { dataset_id: 3 } };
    await expect(runSourceDataRequest(options)).rejects.toThrow("403");
    expect(run).not.toHaveBeenCalled();
    connection.mockResolvedValue({ team_id: 7 });
    await expect(runSourceDataRequest(options)).resolves.toEqual({ success: true });
  });

  it("prevents generic integration writes from claiming a Slack workspace", async () => {
    const create = vi.spyOn(db.Integration, "create").mockResolvedValue({});
    await expect(integrations.create({ type: "slack", external_id: "T_VICTIM" })).rejects.toThrow("Connect Slack");
    expect(create).not.toHaveBeenCalled();
    await integrations.create({ type: "webhook", team_id: 7, name: "Alerts", external_id: "T_VICTIM", apikey_id: "secret", config: { url: "https://example.com" } });
    expect(create).toHaveBeenCalledWith({ type: "webhook", team_id: 7, name: "Alerts", config: { url: "https://example.com", slackMode: false } });
    const update = vi.fn();
    vi.spyOn(db.Integration, "findOne").mockResolvedValue({ type: "webhook", update });
    await expect(integrations.update(1, { type: "slack" }, 7)).rejects.toThrow("Integration type");
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves Slack credentials during settings edits and removes tokens from responses", async () => {
    const integration = { type: "slack", config: { bot_token: "test-secret", default_project_id: 1 }, update: vi.fn().mockResolvedValue({}) };
    vi.spyOn(db.Integration, "findOne").mockResolvedValue(integration);
    await integrations.update(1, { external_id: "T_OTHER", team_id: 8, config: { bot_token: "replaced", default_project_id: 99, allowAllChannels: true } }, 7);
    expect(integration.update).toHaveBeenCalledWith({ config: { bot_token: "test-secret", default_project_id: 1, allowAllChannels: true, allowedChannels: [] } });
    expect(integrations.toPublicIntegration({ toJSON: () => integration }).config).not.toHaveProperty("bot_token");
    expect(integration.config.bot_token).toBe("test-secret");
  });

  it("removes an existing team claim when Slack installs again", async () => {
    const slack = require("../../apps/slack/utils/slackClient");
    vi.spyOn(slack, "exchangeCodeForToken").mockResolvedValue({ team_id: "T_VICTIM", team_name: "Victim", bot_token: "new-test-token" });
    vi.spyOn(slack, "sendDM").mockResolvedValue({});
    const integration = { team_id: 7, config: { allowAllChannels: true, bot_token: "old" }, update: vi.fn().mockResolvedValue({}) };
    vi.spyOn(db.Integration, "findOrCreate").mockResolvedValue([integration, false]);
    const SlackController = require("../../apps/slack/controllers/SlackController");
    await new SlackController().handleOAuthCallback("test-code");
    expect(integration.update).toHaveBeenCalledWith(expect.objectContaining({ team_id: null, apikey_id: null }));
    expect(integration.update.mock.calls[0][0].config).not.toHaveProperty("allowAllChannels");
  });

  it("blocks private and metadata webhook targets before sending", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "false");
    const data = { chart: { name: "Test", project_id: 1 }, alert: { type: "threshold_above", rules: { value: 0 } }, alertsFound: [] };
    for (const url of ["http://127.0.0.1/test", "http://169.254.169.254/test"]) {
      await expect(webhook.send({ ...data, integration: { team_id: 7, config: { url } } })).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
    }
  });
});

describe("scheduled webhook delivery", () => {
  it("uses the same outbound checks for dashboard snapshots", async () => {
    vi.stubEnv("CB_ALLOW_PRIVATE_NETWORK_CALLS", "false");
    const snapshots = require("../../modules/snapshots");
    vi.spyOn(snapshots, "snapDashboard").mockResolvedValue("uploads/snapshots/test.png");
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({
      id: 1,
      name: "Test",
      snapshotSchedule: { integrations: [{ integration_id: "test", enabled: true }] },
    });
    vi.spyOn(db.Integration, "findAll").mockResolvedValue([
      { type: "webhook", team_id: 7, config: { url: "http://127.0.0.1/test" } },
    ]);
    const update = vi.spyOn(db.Project, "update");
    const sendSnapshot = require("../../crons/workers/sendSnapshot");
    await expect(sendSnapshot({ data: { id: 1 } })).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
    expect(update).not.toHaveBeenCalled();
  });
});
