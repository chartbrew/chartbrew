import { beforeAll, describe, expect, it } from "vitest";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";

const { listDashboardFilters, setDashboardFilter, deleteDashboardFilter } = require("../../modules/ai/orchestrator/tools/dashboardFilters");
const { verifySavedResult, completionFailureMessage } = require("../../modules/ai/orchestrator/runtime/completionCheck");

describe("AI dashboard filters", () => {
  let models;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
  });

  async function seed() {
    const user = await models.User.create(userFactory.build());
    const team = await models.Team.create(teamFactory.build());
    await models.TeamRole.create({ team_id: team.id, user_id: user.id, role: "teamOwner" });
    const project = await models.Project.create(projectFactory.build({ team_id: team.id }));
    const chart = await models.Chart.create({ project_id: project.id, name: "Jobs", type: "line", draft: false });
    const dataset = await models.Dataset.create({
      team_id: team.id, name: "Jobs", project_ids: [project.id],
      fieldsSchema: { "root[].state": "string", "root[].employer": "string" },
    });
    await models.ChartDatasetConfig.create({ chart_id: chart.id, dataset_id: dataset.id });
    return {
      project, user, team,
      payload: {
        team_id: team.id, user_id: user.id, project_id: project.id,
        field: "root[].employer", label: "Employer", options: ["Acme", "Bio"],
        all_label: "All Employers", completion_requirements: { dashboard_filters: ["Employer"], unverified: [] },
      },
    };
  }

  it("saves dropdown filters once, reads them back, and completes the missing-filter requirement", async () => {
    const { payload } = await seed();
    const before = await verifySavedResult({
      toolName: "create_dashboard", args: payload, result: { project_id: payload.project_id },
      teamId: payload.team_id, userId: payload.user_id,
    });
    const [first, retry] = await Promise.all([setDashboardFilter(payload), setDashboardFilter(payload)]);
    expect(retry.filter_id).toBe(first.filter_id);
    expect(await models.DashboardFilter.count()).toBe(1);
    const saved = await models.DashboardFilter.findByPk(first.filter_id);
    expect(saved.onReport).toBe(false);
    expect(saved.configuration).toMatchObject({ type: "field", operator: "is", value: "", allLabel: "All Employers", options: ["Acme", "Bio"] });
    const listed = await listDashboardFilters(payload);
    expect(listed.filters).toHaveLength(1);
    expect(listed.fields.some((item) => item.field.value === "root[].employer")).toBe(true);
    const after = await verifySavedResult({
      toolName: "set_dashboard_filter", args: payload, result: first,
      teamId: payload.team_id, userId: payload.user_id,
    });
    expect(after.checks.every((check) => check.status === "verified")).toBe(true);
    expect(completionFailureMessage([before, after].map((check) => ({
      content: JSON.stringify({ completion_check: check }),
    })))).toBeNull();
    await setDashboardFilter({ ...payload, filter_id: first.filter_id, options: ["Acme", "Bio", "New"] });
    expect(await models.DashboardFilter.count()).toBe(1);
    expect((await deleteDashboardFilter({ ...payload, filter_id: first.filter_id })).removed).toBe(true);
    expect((await deleteDashboardFilter({ ...payload, filter_id: first.filter_id })).removed).toBe(false);
  });

  it("rejects missing fields and invalid options before changing filters", async () => {
    const { payload } = await seed();
    await expect(setDashboardFilter({ ...payload, field: "root[].missing" })).rejects.toThrow("Select a field");
    await expect(setDashboardFilter({ ...payload, options: ["Acme", "Acme"] })).rejects.toThrow("distinct");
    await expect(setDashboardFilter({ ...payload, options: [1] })).rejects.toThrow("field type");
    expect(await models.DashboardFilter.count()).toBe(0);
  });

  it("keeps other teams, viewers, and out-of-scope filter IDs from writing", async () => {
    const { payload, user, team } = await seed();
    const saved = await setDashboardFilter(payload);
    const otherTeam = await models.Team.create(teamFactory.build());
    await models.TeamRole.create({ team_id: otherTeam.id, user_id: user.id, role: "teamOwner" });
    await expect(listDashboardFilters({ ...payload, team_id: otherTeam.id })).rejects.toThrow("not available");
    const otherProject = await models.Project.create(projectFactory.build({ team_id: team.id }));
    expect((await deleteDashboardFilter({ ...payload, project_id: otherProject.id, filter_id: saved.filter_id })).removed).toBe(false);
    await expect(setDashboardFilter({ ...payload, allowed_project_ids: [] })).rejects.toThrow("not available");
    await models.TeamRole.update({ role: "projectViewer", projects: [payload.project_id] }, {
      where: { team_id: team.id, user_id: user.id },
    });
    expect((await listDashboardFilters(payload)).filters).toHaveLength(1);
    await expect(setDashboardFilter(payload)).rejects.toMatchObject({ statusCode: 403 });
    await expect(deleteDashboardFilter({ ...payload, filter_id: saved.filter_id })).rejects.toMatchObject({ statusCode: 403 });
    expect(await models.DashboardFilter.count()).toBe(1);
  });
});
