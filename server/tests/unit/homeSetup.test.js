import { afterEach, describe, expect, it, vi } from "vitest";

const { Op } = require("sequelize");
const db = require("../../models/models");
const HomeController = require("../../controllers/HomeController");
const { isCapabilityQuestion } = require("../../modules/ai/orchestrator/capabilityHandler");
const { isVisualizationAction, routeWorkspaceRequest } = require("../../modules/ai/orchestrator/runtime/deterministicRouter");
const { getRoleBoundaryMessage } = require("../../modules/ai/orchestrator/rolePolicy");

afterEach(() => vi.restoreAllMocks());

describe("Home setup", () => {
  it("routes setup questions and short answers to conversation without forcing creation", () => {
    for (const message of [
      "How do I get started?",
      "Help me plan my first report",
      "Help me create a chart for my workspace",
      "How do I create a dataset?",
      "How can you help me explore my sales?",
      "weekly",
      "PostgreSQL",
      "Actually, I want to explore customer activity instead",
    ]) {
      expect(isCapabilityQuestion(message)).toBe(false);
      expect(routeWorkspaceRequest({ message })).toBeNull();
      expect(isVisualizationAction(message)).toBe(false);
    }
    expect(isCapabilityQuestion("What can you do?")).toBe(true);
    expect(isVisualizationAction("Create a weekly sales chart from my dataset")).toBe(true);
    expect(routeWorkspaceRequest({ message: "Which metrics need attention?" }).intent).toBe("metric_attention");
    expect(getRoleBoundaryMessage("projectViewer", "How do I get started?")).toBeNull();
    expect(getRoleBoundaryMessage("projectViewer", "Help me create a chart")).toBeTruthy();
  });

  it("limits setup content to accessible datasets and dashboards without counting team connections", async () => {
    const connections = vi.spyOn(db.Connection, "count");
    const members = vi.spyOn(db.TeamRole, "count");
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([
      { project_ids: [42] }, { project_ids: [] },
    ]);
    const projects = vi.spyOn(db.Project, "findAll").mockResolvedValue([]);
    const access = { teamId: 7, allProjects: false, canConfigureTeam: false, projectIds: [8] };
    const controller = new HomeController();
    expect((await controller.getOnboarding(access, 0)).milestones.dataset).toBe(false);
    db.Dataset.findAll.mockResolvedValue([{ project_ids: [8] }]);
    expect((await controller.getOnboarding(access, 0)).milestones.dataset).toBe(true);
    expect(connections).not.toHaveBeenCalled();
    expect(members).not.toHaveBeenCalled();
    const query = projects.mock.calls[0][0];
    expect(query.where.id[Op.in]).toEqual([8]);
    expect(query.include[0].where).toEqual({ draft: false });
    expect(db.Dataset.findAll.mock.calls[0][0].where).toEqual({ draft: false, team_id: 7 });
  });
});
