import {
  afterEach, describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ChartTemplateController = require("../../controllers/ChartTemplateController");
const createDashboardFromTemplate = require("../../modules/ai/orchestrator/tools/createDashboardFromTemplate");
const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");

describe("AI orchestrator dashboard template tool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a dashboard through the generic chart template controller", async () => {
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
    const toolNames = (await availableTools()).map((tool) => tool.name);

    expect(toolNames).toContain("create_dashboard_from_template");
  });
});
