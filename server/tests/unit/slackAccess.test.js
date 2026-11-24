const controller = require("../../controllers/IntegrationController");
const audit = require("../../apps/slack/audit");
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const db = require("../../models/models");
const { resolveAccount } = require("../../apps/slack/accounts");
const { getAiRoleScope } = require("../../modules/ai/orchestrator/rolePolicy");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const { authorize } = require("../../apps/slack/audit");
const { withIntegrationContext } = require("../../modules/observations/integrationContext");
const { getObservationAccess } = require("../../modules/observations/access");
const { canReadHistoryMessage } = require("../../modules/workspaceContext/accessEnvelope");
const { getMemoryContext } = require("../../modules/ai/memory");
let integration;
beforeEach(() => {
  integration = { id: "i", team_id: 7, type: "slack", config: { bot_token: "test", accessMode: "team-and-clients", dashboardIds: [1, 2] } };
  vi.spyOn(db.Integration, "findOne").mockImplementation(async () => integration);
  vi.spyOn(db.Integration, "findByPk").mockImplementation(async () => integration);
  vi.spyOn(db.SlackAccount, "findOne").mockResolvedValue({ id: "account", user_id: 4 });
  vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "projectViewer", projects: [1], Team: { aiEnabled: true } });
  vi.spyOn(db.Project, "findAll").mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  vi.spyOn(db.Team, "findByPk").mockResolvedValue({ aiEnabled: true });
});
afterEach(() => vi.restoreAllMocks());
it("intersects client permissions with selected dashboards even in everyone mode", async () => {
  integration.config.accessMode = "everyone";
  const { access, envelope } = await resolveAccount("T1", "U1");
  expect(access.projectIds).toEqual([1]);
  expect(access.allProjects).toBe(false);
  expect(envelope.visibleProjectIds).toEqual([1]);
  expect(envelope.editableProjectIds).toEqual([]);
});
it.each(["admins-only", "team"])("denies clients in %s mode", async (mode) => {
  integration.config.accessMode = mode;
  await expect(resolveAccount("T1", "U1")).rejects.toMatchObject({ statusCode: 403 });
});
it("uses no owner identity for unlinked read-only requests", async () => {
  integration.config.accessMode = "everyone";
  db.SlackAccount.findOne.mockResolvedValue(null);
  const { account, access, envelope } = await resolveAccount("T1", "U1");
  expect(account.user_id).toBeNull();
  expect(access.projectIds).toEqual([1, 2]);
  expect(envelope.editableProjectIds).toEqual([]);
  expect(envelope.canCreatePersonalKpiReview).toBe(false);
  expect(db.TeamRole.findOne).not.toHaveBeenCalled();
});
it("does not fall back to everyone after a linked membership is revoked", async () => {
  integration.config.accessMode = "everyone";
  db.TeamRole.findOne.mockResolvedValue(null);
  await expect(resolveAccount("T1", "U1")).rejects.toMatchObject({ statusCode: 403 });
});
it("grants no dashboards by default", async () => {
  integration.config.dashboardIds = [];
  expect((await resolveAccount("T1", "U1")).envelope.visibleProjectIds).toEqual([]);
});
it("limits owners to selected dashboards", async () => {
  integration.config.accessMode = "admins-only";
  db.TeamRole.findOne.mockResolvedValue({ role: "teamOwner", projects: [], Team: {} });
  const { access, envelope } = await resolveAccount("T1", "U1");
  expect(access.projectIds).toEqual([1, 2]);
  expect(access.canConfigureTeam).toBe(false);
  const { allowedToolNames } = getAiRoleScope(access, envelope);
  expect(allowedToolNames).toEqual(expect.arrayContaining(["create_chart", "create_temporary_chart"]));
  expect(allowedToolNames).not.toContain("create_dataset");
});
it("checks the current Slack dashboard and dataset before creating a chart", async () => {
  db.TeamRole.findOne.mockResolvedValue({ role: "teamOwner", Team: {} });
  const dataset = { id: 8, team_id: 7, project_ids: [1], DataRequests: [{ id: 5 }] };
  vi.spyOn(db.Dataset, "findByPk").mockResolvedValue(dataset);
  vi.spyOn(db.Project, "findByPk").mockImplementation(async (id) => ({ id, team_id: 7, ghost: false }));
  const ChartController = require("../../controllers/ChartController");
  const create = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({ id: 4, name: "Visits" });
  const payload = { team_id: 7, user_id: 4, project_id: 1, dataset_id: 8, name: "Visits", type: "line", xAxis: "day", yAxis: "visits", skipSnapshot: true };

  await withIntegrationContext({ teamId: 7, userId: 4, resolveAccess: async () => (await resolveAccount("T1", "U1")).access }, async () => {
    await expect(createChart(payload)).resolves.toMatchObject({ chart_id: 4 });
    await expect(createChart({ ...payload, project_id: 3 })).rejects.toThrow("available to your Slack account");
    dataset.project_ids = [3];
    await expect(createChart(payload)).rejects.toThrow("available to your Slack account");
    await expect(createTemporaryChart({ ...payload, dataset_id: null, connection_id: 2 })).rejects.toThrow("existing dataset");
    expect(create).toHaveBeenCalledOnce();
  });
});
it("denies client audit access", async () => {
  await expect(authorize("i", 4)).rejects.toMatchObject({ statusCode: 403 });
});
it("scopes nested reads and removes personal memory only in the integration", async () => {
  const access = { teamId: 7, userId: 4, projectIds: [1] };
  await withIntegrationContext({ teamId: 7, userId: 4, resolveAccess: async () => access }, async () => {
    expect(await getObservationAccess(7, 4)).toBe(access);
    await expect(getObservationAccess(8, 4)).rejects.toMatchObject({ statusCode: 403 });
    await expect(getObservationAccess(7, 5)).rejects.toMatchObject({ statusCode: 403 });
    expect(await getMemoryContext(7, 4)).toBeNull();
  });
  expect((await getObservationAccess(7, 4)).role).toBe("projectViewer");
});
it("shares history only inside the integration and current dashboard permissions", () => {
  const scope = { integrationId: "i", userId: 4, teamId: 7, role: "projectViewer", visibleProjectIds: [1, 2], editableProjectIds: [] };
  const message = { sensitive_workspace_context: true, workspace_access_scope: scope };
  expect(canReadHistoryMessage(message, { accessVersion: "new", historyAccessScope: { ...scope, userId: 5 } })).toBe(true);
  expect(canReadHistoryMessage(message, { accessVersion: "new", historyAccessScope: { ...scope, userId: 5, visibleProjectIds: [1] } })).toBe(false);
  expect(canReadHistoryMessage(message, { accessVersion: "new", historyAccessScope: { ...scope, integrationId: "other" } })).toBe(false);
});

