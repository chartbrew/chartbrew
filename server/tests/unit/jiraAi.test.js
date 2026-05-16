import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const jiraAi = require("../../sources/plugins/jira/ai/jira.ai");
const jiraConnection = require("../../sources/plugins/jira/jira.connection");

describe("Jira AI planner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves an active sprint from a project key before planning sprint status", async () => {
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "D2371 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "D2371 Sprint 14",
      state: "active",
    }]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42, type: "jira", subType: "jira" },
      question: "can you show me the status of the active sprint I have for D2371 in Jira?",
    });

    expect(plan.status).toBe("ok");
    expect(plan.configuration).toMatchObject({
      resource: "sprint_issues",
      sprintId: "123",
      boardId: "77",
      transform: {
        type: "grouped",
        groupBy: "status",
      },
    });
    expect(plan.configuration.jql).toBe("project IN (\"D2371\") ORDER BY updated DESC");
    expect(plan.chartSpec).toMatchObject({
      type: "bar",
      xAxis: "root[].status",
      yAxis: "root[].issueCount",
    });
    expect(jiraConnection.listBoards).toHaveBeenCalledWith(expect.any(Object), {
      projectKeyOrId: "D2371",
      maxResults: 50,
    });
    expect(jiraConnection.listSprints).toHaveBeenCalledWith(expect.any(Object), {
      boardId: 77,
      maxResults: 50,
      state: "active",
    });
  });

  it("asks for a useful choice when no active sprint can be resolved", async () => {
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "D2371 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42, type: "jira", subType: "jira" },
      question: "show me the active sprint status for D2371",
    });

    expect(plan.status).toBe("needs_disambiguation");
    expect(plan.message).toContain("active sprint");
    expect(plan.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "status_breakdown" }),
      expect.objectContaining({ value: "pick_board" }),
    ]));
  });
});
