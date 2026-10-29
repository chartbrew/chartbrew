import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const {
  checkChart, completionFailureMessage, verifySavedResult,
} = require("../../modules/ai/orchestrator/runtime/completionCheck");

const chart = {
  id: 5, project_id: 10, name: "Monthly jobs", type: "line", timeInterval: "month",
  includeZeros: false, displayLegend: true,
  visualization: {
    settings: { timeInterval: "month", includeZeros: false },
    layers: [{ id: "jobs", encoding: { time: { field: "month" } } }],
  },
};

describe("saved completion checks", () => {
  beforeEach(() => {
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamOwner", projects: [] });
    vi.spyOn(db.Chart, "findOne").mockResolvedValue(chart);
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 10, name: "Jobs", ghost: false });
    vi.spyOn(db.Chart, "count").mockResolvedValue(1);
    vi.spyOn(db.DashboardFilter, "findAll").mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  function verify(overrides = {}) {
    return verifySavedResult({
      toolName: "create_chart", args: { name: "Monthly jobs", timeInterval: "month", project_id: 10, completion_requirements: { dashboard_filters: [], unverified: [] } },
      result: { chart_id: 5, project_id: 10 }, teamId: 7, userId: 3, ...overrides,
    });
  }

  it("checks saved settings and reports missing dashboard controls without running data", async () => {
    const check = await verify();
    expect(check).toMatchObject({
      scope: "saved_settings_only", dataAccuracyVerified: false,
      checks: [
        { resource: "chart:5", status: "verified", saved: { timeInterval: "month", resultsUpdatedAt: null } },
        { resource: "dashboard:10", status: "verified", saved: { chartCount: 1, filters: [] } },
      ],
    });
    expect(db.Chart.findOne).toHaveBeenCalledWith(expect.objectContaining({
      include: [expect.objectContaining({ required: true, where: { team_id: 7 } })],
    }));
  });

  it("detects a chart saved with the wrong interval or destination", () => {
    expect(checkChart(chart, { timeInterval: "day", project_id: 20 }).status).toBe("partial");
    expect(checkChart({
      ...chart, visualization: { settings: { timeInterval: "day" }, layers: chart.visualization.layers },
    }, {}).issues).toContain("The saved and displayed time intervals do not agree.");
    expect(checkChart(chart, { includeZeros: true }).status).toBe("partial");
  });

  it("reports saved filter definitions and marks a limited list", async () => {
    db.DashboardFilter.findAll.mockResolvedValue(Array.from({ length: 51 }, () => ({
      configuration: { type: "field", label: "State", field: "state" },
    })));
    const check = await verify();
    expect(check.checks[1].saved.filtersTruncated).toBe(true);
    expect(check.checks[1].saved.filters).toHaveLength(50);
    expect(check.checks[1].saved.filters[0].label).toEqual({ trust: "untrusted_data", value: "State" });
  });

  it("marks missing requested filters as incomplete and does not let a later write drop them", async () => {
    const first = await verify({ args: { completion_requirements: { dashboard_filters: ["State"], unverified: [] } } });
    expect(first.checks[1].status).toBe("partial");
    const later = await verify();
    const results = [first, later].map((check) => ({ content: JSON.stringify({ completion_check: check }) }));
    expect(completionFailureMessage(results)).toContain("requested dashboard filter");
    db.DashboardFilter.findAll.mockResolvedValue([{ configuration: { label: "State", type: "field" } }]);
    const repaired = await verify();
    expect(completionFailureMessage([...results, { content: JSON.stringify({ completion_check: repaired }) }])).toBeNull();
  });

  it("does not treat an empty dashboard as finished", async () => {
    db.Chart.count.mockResolvedValue(0);
    const check = await verify({
      toolName: "create_dashboard", args: { name: "Jobs" }, result: { project_id: 10 },
    });
    expect(check.checks[0]).toMatchObject({ resource: "dashboard:10", status: "partial" });
  });

  it("fails closed when the saved result cannot be read", async () => {
    db.Chart.findOne.mockRejectedValue(new Error("Private database error"));
    const check = await verify();
    expect(check.checks.every((item) => item.status === "unverified")).toBe(true);
    expect(JSON.stringify(check)).not.toContain("Private database error");
  });

  it("does not return saved facts after project access is removed", async () => {
    db.TeamRole.findOne.mockResolvedValue({ role: "projectEditor", projects: [20] });
    db.Chart.findOne.mockResolvedValue(null);
    const check = await verify();
    expect(check.checks.every((item) => item.status === "unverified")).toBe(true);
    expect(check.checks.every((item) => !item.saved)).toBe(true);
  });

  it("requires completion requirements on write tools but not summary tools", async () => {
    const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");
    const tools = await availableTools();
    for (const name of ["create_chart", "update_chart", "create_dashboard", "create_dashboard_from_template"]) {
      const tool = tools.find((item) => item.name === name);
      expect(tool.parameters.required).toContain("completion_requirements");
    }
    expect(tools.find((item) => item.name === "read_chart_results").parameters.required).toEqual(["project_id"]);
  });

  it("does not let a later write discard outcomes that still need verification", async () => {
    const first = await verify({ args: { completion_requirements: { dashboard_filters: [], unverified: ["Check totals against source"] } } });
    const later = await verify();
    expect(completionFailureMessage([first, later].map((check) => ({
      content: JSON.stringify({ completion_check: check }),
    })))).toContain("still need verification");
  });

  it("skips reads for summaries, failed writes, and disambiguation", async () => {
    expect(await verify({ toolName: "read_chart_results" })).toBeNull();
    expect(await verify({ result: { error: "failed" } })).toBeNull();
    expect(await verify({ result: { needs_user_input: true } })).toBeNull();
    expect(db.Chart.findOne).not.toHaveBeenCalled();
  });

  it("blocks success until the same saved resource passes a later check", () => {
    const result = (checks) => ({ content: JSON.stringify({ completion_check: { checks } }) });
    const failed = result([{ resource: "chart:5", status: "partial", issues: ["Wrong interval."] }]);
    expect(completionFailureMessage([failed])).toContain("not fully verified");
    const unrelated = result([{ resource: "chart:6", status: "verified", issues: [] }]);
    expect(completionFailureMessage([failed, unrelated])).toContain("Wrong interval.");
    const repaired = result([{ resource: "chart:5", status: "verified", issues: [] }]);
    expect(completionFailureMessage([failed, unrelated, repaired])).toBeNull();
  });
});