it("rejects dashboards from another team during settings updates", async () => {
  integration.update = vi.fn();
  db.Project.findAll.mockResolvedValue([{ id: 1 }]);
  await expect(controller.update("i", { config: { accessMode: "everyone", dashboardIds: [2] } }, 7)).rejects.toThrow("this team");
  expect(integration.update).not.toHaveBeenCalled();
});
it("scopes audit reads to both the integration and team", async () => {
  const find = vi.spyOn(db.SlackThread, "findOne").mockResolvedValue(null);
  await expect(audit.getConversation(integration, "other-thread")).rejects.toMatchObject({ statusCode: 404 });
  expect(find).toHaveBeenCalledWith({ where: { id: "other-thread", integration_id: "i", team_id: 7 } });
});

it("includes new dashboards automatically for unlinked everyone access", async () => {
  integration.config.accessMode = "everyone";
  integration.config.allowAllDashboards = true;
  db.SlackAccount.findOne.mockResolvedValue(null);
  expect((await resolveAccount("T1", "U1")).access.projectIds).toEqual([1, 2, 3]);
  db.Project.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  const { access, envelope } = await resolveAccount("T1", "U1");
  expect(access.projectIds).toEqual([1, 2, 3, 4]);
  expect(envelope.editableProjectIds).toEqual([]);
  expect(db.Project.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { team_id: 7, ghost: false } }));
});

it("keeps linked client restrictions when all dashboards are enabled", async () => {
  integration.config.allowAllDashboards = true;
  integration.config.accessMode = "everyone";
  expect((await resolveAccount("T1", "U1")).access.projectIds).toEqual([1]);
});

it("returns to the saved dashboard selection when all dashboards are disabled", async () => {
  integration.config.accessMode = "everyone";
  db.SlackAccount.findOne.mockResolvedValue(null);
  integration.config.allowAllDashboards = false;
  expect((await resolveAccount("T1", "U1")).access.projectIds).toEqual([1, 2]);
});

it("validates and saves the all-dashboards setting", async () => {
  integration.update = vi.fn();
  await expect(controller.update("i", { config: { allowAllDashboards: "true" } }, 7)).rejects.toThrow("valid Slack access");
  expect(integration.update).not.toHaveBeenCalled();
  await controller.update("i", { config: { allowAllDashboards: true, dashboardIds: [1] } }, 7);
  expect(integration.update).toHaveBeenCalledWith({ config: expect.objectContaining({ allowAllDashboards: true, dashboardIds: [1] }) });
});
