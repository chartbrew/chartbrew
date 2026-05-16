import jiraLogo from "./assets/jira.svg";
import jiraLogoDark from "./assets/jira-dark.svg";

const DEFAULT_CONFIGURATION = {
  source: "jira",
  resource: "issues",
  mode: "visual",
  jql: "created >= {{start_date}} AND created <= {{end_date}} ORDER BY updated DESC",
  fields: ["key", "summary", "status", "assignee", "priority", "issuetype", "created", "updated", "resolutiondate", "project"],
  transform: {
    type: "raw",
  },
  includeDoneAt: false,
  visual: {
    dateField: "created",
    startDate: "last_30_days",
    endDate: "now",
  },
  pagination: {
    startAt: 0,
    maxResults: 100,
    maxRecords: 5000,
  },
};

const jiraSource = {
  id: "jira",
  type: "jira",
  subType: "jira",
  name: "Jira",
  category: "productivity",
  showNewBadge: true,
  capabilities: {
    ai: {
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
      canGenerateDatasets: true,
    },
    templates: {
      charts: true,
      datasets: true,
    },
    nextSteps: {
      chartTemplates: true,
      datasetTemplates: true,
    },
  },
  assets: {
    lightLogo: jiraLogo,
    darkLogo: jiraLogoDark,
  },
  defaults: {
    dataRequest: {
      method: "GET",
      pagination: true,
      items: "issues",
      itemsLimit: 5000,
      offset: "startAt",
      paginationField: null,
      template: "jira",
      useGlobalHeaders: true,
      configuration: DEFAULT_CONFIGURATION,
    },
  },
  templates: {
    chartTemplates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
  },
};

export { DEFAULT_CONFIGURATION };
export default jiraSource;
