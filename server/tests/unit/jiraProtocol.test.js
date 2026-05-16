import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const drCacheController = require("../../controllers/DataRequestCacheController");
const jiraConnection = require("../../sources/plugins/jira/jira.connection");
const jiraProtocol = require("../../sources/plugins/jira/jira.protocol");

describe("Jira protocol", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes source actions for Jira metadata", async () => {
    vi.spyOn(jiraConnection, "listProjects")
      .mockResolvedValue([{ id: "10000", key: "CHART", name: "Chartbrew" }]);
    vi.spyOn(jiraConnection, "listBoards")
      .mockResolvedValue([{ id: 12, name: "CHART board", type: "scrum" }]);
    vi.spyOn(jiraConnection, "detectFieldMappings")
      .mockResolvedValue({
        fieldMappings: { storyPoints: "customfield_10016" },
        candidates: { storyPoints: [{ id: "customfield_10016", name: "Story Points" }] },
      });

    const connection = { type: "jira", subType: "jira" };

    await expect(jiraProtocol.actions.listProjects({ connection }))
      .resolves.toEqual([{ id: "10000", key: "CHART", name: "Chartbrew" }]);
    await expect(jiraProtocol.actions.listBoards({ connection, params: { projectKeyOrId: "CHART" } }))
      .resolves.toEqual([{ id: 12, name: "CHART board", type: "scrum" }]);
    await expect(jiraProtocol.actions.detectFieldMappings({ connection }))
      .resolves.toEqual({
        fieldMappings: { storyPoints: "customfield_10016" },
        candidates: { storyPoints: [{ id: "customfield_10016", name: "Story Points" }] },
      });
  });

  it("applies variables inside Jira configuration", () => {
    const dataRequest = {
      id: 42,
      configuration: {
        source: "jira",
        resource: "issues",
        jql: "project IN ({{projects}}) AND created >= {{start_date}} AND created <= {{end_date}}",
      },
      VariableBindings: [
        { name: "projects", type: "string", default_value: "CHART", required: true },
        { name: "start_date", type: "date", default_value: "2026-05-01", required: false },
        { name: "end_date", type: "date", default_value: "2026-05-31", required: false },
      ],
    };

    const result = jiraProtocol.applyVariables({
      dataRequest,
      variables: {
        end_date: "2026-06-01",
      },
    });

    expect(result.processedDataRequest.configuration.jql)
      .toBe("project IN (CHART) AND created >= 2026-05-01 AND created <= 2026-06-01");
  });

  it("normalizes Jira issues using field mappings", () => {
    const issue = {
      key: "CHART-123",
      fields: {
        summary: "Add Jira dashboard template",
        project: { key: "CHART" },
        issuetype: { name: "Story" },
        status: { name: "In Progress", statusCategory: { name: "In Progress" } },
        assignee: { displayName: "Raz" },
        reporter: { displayName: "Jane" },
        priority: { name: "High" },
        created: "2026-05-01T10:00:00.000Z",
        updated: "2026-05-03T12:00:00.000Z",
        resolutiondate: null,
        customfield_10016: 5,
        labels: ["dashboard", "jira"],
        fixVersions: [{ name: "v5.2.0" }],
        parent: { key: "CHART-100" },
      },
    };

    expect(jiraProtocol.normalizeIssue(issue, { storyPoints: "customfield_10016" }))
      .toEqual({
        key: "CHART-123",
        summary: "Add Jira dashboard template",
        projectKey: "CHART",
        issueType: "Story",
        status: "In Progress",
        statusCategory: "In Progress",
        assignee: "Raz",
        reporter: "Jane",
        priority: "High",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z",
        resolvedAt: null,
        doneAt: null,
        isDone: false,
        storyPoints: 5,
        severity: null,
        team: null,
        labels: ["dashboard", "jira"],
        fixVersions: ["v5.2.0"],
        epicKey: "CHART-100",
      });
  });

  it("derives doneAt from Jira status changelog when resolutiondate is empty", () => {
    const issue = {
      key: "CHART-124",
      fields: {
        summary: "Complete sprint issue",
        status: { name: "Closed", statusCategory: { name: "Done", key: "done" } },
        resolutiondate: null,
      },
      changelog: {
        histories: [{
          created: "2026-05-04T09:30:00.000Z",
          items: [{
            field: "status",
            to: "10002",
            toString: "Closed",
          }],
        }],
      },
    };

    expect(jiraProtocol.normalizeIssue(issue, {}, {
      includeDoneAt: true,
      doneStatusLookup: {
        ids: new Set(["10002"]),
        names: new Set(["closed"]),
      },
    })).toEqual(expect.objectContaining({
      resolvedAt: null,
      doneAt: "2026-05-04T09:30:00.000Z",
      isDone: true,
    }));
  });

  it("groups normalized rows for chart-ready breakdowns", () => {
    const rows = [
      { status: "Done", storyPoints: 3 },
      { status: "Done", storyPoints: 5 },
      { status: "In Progress", storyPoints: 2 },
    ];

    expect(jiraProtocol.transformRows(rows, {
      transform: {
        type: "grouped",
        metric: "storyPoints",
        groupBy: "status",
      },
    })).toEqual([
      { status: "Done", issueCount: 2, storyPoints: 8 },
      { status: "In Progress", issueCount: 1, storyPoints: 2 },
    ]);
  });

  it("uses doneAt for created vs resolved trend transforms", () => {
    expect(jiraProtocol.transformRows([{
      createdAt: "2026-05-01T10:00:00.000Z",
      doneAt: "2026-05-03T12:00:00.000Z",
      resolvedAt: null,
    }], {
      transform: {
        type: "created_resolved_trend",
        interval: "day",
      },
    })).toEqual([
      { period: "2026-05-01", created: 1, resolved: 0, open: 1 },
      { period: "2026-05-03", created: 0, resolved: 1, open: 0 },
    ]);
  });

  it("runs issue searches and caches normalized response data", async () => {
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-1",
          fields: {
            summary: "Open issue",
            status: { name: "To Do", statusCategory: { name: "To Do" } },
            issuetype: { name: "Task" },
            created: "2026-05-01T00:00:00.000Z",
            updated: "2026-05-02T00:00:00.000Z",
          },
        }],
        maxResults: 100,
      });
    const cacheSpy = vi.spyOn(drCacheController, "create")
      .mockResolvedValue({});

    const response = await jiraProtocol.runDataRequest({
      connection: {
        id: 7,
        type: "jira",
        subType: "jira",
        host: "https://chartbrew.atlassian.net",
        authentication: {
          email: "raz@example.com",
          apiToken: "token",
        },
        options: {
          jira: {
            fieldMappings: {},
          },
        },
      },
      dataRequest: {
        id: 9,
        configuration: {
          source: "jira",
          resource: "issues",
          mode: "jql",
          jql: "project = CHART",
          transform: { type: "raw" },
          pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data).toEqual([expect.objectContaining({
      key: "CHART-1",
      summary: "Open issue",
      status: "To Do",
    })]);
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/api/3/search/jql", {
      method: "POST",
      body: {
        jql: "project = CHART",
        fields: expect.any(Array),
        maxResults: 100,
      },
    });
    expect(cacheSpy).toHaveBeenCalledWith(9, expect.objectContaining({
      responseData: {
        data: [expect.objectContaining({ key: "CHART-1" })],
      },
    }));
  });

  it("paginates issue searches with nextPageToken", async () => {
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-1",
          fields: {
            summary: "First issue",
            status: { name: "To Do", statusCategory: { name: "To Do" } },
          },
        }],
        nextPageToken: "next-page",
      })
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-2",
          fields: {
            summary: "Second issue",
            status: { name: "Done", statusCategory: { name: "Done" } },
          },
        }],
      });
    vi.spyOn(drCacheController, "create").mockResolvedValue({});

    const response = await jiraProtocol.runDataRequest({
      connection: {
        id: 7,
        type: "jira",
        subType: "jira",
        host: "https://chartbrew.atlassian.net",
        authentication: {
          email: "raz@example.com",
          apiToken: "token",
        },
      },
      dataRequest: {
        id: 11,
        configuration: {
          source: "jira",
          resource: "issues",
          mode: "jql",
          jql: "project = CHART",
          transform: { type: "raw" },
          pagination: { maxResults: 100, maxRecords: 100 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data.map((row) => row.key)).toEqual(["CHART-1", "CHART-2"]);
    expect(jiraConnection.jiraRequest).toHaveBeenNthCalledWith(2, expect.any(Object), "/rest/api/3/search/jql", {
      method: "POST",
      body: {
        jql: "project = CHART",
        fields: expect.any(Array),
        maxResults: 100,
        nextPageToken: "next-page",
      },
    });
  });

  it("runs Agile board resources through Jira source actions", async () => {
    vi.spyOn(jiraConnection, "listBoards")
      .mockResolvedValue([{ id: 12, name: "CHART board", type: "scrum" }]);
    const cacheSpy = vi.spyOn(drCacheController, "create")
      .mockResolvedValue({});

    const response = await jiraProtocol.runDataRequest({
      connection: {
        id: 7,
        type: "jira",
        subType: "jira",
        host: "https://chartbrew.atlassian.net",
        authentication: {
          email: "raz@example.com",
          apiToken: "token",
        },
      },
      dataRequest: {
        id: 10,
        configuration: {
          source: "jira",
          resource: "boards",
          mode: "advanced",
          projectIdOrKey: "CHART",
          transform: { type: "raw" },
          pagination: { startAt: 0, maxResults: 100, maxRecords: 50 },
        },
      },
      getCache: false,
    });

    expect(jiraConnection.listBoards).toHaveBeenCalledWith(expect.any(Object), {
      maxResults: 50,
      projectKeyOrId: "CHART",
      type: undefined,
    });
    expect(response.responseData.data).toEqual([{ id: 12, name: "CHART board", type: "scrum" }]);
    expect(cacheSpy).toHaveBeenCalledWith(10, expect.objectContaining({
      responseData: {
        data: [{ id: 12, name: "CHART board", type: "scrum" }],
      },
    }));
  });
});
