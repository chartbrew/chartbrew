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

  it("runs separate created and resolved searches for Jira trend templates", async () => {
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-1",
          fields: {
            summary: "Created in range",
            status: { name: "In Progress", statusCategory: { name: "In Progress" } },
            created: "2026-05-01T10:00:00.000Z",
            updated: "2026-05-01T10:30:00.000Z",
            resolutiondate: null,
          },
        }],
      })
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-2",
          fields: {
            summary: "Resolved in range",
            status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
            created: "2025-07-10T10:00:00.000Z",
            updated: "2026-05-03T12:00:00.000Z",
            resolutiondate: null,
          },
          changelog: {
            histories: [{
              created: "2026-05-03T12:00:00.000Z",
              items: [{ field: "status", toString: "Done" }],
            }],
          },
        }],
      });
    vi.spyOn(jiraConnection, "listStatuses")
      .mockResolvedValue([{ id: "10002", name: "Done", statusCategory: "Done", statusCategoryKey: "done" }]);
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
        id: 12,
        configuration: {
          source: "jira",
          resource: "issues",
          mode: "visual",
          includeDoneAt: true,
          jql: "project IN (CHART) AND ((created >= 2026-05-01 AND created <= 2026-05-31) OR (statusCategory = Done AND statusCategoryChangedDate >= 2026-05-01 AND statusCategoryChangedDate <= 2026-05-31)) ORDER BY updated ASC",
          transform: { type: "created_resolved_trend", interval: "day" },
          pagination: { maxResults: 100, maxRecords: 1000 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data).toEqual([
      { period: "2026-05-01", created: 1, resolved: 0, open: 1 },
      { period: "2026-05-03", created: 0, resolved: 1, open: 0 },
    ]);
    expect(response.responseData.data.some((row) => row.period === "2025-07-10")).toBe(false);
    expect(jiraConnection.jiraRequest).toHaveBeenNthCalledWith(1, expect.any(Object), "/rest/api/3/search/jql", {
      method: "POST",
      body: expect.objectContaining({
        jql: "project IN (CHART) AND created >= 2026-05-01 AND created <= 2026-05-31 ORDER BY created ASC",
        expand: "changelog",
      }),
    });
    expect(jiraConnection.jiraRequest).toHaveBeenNthCalledWith(2, expect.any(Object), "/rest/api/3/search/jql", {
      method: "POST",
      body: expect.objectContaining({
        jql: "project IN (CHART) AND statusCategory = Done AND statusCategoryChangedDate >= 2026-05-01 AND statusCategoryChangedDate <= 2026-05-31 ORDER BY updated ASC",
        expand: "changelog",
      }),
    });
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

  it("requests mapped story point fields for sprint summaries", async () => {
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockImplementation((connection, route, options) => {
        const requestedFields = String(options.qs.fields || "").split(",");
        const includesStoryPoints = requestedFields.includes("customfield_10016");
        const withStoryPoints = (fields, storyPoints) => ({
          ...fields,
          ...(includesStoryPoints ? { customfield_10016: storyPoints } : {}),
        });

        return Promise.resolve({
          issues: [{
            key: "CHART-1",
            fields: withStoryPoints({
              summary: "Complete first story",
              status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
              issuetype: { name: "Story" },
            }, 5),
          }, {
            key: "CHART-2",
            fields: withStoryPoints({
              summary: "Complete second story",
              status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
              issuetype: { name: "Story" },
            }, 8),
          }, {
            key: "CHART-3",
            fields: withStoryPoints({
              summary: "Carry over story",
              status: { name: "In Progress", statusCategory: { name: "In Progress" } },
              issuetype: { name: "Story" },
            }, 2),
          }],
          total: 3,
        });
      });
    vi.spyOn(jiraConnection, "listStatuses")
      .mockResolvedValue([{ id: "10002", name: "Done", statusCategory: "Done", statusCategoryKey: "done" }]);
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
        options: {
          jira: {
            fieldMappings: {
              storyPoints: "customfield_10016",
            },
          },
        },
      },
      dataRequest: {
        id: 13,
        configuration: {
          source: "jira",
          resource: "sprint_issues",
          mode: "visual",
          sprintId: "123",
          jql: "project = CHART",
          transform: { type: "sprint_summary" },
          fields: ["key", "summary", "status", "issuetype"],
          pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data).toEqual([{
      committedIssues: 3,
      completedIssues: 2,
      completionRate: 2 / 3,
      committedStoryPoints: 15,
      completedStoryPoints: 13,
    }]);
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/agile/1.0/sprint/123/issue", {
      qs: expect.objectContaining({
        fields: "key,summary,status,issuetype,customfield_10016",
      }),
    });
  });

  it("detects missing story point mappings before sprint summary requests", async () => {
    vi.spyOn(jiraConnection, "detectFieldMappings")
      .mockResolvedValue({
        fieldMappings: {
          storyPoints: "customfield_10016",
        },
        candidates: {},
      });
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockImplementation((connection, route, options) => {
        const requestedFields = String(options.qs.fields || "").split(",");
        const includesStoryPoints = requestedFields.includes("customfield_10016");

        return Promise.resolve({
          issues: [{
            key: "CHART-1",
            fields: {
              summary: "Complete first story",
              status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
              issuetype: { name: "Story" },
              ...(includesStoryPoints ? { customfield_10016: 5 } : {}),
            },
          }],
          total: 1,
        });
      });
    vi.spyOn(jiraConnection, "listStatuses")
      .mockResolvedValue([{ id: "10002", name: "Done", statusCategory: "Done", statusCategoryKey: "done" }]);
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
        options: {
          jira: {},
        },
      },
      dataRequest: {
        id: 14,
        configuration: {
          source: "jira",
          resource: "sprint_issues",
          mode: "visual",
          sprintId: "123",
          jql: "project = CHART",
          transform: { type: "sprint_summary" },
          fields: ["key", "summary", "status", "issuetype"],
          pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data).toEqual([{
      committedIssues: 1,
      completedIssues: 1,
      completionRate: 1,
      committedStoryPoints: 5,
      completedStoryPoints: 5,
    }]);
    expect(jiraConnection.detectFieldMappings).toHaveBeenCalledWith(expect.any(Object));
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/agile/1.0/sprint/123/issue", {
      qs: expect.objectContaining({
        fields: "key,summary,status,issuetype,customfield_10016",
      }),
    });
  });

  it("uses the selected board estimation field for sprint story points", async () => {
    vi.spyOn(jiraConnection, "getBoardConfiguration")
      .mockResolvedValue({
        id: 289,
        estimation: {
          type: "field",
          field: {
            displayName: "Story point estimate",
            fieldId: "customfield_10042",
          },
        },
      });
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockImplementation((connection, route, options) => {
        const requestedFields = String(options.qs.fields || "").split(",");
        const includesBoardStoryPoints = requestedFields.includes("customfield_10042");

        return Promise.resolve({
          issues: [{
            key: "CHART-1",
            fields: {
              summary: "Complete board-estimated story",
              status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
              issuetype: { name: "Story" },
              customfield_10016: null,
              ...(includesBoardStoryPoints ? { customfield_10042: 13 } : {}),
            },
          }],
          total: 1,
        });
      });
    vi.spyOn(jiraConnection, "listStatuses")
      .mockResolvedValue([{ id: "10002", name: "Done", statusCategory: "Done", statusCategoryKey: "done" }]);
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
        options: {
          jira: {
            fieldMappings: {
              storyPoints: "customfield_10016",
            },
          },
        },
      },
      dataRequest: {
        id: 15,
        configuration: {
          source: "jira",
          resource: "sprint_issues",
          mode: "visual",
          boardId: "289",
          sprintId: "123",
          jql: "project = CHART",
          transform: { type: "sprint_summary" },
          fields: ["key", "summary", "status", "issuetype"],
          pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data).toEqual([{
      committedIssues: 1,
      completedIssues: 1,
      completionRate: 1,
      committedStoryPoints: 13,
      completedStoryPoints: 13,
    }]);
    expect(jiraConnection.getBoardConfiguration).toHaveBeenCalledWith(expect.any(Object), {
      boardId: "289",
    });
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/agile/1.0/sprint/123/issue", {
      qs: expect.objectContaining({
        fields: "key,summary,status,issuetype,customfield_10042",
      }),
    });
  });

  it("uses selected board done column statuses for sprint completion", async () => {
    vi.spyOn(jiraConnection, "getBoardConfiguration")
      .mockResolvedValue({
        id: 289,
        estimation: {
          type: "field",
          field: {
            displayName: "Story point estimate",
            fieldId: "customfield_10042",
          },
        },
        columnConfig: {
          columns: [{
            name: "In Progress",
            statuses: [{ id: "10002" }],
          }, {
            name: "Done",
            statuses: [{ id: "10099" }],
          }],
        },
      });
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockResolvedValue({
        issues: [{
          key: "CHART-1",
          fields: {
            summary: "Actually done on board",
            status: { id: "10099", name: "QA Complete", statusCategory: { name: "In Progress" } },
            issuetype: { name: "Story" },
            customfield_10042: 13,
          },
        }, {
          key: "CHART-2",
          fields: {
            summary: "Still in progress",
            status: { id: "10002", name: "In Review", statusCategory: { name: "In Progress" } },
            issuetype: { name: "Story" },
            customfield_10042: 8,
          },
        }],
        total: 2,
      });
    vi.spyOn(jiraConnection, "listStatuses")
      .mockResolvedValue([]);
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
        id: 16,
        configuration: {
          source: "jira",
          resource: "sprint_issues",
          mode: "visual",
          boardId: "289",
          sprintId: "123",
          transform: { type: "sprint_summary" },
          fields: ["key", "summary", "status", "issuetype"],
          pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
        },
      },
      getCache: false,
    });

    expect(response.responseData.data).toEqual([{
      committedIssues: 2,
      completedIssues: 1,
      completionRate: 0.5,
      committedStoryPoints: 21,
      completedStoryPoints: 13,
    }]);
  });

  it("omits unresolved variable JQL from sprint issue requests", async () => {
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-1",
          fields: {
            summary: "Sprint issue",
            status: { name: "Done", statusCategory: { name: "Done" } },
            issuetype: { name: "Story" },
          },
        }],
        total: 1,
      });

    const rows = await jiraProtocol.fetchJiraRows({
      id: 7,
      type: "jira",
      subType: "jira",
      host: "https://chartbrew.atlassian.net",
      authentication: {
        email: "raz@example.com",
        apiToken: "token",
      },
    }, {
      source: "jira",
      resource: "sprint_issues",
      mode: "visual",
      sprintId: "123",
      jql: "project IN ({{projects}}) ORDER BY updated DESC",
      fields: ["key", "summary", "status", "issuetype"],
      pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
    });

    expect(rows.map((row) => row.key)).toEqual(["CHART-1"]);
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/agile/1.0/sprint/123/issue", {
      qs: expect.objectContaining({
        fields: "key,summary,status,issuetype",
        startAt: 0,
        maxResults: 100,
      }),
    });
    expect(jiraConnection.jiraRequest.mock.calls[0][2].qs.jql).toBeUndefined();
  });

  it("does not apply JQL filters to sprint summary requests", async () => {
    vi.spyOn(jiraConnection, "jiraRequest")
      .mockResolvedValueOnce({
        issues: [{
          key: "CHART-1",
          fields: {
            summary: "Sprint issue",
            status: { name: "Done", statusCategory: { name: "Done" } },
            issuetype: { name: "Story" },
          },
        }],
        total: 1,
      });

    const rows = await jiraProtocol.fetchJiraRows({
      id: 7,
      type: "jira",
      subType: "jira",
      host: "https://chartbrew.atlassian.net",
      authentication: {
        email: "raz@example.com",
        apiToken: "token",
      },
    }, {
      source: "jira",
      resource: "sprint_issues",
      mode: "visual",
      sprintId: "123",
      jql: "created >= 2026-04-21 AND created <= 2026-05-21 ORDER BY updated DESC",
      fields: ["key", "summary", "status", "issuetype"],
      transform: { type: "sprint_summary" },
      pagination: { startAt: 0, maxResults: 100, maxRecords: 100 },
    });

    expect(rows.map((row) => row.key)).toEqual(["CHART-1"]);
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/agile/1.0/sprint/123/issue", {
      qs: expect.objectContaining({
        fields: "key,summary,status,issuetype",
        startAt: 0,
        maxResults: 100,
      }),
    });
    expect(jiraConnection.jiraRequest.mock.calls[0][2].qs.jql).toBeUndefined();
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
