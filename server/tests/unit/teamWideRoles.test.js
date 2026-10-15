import { afterEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const acl = require("../../modules/accessControl");
const { canEditProject, getObservationAccess } = require("../../modules/observations/access");
const { getWorkspaceAccessEnvelope } = require("../../modules/workspaceContext/accessEnvelope");
const { getAiRoleScope } = require("../../modules/ai/orchestrator/rolePolicy");
const { canExportChartImage } = require("../../modules/chartImage/imageAccess");
const { getEffectiveProjectIds, buildDataApiAccess } = require("../../modules/dataApiAccess");
const TeamController = require("../../controllers/TeamController");

afterEach(() => vi.restoreAllMocks());

describe("team-wide editor and viewer permissions", () => {
  it.each(["teamEditor", "teamViewer"])("grants %s all dashboards and exports without admin permissions", (role) => {
    expect(acl.can(role).readOwn("project").granted).toBe(true);
    expect(acl.can(role).readOwn("chart").granted).toBe(true);
    expect(acl.can(role).readAny("dataset").granted).toBe(false);
    expect(canExportChartImage({ role, projects: [], canExport: false }, 42)).toBe(true);
    expect(getEffectiveProjectIds({ role, teamProjectIds: [1, 2, 3], allProjects: true })).toEqual([1, 2, 3]);
    for (const resource of ["team", "teamRole", "teamInvite", "connection", "dataset", "dataRequest", "apiKey"]) {
      expect(acl.can(role).createAny(resource).granted).toBe(false);
      expect(acl.can(role).updateAny(resource).granted).toBe(false);
      expect(acl.can(role).deleteAny(resource).granted).toBe(false);
    }
  });

  it("permits editor dashboard creation and chart edits but blocks viewer writes", () => {
    expect(acl.can("teamEditor").createOwn("project").granted).toBe(true);
    expect(acl.can("teamEditor").updateOwn("project").granted).toBe(true);
    expect(acl.can("teamEditor").deleteOwn("chart").granted).toBe(true);
    expect(acl.can("teamEditor").deleteAny("project").granted).toBe(false);
    for (const action of ["createOwn", "updateOwn", "deleteOwn"]) {
      expect(acl.can("teamViewer")[action]("project").granted).toBe(false);
      expect(acl.can("teamViewer")[action]("chart").granted).toBe(false);
    }
    expect(canEditProject({ role: "teamEditor", allProjects: true }, 42)).toBe(true);
    expect(canEditProject({ role: "teamViewer", allProjects: true }, 42)).toBe(false);
  });

  it.each(["teamEditor", "teamViewer"])("keeps %s AI permissions separate from visibility", async (role) => {
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role, projects: [], Team: { aiEnabled: true } });
    vi.spyOn(db.Project, "findAll").mockResolvedValue([{ id: 1 }, { id: 2 }]);
    vi.spyOn(db.User, "findByPk").mockResolvedValue({ email: "member@example.com" });
    const access = await getObservationAccess(7, 8);
    expect(access).toMatchObject({ allProjects: true, canConfigureTeam: false });
    const envelope = await getWorkspaceAccessEnvelope(access);
    expect(envelope.visibleProjectIds).toEqual([1, 2]);
    expect(envelope.editableProjectIds).toEqual(role === "teamEditor" ? [1, 2] : []);
    expect(envelope.canConfigureConnections).toBe(false);
    expect(getAiRoleScope(access, envelope).accessMode).toBe(role === "teamEditor" ? "project_editor" : "reporting_only");
  });

  it("removes stale write scopes when an API key owner becomes a viewer", async () => {
    const models = { Project: { findAll: vi.fn().mockResolvedValue([{ id: 3 }]) } };
    const access = await buildDataApiAccess(models, {
      id: 1, team_id: 7, user_id: 8, all_projects: true,
      scopes: ["data:read", "data:refresh", "charts:preview", "datasets:write"],
    }, { role: "teamViewer", projects: [] });
    expect(access.projectIds).toEqual([3]);
    expect(access.scopes).toEqual(["data:read"]);
  });

  it("requires explicit valid dashboards when changing a team role to a client role", async () => {
    const controller = new TeamController();
    vi.spyOn(controller, "getTeamRole").mockResolvedValue({ role: "teamEditor" });
    const update = vi.spyOn(db.TeamRole, "update").mockResolvedValue([1]);
    const count = vi.spyOn(db.Project, "count").mockResolvedValue(0);
    await expect(controller.updateTeamRole(7, 8, { role: "projectViewer" })).rejects.toThrow("Select dashboards");
    await expect(controller.updateTeamRole(7, 8, { role: "projectViewer", projects: [99] })).rejects.toThrow("Select valid dashboards");
    expect(update).not.toHaveBeenCalled();
    count.mockResolvedValue(1);
    await controller.updateTeamRole(7, 8, { role: "projectViewer", projects: [3] });
    expect(update).toHaveBeenCalledWith({ role: "projectViewer", projects: [3], canExport: false }, { where: { team_id: 7, user_id: 8 } });
  });

  it.each(["teamEditor", "teamViewer"])("normalizes %s invitations and preserves existing team membership", async (role) => {
    const controller = new TeamController();
    const existing = { id: 5, role };
    const find = vi.spyOn(db.TeamRole, "findOne").mockResolvedValue(null);
    const create = vi.spyOn(db.TeamRole, "create").mockResolvedValue(existing);
    vi.spyOn(db.TeamRole, "findByPk").mockResolvedValue(existing);
    const update = vi.spyOn(db.TeamRole, "update").mockResolvedValue([1]);
    await controller.addTeamRole(7, 8, role, [99], false);
    expect(create).toHaveBeenCalledWith({ team_id: 7, user_id: 8, role, projects: [], canExport: true });
    find.mockResolvedValue(existing);
    await controller.addTeamRole(7, 8, "projectViewer", [99], false);
    expect(update).not.toHaveBeenCalled();
  });
});
