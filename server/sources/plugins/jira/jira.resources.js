const DEFAULT_FIELDS = [
  "key",
  "summary",
  "status",
  "assignee",
  "reporter",
  "priority",
  "issuetype",
  "created",
  "updated",
  "resolutiondate",
  "project",
  "parent",
  "fixVersions",
  "labels",
];

const ISSUE_METRICS = [
  "count",
  "storyPoints",
];

const SPRINT_METRICS = [
  ...ISSUE_METRICS,
  "completionRate",
  "completedIssues",
  "completedStoryPoints",
];

const ISSUE_DIMENSIONS = [
  "status",
  "statusCategory",
  "assignee",
  "reporter",
  "priority",
  "issueType",
  "project",
  "projectKey",
  "fixVersion",
  "label",
  "epicKey",
];

const SPRINT_DIMENSIONS = [
  ...ISSUE_DIMENSIONS,
  "sprint",
  "board",
];

const ISSUE_DATE_FIELDS = [
  "createdAt",
  "updatedAt",
  "resolvedAt",
  "doneAt",
];

const ISSUE_FILTERS = [
  { field: "project", operators: ["in", "equals"] },
  { field: "status", operators: ["in", "equals"] },
  { field: "statusCategory", operators: ["in", "equals"] },
  { field: "assignee", operators: ["in", "equals"] },
  { field: "reporter", operators: ["in", "equals"] },
  { field: "priority", operators: ["in", "equals"] },
  { field: "issueType", operators: ["in", "equals"] },
  { field: "fixVersion", operators: ["in", "equals"] },
  { field: "label", operators: ["in", "equals"] },
  { field: "createdAt", operators: ["between", "gte", "lte"] },
  { field: "updatedAt", operators: ["between", "gte", "lte"] },
  { field: "resolvedAt", operators: ["between", "gte", "lte"] },
];

const JIRA_RESOURCES = {
  issues: {
    label: "Issues",
    endpoint: "/rest/api/3/search/jql",
    fields: DEFAULT_FIELDS,
    metrics: ISSUE_METRICS,
    dimensions: ISSUE_DIMENSIONS,
    filters: ISSUE_FILTERS,
    transforms: ["raw", "grouped", "created_resolved_trend", "stale_table"],
    dateFields: ISSUE_DATE_FIELDS,
    requires: [],
    canAutoResolve: ["project"],
  },
  boards: {
    label: "Boards",
    endpoint: "/rest/agile/1.0/board",
    metrics: ["count"],
    dimensions: ["type", "project"],
    filters: [
      { field: "project", operators: ["equals"] },
      { field: "type", operators: ["equals"] },
    ],
    transforms: ["raw"],
    dateFields: [],
    requires: [],
    canAutoResolve: ["project"],
  },
  sprints: {
    label: "Sprints",
    endpoint: "/rest/agile/1.0/board/{boardId}/sprint",
    metrics: ["count"],
    dimensions: ["state", "board"],
    filters: [
      { field: "board", operators: ["equals"] },
      { field: "state", operators: ["equals"] },
    ],
    transforms: ["raw"],
    dateFields: ["startDate", "endDate", "completeDate"],
    requires: ["board"],
    canAutoResolve: ["project", "board"],
  },
  sprint_issues: {
    label: "Sprint issues",
    endpoint: "/rest/agile/1.0/sprint/{sprintId}/issue",
    fields: DEFAULT_FIELDS,
    metrics: SPRINT_METRICS,
    dimensions: SPRINT_DIMENSIONS,
    filters: [
      ...ISSUE_FILTERS,
      { field: "sprint", operators: ["equals"] },
      { field: "board", operators: ["equals"] },
    ],
    transforms: ["raw", "grouped", "sprint_summary", "stale_table"],
    dateFields: ISSUE_DATE_FIELDS,
    requires: ["sprint"],
    canAutoResolve: ["project", "board", "activeSprint"],
  },
  versions: {
    label: "Versions",
    endpoint: "/rest/api/3/project/{projectIdOrKey}/versions",
    metrics: ["count"],
    dimensions: ["released", "archived", "project"],
    filters: [
      { field: "project", operators: ["equals"] },
      { field: "released", operators: ["equals"] },
    ],
    transforms: ["raw"],
    dateFields: ["releaseDate"],
    requires: ["project"],
    canAutoResolve: ["project"],
  },
  fields: {
    label: "Fields",
    endpoint: "/rest/api/3/field",
    metrics: ["count"],
    dimensions: ["custom", "schema"],
    filters: [
      { field: "name", operators: ["contains", "equals"] },
      { field: "custom", operators: ["equals"] },
    ],
    transforms: ["raw"],
    dateFields: [],
    requires: [],
    canAutoResolve: [],
  },
  users: {
    label: "Users",
    endpoint: "/rest/api/3/user/search",
    metrics: ["count"],
    dimensions: ["active"],
    filters: [
      { field: "query", operators: ["contains"] },
      { field: "active", operators: ["equals"] },
    ],
    transforms: ["raw"],
    dateFields: [],
    requires: [],
    canAutoResolve: [],
  },
};

const FIELD_MAPPING_NAMES = {
  storyPoints: ["story points", "story point estimate", "estimate"],
  severity: ["severity"],
  team: ["team"],
};

module.exports = {
  DEFAULT_FIELDS,
  FIELD_MAPPING_NAMES,
  ISSUE_DATE_FIELDS,
  ISSUE_DIMENSIONS,
  ISSUE_FILTERS,
  ISSUE_METRICS,
  JIRA_RESOURCES,
  SPRINT_DIMENSIONS,
  SPRINT_METRICS,
};
