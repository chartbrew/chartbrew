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

const JIRA_RESOURCES = {
  issues: {
    label: "Issues",
    endpoint: "/rest/api/3/search/jql",
    fields: DEFAULT_FIELDS,
  },
  boards: {
    label: "Boards",
    endpoint: "/rest/agile/1.0/board",
  },
  sprints: {
    label: "Sprints",
    endpoint: "/rest/agile/1.0/board/{boardId}/sprint",
  },
  sprint_issues: {
    label: "Sprint issues",
    endpoint: "/rest/agile/1.0/sprint/{sprintId}/issue",
    fields: DEFAULT_FIELDS,
  },
  versions: {
    label: "Versions",
    endpoint: "/rest/api/3/project/{projectIdOrKey}/versions",
  },
  fields: {
    label: "Fields",
    endpoint: "/rest/api/3/field",
  },
  users: {
    label: "Users",
    endpoint: "/rest/api/3/user/search",
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
  JIRA_RESOURCES,
};
