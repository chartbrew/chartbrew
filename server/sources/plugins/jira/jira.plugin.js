const path = require("path");

const jiraAi = require("./ai/jira.ai");
const jiraProtocol = require("./jira.protocol");

module.exports = {
  id: "jira",
  type: "jira",
  subType: "jira",
  name: "Jira",
  category: "productivity",
  description: "Connect to Jira Cloud projects, issues, boards, and sprints.",

  capabilities: {
    actions: [
      "listProjects",
      "listIssueTypes",
      "listStatuses",
      "listUsers",
      "listBoards",
      "listSprints",
      "listVersions",
      "listFields",
      "validateJql",
      "previewJql",
      "detectFieldMappings",
    ],
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["api_token"],
    },
    data: {
      supportsQuery: false,
      supportsSchema: true,
      supportsResourcePicker: true,
      supportsPagination: true,
      supportsVariables: true,
      supportsJoins: true,
    },
    templates: {
      datasets: true,
      charts: true,
      dashboards: true,
    },
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },

  backend: {
    ...jiraProtocol,
    ai: jiraAi,
  },

  templates: {
    directory: path.join(__dirname, "templates"),
    chartTemplates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
    defaults: {
      dataRequest: jiraProtocol.getDefaultDataRequest(),
    },
  },
};
