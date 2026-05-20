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
const jiraProtocol = require("../../sources/plugins/jira/jira.protocol");
const jiraResolver = require("../../sources/plugins/jira/ai/jira.resolver");
const jiraConnection = require("../../sources/plugins/jira/jira.connection");

describe("Jira AI planner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes Jira semantic capabilities and resource planning metadata", () => {
    const capabilities = jiraAi.getCapabilities();
    const resources = jiraAi.listResources();
    const sprintIssues = resources.resources.find((resource) => resource.id === "sprint_issues");
    const issues = resources.resources.find((resource) => resource.id === "issues");

    expect(capabilities.supports.discovery).toEqual(expect.arrayContaining([
      "projects",
      "boards",
      "sprints",
      "versions",
      "users",
      "fields",
    ]));
    expect(capabilities.supports.semanticIntents).toEqual(expect.arrayContaining([
      "sprint_status",
      "sprint_summary",
      "bug_breakdown",
      "release_progress",
    ]));
    expect(capabilities.supports.riskPolicy).toMatchObject({
      preview: "best_match",
      persist: "disambiguate_meaningful_uncertainty",
    });
    expect(sprintIssues).toMatchObject({
      id: "sprint_issues",
      requires: ["sprint"],
      canAutoResolve: ["project", "board", "activeSprint"],
      metrics: expect.arrayContaining(["count", "storyPoints", "completionRate"]),
      dimensions: expect.arrayContaining(["status", "statusCategory", "assignee", "priority", "issueType"]),
      transforms: expect.arrayContaining(["raw", "grouped", "sprint_summary", "stale_table"]),
      dateFields: expect.arrayContaining(["createdAt", "updatedAt", "resolvedAt", "doneAt"]),
    });
    expect(issues.filters).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "statusCategory" }),
      expect.objectContaining({ field: "assignee" }),
      expect.objectContaining({ field: "fixVersion" }),
    ]));
  });

  it("resolves an active sprint from a project key before planning sprint status", async () => {
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "A4321 Sprint 14",
      state: "active",
    }]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42, type: "jira", subType: "jira" },
      question: "can you show me the status of the active sprint I have for A4321 in Jira?",
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
    expect(plan.configuration.jql).toBe("project IN (\"A4321\") ORDER BY updated DESC");
    expect(plan.chartSpec).toMatchObject({
      type: "bar",
      xAxis: "root[].status",
      yAxis: "root[].issueCount",
    });
    expect(jiraConnection.listBoards).toHaveBeenCalledWith(expect.any(Object), {
      projectKeyOrId: "A4321",
      maxResults: 50,
    });
    expect(jiraConnection.listSprints).toHaveBeenCalledWith(expect.any(Object), {
      boardId: 77,
      maxResults: 50,
      state: "active",
    });
  });

  it("returns resolution and correction actions for active sprint status", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "A4321 Sprint 14",
      state: "active",
    }]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show me the active sprint status for A4321",
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.rationale.intent).toBe("sprint_status");
    expect(plan.resolution.project).toMatchObject({ key: "A4321" });
    expect(plan.resolution.board).toMatchObject({ id: "77" });
    expect(plan.resolution.sprint).toMatchObject({ id: "123" });
    expect(plan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "change_sprint" }),
      expect.objectContaining({ value: "group_by_assignee" }),
    ]));
  });

  it("plans a sprint summary from follow-up overrides", async () => {
    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show me a simple sprint summary",
      overrides: {
        project: "A4321",
        boardId: "77",
        sprintId: "123",
      },
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.rationale.intent).toBe("sprint_summary");
    expect(plan.configuration).toMatchObject({
      resource: "sprint_issues",
      sprintId: "123",
      boardId: "77",
      transform: { type: "sprint_summary" },
    });
    expect(plan.chartSpec.type).toBe("gauge");
  });

  it("falls back to project status breakdown when active sprint cannot be resolved", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show me the active sprint status for A4321",
      mode: "preview",
    });

    expect(plan.status).toBe("fallback");
    expect(plan.message).toContain("project status breakdown");
    expect(plan.configuration).toMatchObject({
      resource: "issues",
      transform: {
        type: "grouped",
        groupBy: "status",
        metric: "count",
      },
    });
    expect(plan.configuration.jql).toContain("project IN (\"A4321\")");
    expect(plan.configuration.jql).not.toContain("created >=");
  });

  it("plans Jira release progress from a version name", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listVersions").mockResolvedValue([{
      id: "20001",
      name: "v5.2.0",
      released: false,
    }]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show release readiness for A4321 v5.2.0",
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.rationale.intent).toBe("release_progress");
    expect(plan.configuration.jql).toContain("fixVersion IN (\"v5.2.0\")");
    expect(plan.configuration.jql).not.toContain("created >=");
    expect(plan.resolution.version).toMatchObject({
      name: "v5.2.0",
    });
  });

  it.each([
    ["empty version discovery", []],
    ["failed version discovery", new Error("Jira versions unavailable")],
  ])("keeps release version token when %s", async (name, versionsResult) => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    const versionsSpy = vi.spyOn(jiraConnection, "listVersions");
    if (versionsResult instanceof Error) {
      versionsSpy.mockRejectedValue(versionsResult);
    } else {
      versionsSpy.mockResolvedValue(versionsResult);
    }

    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show release readiness for A4321 v5.2.0",
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.rationale.intent).toBe("release_progress");
    expect(plan.configuration.jql).toContain("fixVersion IN (\"v5.2.0\")");
    expect(plan.configuration.jql).not.toContain("created >=");
  });

  it("applies resolved Jira users to planned workload JQL", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([{
      accountId: "abc",
      displayName: "Jane Product",
    }]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show workload for A4321 assigned to Jane",
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.rationale.intent).toBe("team_workload");
    expect(plan.configuration.jql).toContain("assignee IN (\"abc\")");
    expect(plan.configuration.transform).toMatchObject({
      type: "grouped",
      groupBy: "assignee",
    });
  });

  it("plans current work by assignee without requiring a project", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([]);
    vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([{
      accountId: "raz-account",
      displayName: "Razvan Ilin",
    }]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "what tasks is Razvan working on currently?",
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.configuration.jql).not.toContain("project IN ()");
    expect(plan.configuration.jql).not.toContain("{{projects}}");
    expect(plan.configuration.jql).not.toContain("created >=");
    expect(plan.configuration.jql).toContain("assignee IN (\"raz-account\")");
    expect(plan.configuration.jql).toContain("statusCategory != Done");
    expect(plan.chartSpec.type).toBe("table");
  });

  it("plans created resolved trend from explicit intent overrides", async () => {
    const plan = await jiraAi.planDataset({
      connection: { id: 42 },
      question: "show project movement",
      overrides: {
        intent: "created_resolved_trend",
        project: "A4321",
      },
      mode: "preview",
    });

    expect(plan.status).toBe("ok");
    expect(plan.rationale.intent).toBe("created_resolved_trend");
    expect(plan.configuration).toMatchObject({
      resource: "issues",
      transform: {
        type: "created_resolved_trend",
      },
      includeDoneAt: true,
    });
    expect(plan.chartSpec.type).toBe("line");
  });

  it("normalizes preview issues with doneAt when requested", async () => {
    vi.spyOn(jiraProtocol, "fetchJiraRows").mockResolvedValue([{
      key: "A4321-1",
      fields: {
        summary: "Ship release checklist",
        project: { key: "A4321" },
        status: {
          name: "Done",
          statusCategory: {
            key: "done",
            name: "Done",
          },
        },
        created: "2026-01-01T00:00:00.000Z",
        updated: "2026-01-04T00:00:00.000Z",
        resolutiondate: null,
      },
      changelog: {
        histories: [{
          created: "2026-01-03T12:00:00.000Z",
          items: [{
            field: "status",
            toString: "Done",
          }],
        }],
      },
    }]);

    const preview = await jiraAi.previewConfiguration({
      connection: { id: 42 },
      configuration: {
        source: "jira",
        resource: "issues",
        mode: "jql",
        jql: "project IN (\"A4321\") ORDER BY updated DESC",
        includeDoneAt: true,
        transform: { type: "raw" },
      },
      rowLimit: 5,
    });

    expect(preview.status).toBe("ok");
    expect(preview.rows[0].doneAt).toBe("2026-01-03T12:00:00.000Z");
  });

  it("falls back to project status when sprint issue preview fails", async () => {
    const jiraProtocol = require("../../sources/plugins/jira/jira.protocol");
    const fetchSpy = vi.spyOn(jiraProtocol, "fetchJiraRows");
    fetchSpy
      .mockRejectedValueOnce(new Error("400 - The sprint field is invalid"))
      .mockResolvedValueOnce([{
        key: "A4321-1",
        fields: {
          summary: "Fallback issue",
          project: { key: "A4321" },
          issuetype: { name: "Story" },
          status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
          created: "2026-05-01T00:00:00.000Z",
          updated: "2026-05-02T00:00:00.000Z",
        },
      }]);

    const preview = await jiraAi.previewConfiguration({
      connection: { id: 42 },
      rowLimit: 5,
      configuration: {
        source: "jira",
        resource: "sprint_issues",
        mode: "visual",
        jql: "project IN (\"A4321\") ORDER BY updated DESC",
        fields: ["key", "summary", "status", "project", "issuetype", "created", "updated"],
        sprintId: "123",
        boardId: "77",
        projectIdOrKey: "A4321",
        transform: { type: "grouped", groupBy: "status", metric: "count" },
        pagination: { startAt: 0, maxResults: 100, maxRecords: 5 },
      },
    });

    expect(preview.status).toBe("fallback");
    expect(preview.message).toContain("project status breakdown");
    expect(preview.message).toContain("400 - The sprint field is invalid");
    expect(preview.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("400 - The sprint field is invalid"),
    ]));
    expect(preview.rows).toEqual([{ status: "In Progress", issueCount: 1, storyPoints: 0 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      resource: "issues",
      sprintId: undefined,
      boardId: undefined,
      projectIdOrKey: "A4321",
      transform: { type: "grouped", groupBy: "status", metric: "count" },
      includeDoneAt: false,
    });
    expect(fetchSpy.mock.calls[1][1].jql).toContain("project IN (\"A4321\")");
    expect(fetchSpy.mock.calls[1][1].jql).toContain("statusCategory != Done");
    expect(fetchSpy.mock.calls[1][1].jql).not.toContain("created >=");
  });

  it("does not fallback for generic missing resource preview errors", async () => {
    const jiraProtocol = require("../../sources/plugins/jira/jira.protocol");
    const fetchSpy = vi.spyOn(jiraProtocol, "fetchJiraRows")
      .mockRejectedValueOnce(new Error("404 - Project does not exist"));

    await expect(jiraAi.previewConfiguration({
      connection: { id: 42 },
      rowLimit: 5,
      configuration: {
        source: "jira",
        resource: "sprint_issues",
        mode: "visual",
        jql: "project IN (\"A4321\") ORDER BY updated DESC",
        fields: ["key", "summary", "status", "project", "issuetype", "created", "updated"],
        sprintId: "123",
        boardId: "77",
        projectIdOrKey: "A4321",
        transform: { type: "grouped", groupBy: "status", metric: "count" },
        pagination: { startAt: 0, maxResults: 100, maxRecords: 5 },
      },
    })).rejects.toThrow("404 - Project does not exist");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not fallback for generic missing field preview errors", async () => {
    const jiraProtocol = require("../../sources/plugins/jira/jira.protocol");
    const fetchSpy = vi.spyOn(jiraProtocol, "fetchJiraRows")
      .mockRejectedValueOnce(new Error("400 - Field not found"));

    await expect(jiraAi.previewConfiguration({
      connection: { id: 42 },
      rowLimit: 5,
      configuration: {
        source: "jira",
        resource: "sprint_issues",
        mode: "visual",
        jql: "project IN (\"A4321\") ORDER BY updated DESC",
        fields: ["key", "summary", "status", "project", "issuetype", "created", "updated"],
        sprintId: "123",
        boardId: "77",
        projectIdOrKey: "A4321",
        transform: { type: "grouped", groupBy: "status", metric: "count" },
        pagination: { startAt: 0, maxResults: 100, maxRecords: 5 },
      },
    })).rejects.toThrow("400 - Field not found");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns a useful fallback when no active sprint can be resolved", async () => {
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([]);

    const plan = await jiraAi.planDataset({
      connection: { id: 42, type: "jira", subType: "jira" },
      question: "show me the active sprint status for A4321",
    });

    expect(plan.status).toBe("fallback");
    expect(plan.message).toContain("active sprint");
    expect(plan.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "status_breakdown" }),
      expect.objectContaining({ value: "show_table" }),
    ]));
  });

  it("resolves exact project, single scrum board, and active sprint context", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "Sprint 14",
      state: "active",
    }]);

    const context = await jiraResolver.resolveContext({
      connection: { id: 42 },
      question: "show active sprint status for A4321",
      intent: { id: "sprint_status", resource: "sprint_issues" },
      mode: "preview",
    });

    expect(context.needsDisambiguation).toBe(false);
    expect(context.entities.project).toMatchObject({
      id: "10001",
      key: "A4321",
      confidence: 0.98,
    });
    expect(context.entities.board).toMatchObject({
      id: "77",
      confidence: 0.9,
    });
    expect(context.entities.sprint).toMatchObject({
      id: "123",
      state: "active",
      confidence: 0.95,
    });
  });

  it("resolves an active sprint from the second matching board", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }, {
      id: 88,
      name: "A4321 Delivery Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockImplementation((connection, params) => {
      if (params.boardId === 88) {
        return Promise.resolve([{
          id: 456,
          name: "Sprint 22",
          state: "active",
        }]);
      }
      return Promise.resolve([]);
    });

    const context = await jiraResolver.resolveContext({
      connection: { id: 42 },
      question: "show active sprint status for A4321",
      intent: { id: "sprint_status", resource: "sprint_issues" },
      mode: "preview",
    });

    expect(context.needsDisambiguation).toBe(false);
    expect(context.entities.board).toMatchObject({
      id: "88",
      name: "A4321 Delivery Board",
      confidence: 0.9,
    });
    expect(context.entities.sprint).toMatchObject({
      id: "456",
      name: "Sprint 22",
      state: "active",
      confidence: 0.95,
    });
    expect(jiraConnection.listSprints).toHaveBeenCalledWith(expect.any(Object), {
      boardId: 77,
      maxResults: 50,
      state: "active",
    });
    expect(jiraConnection.listSprints).toHaveBeenCalledWith(expect.any(Object), {
      boardId: 88,
      maxResults: 50,
      state: "active",
    });
  });

  it("asks for sprint disambiguation in persist mode when multiple active sprints exist", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "A4321 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "Sprint 14",
      state: "active",
    }, {
      id: 124,
      name: "Sprint 15",
      state: "active",
    }]);

    const context = await jiraResolver.resolveContext({
      connection: { id: 42 },
      question: "show active sprint status for A4321",
      intent: { id: "sprint_status", resource: "sprint_issues" },
      mode: "persist",
    });

    expect(context.needsDisambiguation).toBe(true);
    expect(context.entities.sprint).toBeUndefined();
    expect(context.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "sprint:123" }),
      expect.objectContaining({ value: "sprint:124" }),
    ]));
  });

  it("resolves users and versions only when requested by intent", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([{
      accountId: "abc",
      displayName: "Jane Doe",
    }]);
    vi.spyOn(jiraConnection, "listVersions").mockResolvedValue([{
      id: "20001",
      name: "v5.2.0",
    }]);

    const context = await jiraResolver.resolveContext({
      connection: { id: 42 },
      question: "show release readiness for A4321 v5.2.0 assigned to Jane",
      intent: {
        id: "release_progress",
        resource: "issues",
        needsVersion: true,
        needsUser: true,
      },
      mode: "preview",
    });

    expect(jiraConnection.listUsers).toHaveBeenCalledWith(expect.any(Object), {
      query: "Jane",
      maxResults: 20,
    });
    expect(jiraConnection.listVersions).toHaveBeenCalledWith(expect.any(Object), {
      projectIdOrKey: "A4321",
    });
    expect(context.entities.user).toMatchObject({
      accountId: "abc",
      confidence: 0.8,
    });
    expect(context.entities.version).toMatchObject({
      id: "20001",
      name: "v5.2.0",
      confidence: 0.95,
    });
  });

  it("adds warnings when user and version discovery fail", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    vi.spyOn(jiraConnection, "listUsers").mockRejectedValue(new Error("Jira users unavailable"));
    vi.spyOn(jiraConnection, "listVersions").mockRejectedValue(new Error("Jira versions unavailable"));

    const context = await jiraResolver.resolveContext({
      connection: { id: 42 },
      question: "show release readiness for A4321 v5.2.0 assigned to Jane",
      intent: {
        id: "release_progress",
        resource: "issues",
        needsVersion: true,
        needsUser: true,
      },
      mode: "preview",
    });

    expect(context.entities.user).toBeNull();
    expect(context.entities.version).toBeNull();
    expect(context.warnings).toEqual(expect.arrayContaining([
      "Could not resolve Jira user.",
      "Could not resolve Jira version.",
    ]));
  });

  it("skips user and version discovery when the intent does not need them", async () => {
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "A4321",
      name: "A4321 Project",
    }]);
    const listUsersSpy = vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([]);
    const listVersionsSpy = vi.spyOn(jiraConnection, "listVersions").mockResolvedValue([]);

    const resolution = await jiraResolver.resolveContext({
      connection: { id: 42 },
      question: "show issue status for A4321",
      intent: { id: "issue_breakdown", resource: "issues" },
      mode: "preview",
    });

    expect(resolution.entities.user).toBeUndefined();
    expect(resolution.entities.version).toBeUndefined();
    expect(listUsersSpy).not.toHaveBeenCalled();
    expect(listVersionsSpy).not.toHaveBeenCalled();
  });
});
