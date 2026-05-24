import {
  afterEach, describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ChartTemplateController = require("../../controllers/ChartTemplateController");
const ProjectController = require("../../controllers/ProjectController");
const db = require("../../models/models");
const { getSourceById } = require("../../sources");
const createDashboard = require("../../modules/ai/orchestrator/tools/createDashboard");
const createDashboardChart = require("../../modules/ai/orchestrator/tools/createDashboardChart");
const createDashboardFromTemplate = require("../../modules/ai/orchestrator/tools/createDashboardFromTemplate");
const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");
const { sourceListTemplates, sourceRecommendTemplates } = require("../../modules/ai/orchestrator/tools/sourceTools");

describe("AI orchestrator dashboard template tool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a dashboard through the generic chart template controller", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "jira",
      subType: "jira",
    });
    const createSpy = vi.spyOn(ChartTemplateController.prototype, "createFromTemplate")
      .mockResolvedValue({
        project_id: 77,
        datasets: [{ id: 99, name: "Issues" }],
        charts: [{ id: 55, name: "Open issues" }],
      });

    const result = await createDashboardFromTemplate({
      team_id: 7,
      user_id: 3,
      source_id: "jira",
      template_slug: "project-overview",
      connection_id: 42,
      dashboard: { type: "new", name: "Jira Project Overview" },
      dataset_template_ids: ["issues_by_status"],
      chart_template_ids: ["issues-by-status"],
      variable_defaults: {
        projects: "CHART",
      },
    });

    expect(createSpy).toHaveBeenCalledWith(7, "jira", "project-overview", {
      connection_id: 42,
      dashboard: { type: "new", name: "Jira Project Overview" },
      dataset_template_ids: ["issues_by_status"],
      chart_template_ids: ["issues-by-status"],
      variable_defaults: {
        projects: "CHART",
      },
    }, { id: 3 });
    expect(result).toMatchObject({
      status: "ok",
      dashboard_created: true,
      source: "jira",
      template_slug: "project-overview",
      project_id: 77,
      datasets: [{ id: 99, name: "Issues" }],
      charts: [{ id: 55, name: "Open issues" }],
    });
  });

  it("exposes the dashboard template tool to the orchestrator", async () => {
    const tools = await availableTools();
    const toolNames = tools.map((tool) => tool.name);
    const dashboardTool = tools.find((tool) => tool.name === "create_dashboard_from_template");
    const emptyDashboardTool = tools.find((tool) => tool.name === "create_dashboard");
    const dashboardChartTool = tools.find((tool) => tool.name === "create_dashboard_chart");

    expect(toolNames).toContain("create_dashboard");
    expect(toolNames).toContain("create_dashboard_chart");
    expect(toolNames).toContain("create_dashboard_from_template");
    expect(emptyDashboardTool.description).toContain("multi-source");
    expect(dashboardChartTool.parameters.required).toEqual(expect.arrayContaining([
      "project_id",
      "connection_id",
      "name",
    ]));
    expect(dashboardTool.parameters.properties.source_id.enum).toEqual(expect.arrayContaining([
      "jira",
      "stripe",
      "stripeOfficial",
    ]));
    expect(dashboardTool.parameters.properties.source_id.enum).not.toContain("postgres");
  });

  it("lists templates for template-backed sources without source-owned AI tools", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "api",
      subType: "stripe",
    });

    const result = await sourceListTemplates({
      team_id: 7,
      connection_id: 42,
      source_id: "stripe",
    });

    expect(result.templates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "stripe",
        slug: "core-revenue",
      }),
    ]));
  });

  it("recommends generic templates for template-backed sources without source-owned AI tools", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "api",
      subType: "stripe",
    });

    const result = await sourceRecommendTemplates({
      team_id: 7,
      connection_id: 42,
      source_id: "stripe",
      question: "Create a Stripe dashboard",
    });

    expect(result.recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "stripe",
        slug: "core-revenue",
      }),
    ]));
  });

  it("creates new template dashboards through ProjectController", async () => {
    const createSpy = vi.spyOn(ProjectController.prototype, "create")
      .mockResolvedValue({
        id: 88,
        name: "AI Metrics Dashboard",
      });

    const controller = new ChartTemplateController();
    const project = await controller.resolveProject({
      teamId: 7,
      dashboard: { type: "new", name: "AI Metrics Dashboard" },
      teamRole: { role: "teamOwner", projects: [] },
      user: { id: 3 },
      transaction: "transaction",
    });

    expect(createSpy).toHaveBeenCalledWith(3, {
      team_id: 7,
      name: "AI Metrics Dashboard",
      ghost: false,
    }, { transaction: "transaction" });
    expect(project).toMatchObject({
      id: 88,
      name: "AI Metrics Dashboard",
    });
  });

  it("creates an empty dashboard for mixed-source orchestration", async () => {
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({
      role: "teamOwner",
      projects: [],
    });
    const createSpy = vi.spyOn(ProjectController.prototype, "create")
      .mockResolvedValue({
        id: 91,
        name: "Mixed Metrics",
        team_id: 7,
        ghost: false,
      });

    const result = await createDashboard({
      team_id: 7,
      user_id: 3,
      name: "Mixed Metrics",
    });

    expect(createSpy).toHaveBeenCalledWith(3, {
      team_id: 7,
      name: "Mixed Metrics",
      ghost: false,
    });
    expect(result).toMatchObject({
      status: "ok",
      dashboard_created: true,
      project_id: 91,
      name: "Mixed Metrics",
      dashboard_url: expect.stringContaining("/dashboard/91"),
    });
  });

  it("creates a dataset and chart directly in a mixed-source dashboard", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "postgres",
      subType: "postgres",
    });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({
      id: 91,
      team_id: 7,
      ghost: false,
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue(null);
    vi.spyOn(db.DataRequest, "findByPk").mockResolvedValue(null);
    vi.spyOn(db.DataRequest, "findOne").mockResolvedValue(null);
    const datasetCreateSpy = vi.spyOn(require("../../controllers/DatasetController").prototype, "createWithDataRequests")
      .mockResolvedValue({
        id: 301,
        name: "Total users",
        project_ids: [91],
        DataRequests: [{ id: 401 }],
      });
    const chartCreateSpy = vi.spyOn(require("../../controllers/ChartController").prototype, "createWithChartDatasetConfigs")
      .mockResolvedValue({
        id: 501,
        name: "Total users",
        type: "kpi",
        project_id: 91,
      });
    vi.spyOn(require("../../controllers/ChartController").prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createDashboardChart({
      team_id: 7,
      project_id: 91,
      connection_id: 42,
      name: "Total users",
      type: "kpi",
      query: "SELECT COUNT(*) AS total_users FROM users",
      xAxis: "root[].total_users",
      yAxis: "root[].total_users",
    });

    expect(datasetCreateSpy).toHaveBeenCalledWith(expect.objectContaining({
      team_id: 7,
      project_ids: [91],
      dataRequests: [expect.objectContaining({
        connection_id: 42,
        query: "SELECT COUNT(*) AS total_users FROM users",
      })],
    }));
    expect(chartCreateSpy).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 91,
      chartDatasetConfigs: [expect.objectContaining({
        dataset_id: 301,
        yAxis: "root[].total_users",
      })],
    }), null);
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
      project_id: 91,
      dataset_id: 301,
      chart_id: 501,
    });
  });

  it("passes source-prepared template variable defaults into dashboard creation", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "jira",
      subType: "jira",
    });
    const jira = getSourceById("jira");
    vi.spyOn(jira.backend.ai, "prepareTemplateVariables").mockResolvedValue({
      variableDefaults: {
        sprint_id: "123",
        board_id: "77",
        projects: "A4321",
      },
    });
    const createSpy = vi.spyOn(ChartTemplateController.prototype, "createFromTemplate")
      .mockResolvedValue({
        project_id: 77,
        datasets: [],
        charts: [],
      });

    await createDashboardFromTemplate({
      team_id: 7,
      user_id: 3,
      source_id: "jira",
      template_slug: "sprint-health",
      connection_id: 42,
      dashboard: { type: "new", name: "Sprint Health" },
      variable_defaults: {},
      original_question: "Create a sprint health dashboard for A4321",
    });

    expect(jira.backend.ai.prepareTemplateVariables).toHaveBeenCalledWith(expect.objectContaining({
      templateSlug: "sprint-health",
      question: "Create a sprint health dashboard for A4321",
    }));
    expect(createSpy).toHaveBeenCalledWith(7, "jira", "sprint-health", expect.objectContaining({
      variable_defaults: {
        sprint_id: "123",
        board_id: "77",
        projects: "A4321",
      },
    }), { id: 3 });
  });
});
