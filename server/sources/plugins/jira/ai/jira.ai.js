const moment = require("moment-timezone");

const jiraConnection = require("../jira.connection");
const jiraProtocol = require("../jira.protocol");
const { DEFAULT_FIELDS, JIRA_RESOURCES } = require("../jira.resources");

const SOURCE_ID = "jira";
const DEFAULT_PAGINATION = { startAt: 0, maxResults: 100, maxRecords: 1000 };

const TEMPLATE_RECOMMENDATIONS = [{
  terms: ["sprint", "scrum", "velocity", "carryover", "story point"],
  templateSlugs: ["sprint-health"],
  chartIds: ["sprint-completion", "story-points-completed", "work-by-assignee", "carryover-issues"],
}, {
  terms: ["bug", "defect", "quality", "priority", "severity"],
  templateSlugs: ["bug-tracking"],
  chartIds: ["bugs-by-priority", "bug-trend", "oldest-open-bugs"],
}, {
  terms: ["workload", "assignee", "team load", "stale", "wip", "in progress"],
  templateSlugs: ["team-workload"],
  chartIds: ["open-by-assignee", "wip-by-assignee", "stale-issues"],
}, {
  terms: ["overview", "project", "status", "created", "resolved", "completed"],
  templateSlugs: ["project-overview"],
  chartIds: ["issues-created-resolved", "issues-by-status", "issues-by-assignee", "recent-completed-work"],
}];

const SOURCE_INSTRUCTIONS = [
  "Jira is a source-owned configuration connector for Jira Cloud only. Return DataRequest.configuration objects with source=jira; do not invent REST routes.",
  "Use issue search and JQL for issue datasets. Use sprint_issues with sprintId for Agile sprint datasets.",
  "Use normalized issue fields such as key, summary, status, statusCategory, assignee, priority, issueType, createdAt, updatedAt, resolvedAt, doneAt, isDone, storyPoints, fixVersions, and epicKey.",
  "Use grouped, created_resolved_trend, sprint_summary, stale_table, or raw transforms to return chart-friendly rows.",
  "Keep previews capped. Use source_preview_configuration before creating charts when the user asks for unfamiliar JQL or sprint data.",
  "For Jira follow-ups, reuse previously resolved sprintId, boardId, and project key as source_plan_dataset overrides when they are visible in prior tool results.",
].join("\n");

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      modes: ["visual", "jql", "advanced"],
      resources: Object.keys(JIRA_RESOURCES),
      agile: true,
      variables: true,
      pagination: true,
      templates: ["project-overview", "sprint-health", "bug-tracking", "team-workload"],
      chartPlacement: true,
    },
    caveats: [
      "Jira Cloud API tokens are supported for v1; OAuth is intentionally excluded.",
      "Story points, severity, and team fields depend on saved Jira field mappings.",
      "Dashboard-level Jira variables are still created with datasets today; pre-defining them at template selection needs a separate workflow.",
    ],
  };
}

function listResources() {
  return {
    source: SOURCE_ID,
    resources: Object.entries(JIRA_RESOURCES).map(([id, resource]) => ({
      id,
      label: resource.label,
      endpoint: resource.endpoint,
      fields: resource.fields || [],
      supportedModes: id === "issues" || id === "sprint_issues"
        ? ["visual", "jql", "advanced"]
        : ["advanced"],
      transforms: getTransformsForResource(id),
    })),
  };
}

function getTransformsForResource(resource) {
  if (resource === "sprint_issues") {
    return ["raw", "grouped", "sprint_summary", "stale_table"];
  }
  if (resource === "issues") {
    return ["raw", "grouped", "created_resolved_trend", "stale_table"];
  }
  return ["raw"];
}

function getSchema() {
  return jiraProtocol.getSchema();
}

function getTemplates() {
  const { listTemplates } = require("../../../shared/templates/chartTemplateLoader"); // eslint-disable-line global-require

  return {
    source: SOURCE_ID,
    templates: listTemplates(SOURCE_ID),
  };
}

function recommendTemplates({ question = "" } = {}) {
  const normalizedQuestion = question.toLowerCase();
  const matches = TEMPLATE_RECOMMENDATIONS.filter((recommendation) => {
    return recommendation.terms.some((term) => normalizedQuestion.includes(term));
  });
  const selected = matches.length > 0
    ? matches
    : [TEMPLATE_RECOMMENDATIONS[3]];
  const templateSlugs = Array.from(new Set(selected.flatMap((match) => match.templateSlugs)));
  const chartIds = Array.from(new Set(selected.flatMap((match) => match.chartIds)));

  return {
    source: SOURCE_ID,
    question,
    recommendations: getTemplates().templates
      .filter((template) => templateSlugs.includes(template.slug))
      .map((template) => ({
        ...template,
        recommendedCharts: template.charts.filter((chart) => chartIds.includes(chart.id)),
      })),
  };
}

function normalizeDateRange(question, overrides = {}) {
  if (overrides.dateRange) {
    return {
      start: overrides.dateRange.start || "{{start_date}}",
      end: overrides.dateRange.end || "{{end_date}}",
    };
  }

  const normalizedQuestion = question.toLowerCase();
  if (normalizedQuestion.includes("last month")) {
    const previousMonth = moment().subtract(1, "month");
    return {
      start: previousMonth.clone().startOf("month").format("YYYY-MM-DD"),
      end: previousMonth.clone().endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (normalizedQuestion.includes("today")) {
    return {
      start: moment().startOf("day").format("YYYY-MM-DD"),
      end: moment().format("YYYY-MM-DD"),
    };
  }

  const daysMatch = normalizedQuestion.match(/last\s+(\d+)\s+days?/);
  if (daysMatch) {
    return {
      start: `-${daysMatch[1]}d`,
      end: "now()",
    };
  }

  return {
    start: "{{start_date}}",
    end: "{{end_date}}",
  };
}

function quoteList(values) {
  const list = Array.isArray(values) ? values : [values];
  return list
    .filter((value) => value !== undefined && value !== null && `${value}`.trim() !== "")
    .map((value) => {
      const stringValue = `${value}`.trim();
      if (/^\{\{.+\}\}$/.test(stringValue)) return stringValue;
      return `"${stringValue.replace(/"/g, "\\\"")}"`;
    })
    .join(", ");
}

function buildJql({ question = "", overrides = {}, intent = {} } = {}) {
  if (overrides.jql) return overrides.jql;

  const normalizedQuestion = question.toLowerCase();
  const dateRange = normalizeDateRange(question, overrides);
  const projectValue = overrides.projects || overrides.project || extractProjectKey(question, overrides) || "{{projects}}";
  const clauses = [];

  if (projectValue) clauses.push(`project IN (${quoteList(projectValue)})`);
  if (intent.issueType || overrides.issueType) clauses.push(`issuetype = ${quoteList(intent.issueType || overrides.issueType)}`);
  if (overrides.statusCategory) clauses.push(`statusCategory = ${quoteList(overrides.statusCategory)}`);
  if (overrides.status) clauses.push(`status = ${quoteList(overrides.status)}`);
  if (overrides.assignee) clauses.push(`assignee IN (${quoteList(overrides.assignee)})`);
  if (overrides.priority || intent.priority) clauses.push(`priority IN (${quoteList(overrides.priority || intent.priority)})`);
  if (overrides.fixVersion) clauses.push(`fixVersion IN (${quoteList(overrides.fixVersion)})`);
  if (intent.resource === "sprint_issues") {
    // Sprint endpoint already scopes the issues. Avoid introducing date variables unless asked explicitly.
  } else if (normalizedQuestion.includes("completed") || normalizedQuestion.includes("resolved")) {
    clauses.push(`resolutiondate >= ${dateRange.start}`);
    clauses.push(`resolutiondate <= ${dateRange.end}`);
  } else if (normalizedQuestion.includes("stale") || normalizedQuestion.includes("stuck") || normalizedQuestion.includes("oldest")) {
    clauses.push("statusCategory != Done");
    clauses.push(`updated <= ${overrides.staleBefore || "-14d"}`);
  } else {
    clauses.push(`created >= ${dateRange.start}`);
    clauses.push(`created <= ${dateRange.end}`);
  }

  if (normalizedQuestion.includes("open") || normalizedQuestion.includes("backlog")) {
    clauses.push("resolution = Unresolved");
  }

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

function resolveIntent(question = "", overrides = {}) {
  const normalizedQuestion = question.toLowerCase();
  const groupBy = overrides.groupBy || inferGroupBy(normalizedQuestion);

  if (overrides.resource) {
    return {
      resource: overrides.resource,
      transform: overrides.transform || { type: "raw" },
      chartType: overrides.chartType || "table",
    };
  }

  if (normalizedQuestion.includes("sprint") || overrides.sprintId) {
    const sprintMetric = ["status", "statusCategory"].includes(groupBy) ? "count" : "storyPoints";
    return {
      resource: "sprint_issues",
      transform: normalizedQuestion.includes("by ") || groupBy
        ? { type: "grouped", groupBy: groupBy || "assignee", metric: overrides.metric || sprintMetric }
        : { type: "sprint_summary" },
      chartType: normalizedQuestion.includes("by ") || groupBy ? "bar" : "gauge",
    };
  }

  if (normalizedQuestion.includes("stale") || normalizedQuestion.includes("stuck") || normalizedQuestion.includes("oldest")) {
    return {
      resource: "issues",
      transform: { type: "stale_table" },
      chartType: "table",
    };
  }

  if (normalizedQuestion.includes("created vs resolved") || normalizedQuestion.includes("created and resolved") || normalizedQuestion.includes("trend") || normalizedQuestion.includes("over time")) {
    return {
      resource: "issues",
      transform: {
        type: "created_resolved_trend",
        interval: overrides.interval || inferInterval(normalizedQuestion),
      },
      chartType: "line",
    };
  }

  if (groupBy) {
    return {
      resource: "issues",
      transform: { type: "grouped", groupBy, metric: overrides.metric || "count" },
      chartType: normalizedQuestion.includes("doughnut") || normalizedQuestion.includes("donut") ? "doughnut" : "bar",
    };
  }

  if (normalizedQuestion.includes("table") || normalizedQuestion.includes("recent") || normalizedQuestion.includes("latest")) {
    return {
      resource: "issues",
      transform: { type: "raw" },
      chartType: "table",
    };
  }

  return {
    resource: "issues",
    transform: { type: "raw" },
    chartType: "kpi",
  };
}

function inferGroupBy(normalizedQuestion) {
  if (normalizedQuestion.includes("status category")) return "statusCategory";
  if (normalizedQuestion.includes("status")) return "status";
  if (normalizedQuestion.includes("assignee") || normalizedQuestion.includes("workload") || normalizedQuestion.includes("team load")) return "assignee";
  if (normalizedQuestion.includes("priority")) return "priority";
  if (normalizedQuestion.includes("issue type") || normalizedQuestion.includes("type")) return "issueType";
  if (normalizedQuestion.includes("project")) return "projectKey";
  return null;
}

function inferInterval(normalizedQuestion) {
  if (normalizedQuestion.includes("month")) return "month";
  if (normalizedQuestion.includes("week")) return "week";
  return "day";
}

function extractProjectKey(question = "", overrides = {}) {
  const explicitProject = overrides.project || overrides.projects || overrides.projectIdOrKey;
  if (explicitProject) {
    return Array.isArray(explicitProject) ? explicitProject[0] : String(explicitProject).split(",")[0].trim();
  }

  const ignored = new Set(["JIRA", "SCRUM", "SPRINT", "STATUS", "DONE", "OPEN"]);
  const matches = String(question || "").match(/\b[A-Z][A-Z0-9_]{1,12}\b/g) || [];
  return matches.find((match) => !ignored.has(match)) || null;
}

async function resolveActiveSprint({ connection, question = "", overrides = {} } = {}) {
  if (overrides.sprintId) {
    return {
      status: "resolved",
      sprintId: String(overrides.sprintId),
      boardId: overrides.boardId ? String(overrides.boardId) : "",
    };
  }

  if (!connection) return { status: "unresolved" };

  const projectKey = extractProjectKey(question, overrides);
  let boards = [];

  if (overrides.boardId) {
    boards = [{
      id: overrides.boardId,
      name: `Board ${overrides.boardId}`,
      type: "scrum",
    }];
  } else if (projectKey) {
    boards = await jiraConnection.listBoards(connection, {
      projectKeyOrId: projectKey,
      maxResults: 50,
    });
  } else {
    return { status: "unresolved" };
  }

  const activeSprints = [];
  const sprintBoards = boards.filter((board) => !board.type || board.type === "scrum" || board.type === "kanban");

  for (const board of sprintBoards.slice(0, 10)) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      const sprints = await jiraConnection.listSprints(connection, {
        boardId: board.id,
        maxResults: 50,
        state: "active",
      });
      sprints.forEach((sprint) => {
        if (sprint.state === "active") {
          activeSprints.push({
            ...sprint,
            boardId: board.id,
            boardName: board.name,
          });
        }
      });
    } catch (error) {
      // Some boards may not expose sprints to the current token; continue checking the rest.
    }
  }

  if (activeSprints.length === 1) {
    return {
      status: "resolved",
      sprintId: String(activeSprints[0].id),
      boardId: String(activeSprints[0].boardId),
      sprint: activeSprints[0],
      projectKey,
    };
  }

  if (activeSprints.length > 1) {
    return {
      status: "ambiguous",
      projectKey,
      options: activeSprints.slice(0, 4).map((sprint) => ({
        label: `Use ${sprint.name} on ${sprint.boardName}`,
        value: `sprint:${sprint.id}`,
      })),
    };
  }

  return {
    status: "unresolved",
    projectKey,
    boardCount: boards.length,
  };
}

function getOutputFields(config) {
  const transform = config.transform || {};

  if (transform.type === "grouped") {
    return [`root[].${transform.groupBy || "status"}`, "root[].issueCount", "root[].storyPoints"];
  }
  if (transform.type === "created_resolved_trend") {
    return ["root[].period", "root[].created", "root[].resolved", "root[].open"];
  }
  if (transform.type === "sprint_summary") {
    return ["root[].committedIssues", "root[].completedIssues", "root[].completionRate", "root[].committedStoryPoints", "root[].completedStoryPoints"];
  }

  return ["root[].key", "root[].summary", "root[].status", "root[].assignee", "root[].priority", "root[].createdAt", "root[].updatedAt", "root[].resolvedAt", "root[].doneAt"];
}

function getChartSpec(config, question, chartType) {
  const transform = config.transform || {};
  const title = makeTitle(question, config);

  if (transform.type === "grouped") {
    return {
      type: chartType || "bar",
      title,
      xAxis: `root[].${transform.groupBy || "status"}`,
      yAxis: transform.metric === "storyPoints" ? "root[].storyPoints" : "root[].issueCount",
      yAxisOperation: "none",
      legend: transform.metric === "storyPoints" ? "Story points" : "Issues",
      horizontal: true,
    };
  }
  if (transform.type === "created_resolved_trend") {
    return {
      type: "line",
      title,
      xAxis: "root[].period",
      yAxis: "root[].created",
      yAxisOperation: "none",
      dateField: "root[].period",
      timeInterval: transform.interval || "day",
      pointRadius: 0,
      includeZeros: true,
      legend: "Created",
    };
  }
  if (transform.type === "sprint_summary") {
    return {
      type: "gauge",
      title,
      xAxis: "root[].completionRate",
      yAxis: "root[].completionRate",
      yAxisOperation: "none",
      formula: "{val * 100}%",
      maxValue: 1,
      ranges: [
        { min: 0, max: 0.6, label: "At risk", color: "#EF4444" },
        { min: 0.6, max: 0.85, label: "Watch", color: "#F59E0B" },
        { min: 0.85, max: 1, label: "On track", color: "#10B981" },
      ],
    };
  }
  if (chartType === "table" || transform.type === "stale_table") {
    const columnsOrder = getOutputFields(config);
    return {
      type: "table",
      title,
      xAxis: "root[]",
      yAxis: columnsOrder[0],
      yAxisOperation: "none",
      columnsOrder,
      maxRecords: 100,
    };
  }

  return {
    type: "kpi",
    title,
    xAxis: "root[].key",
    yAxis: "root[].key",
    yAxisOperation: "count",
    subType: "AddTimeseries",
    legend: "Issues",
  };
}

function makeTitle(question, config) {
  const normalizedQuestion = String(question || "").trim();
  if (normalizedQuestion) {
    return normalizedQuestion.charAt(0).toUpperCase() + normalizedQuestion.slice(1).replace(/[?.!]+$/, "");
  }
  return JIRA_RESOURCES[config.resource]?.label || "Jira report";
}

function validateConfiguration(configuration) {
  return jiraProtocol.validateConfiguration({
    ...(configuration || {}),
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(configuration?.pagination || {}),
    },
  });
}

async function planDataset({ connection = null, question = "", overrides = {} } = {}) {
  const intent = resolveIntent(question, overrides);
  const normalizedQuestion = question.toLowerCase();
  const issueType = overrides.issueType || (normalizedQuestion.includes("bug") || normalizedQuestion.includes("defect") ? "Bug" : undefined);
  let sprintResolution = { status: "unresolved" };

  if (intent.resource === "sprint_issues") {
    sprintResolution = await resolveActiveSprint({ connection, question, overrides });

    if (sprintResolution.status === "ambiguous") {
      return {
        status: "needs_disambiguation",
        source: SOURCE_ID,
        message: `I found multiple active sprints${sprintResolution.projectKey ? ` for ${sprintResolution.projectKey}` : ""}. Which one should I use?`,
        options: sprintResolution.options,
      };
    }

    if (!overrides.sprintId && sprintResolution.status !== "resolved") {
      const projectLabel = sprintResolution.projectKey ? ` for project ${sprintResolution.projectKey}` : "";
      return {
        status: "needs_disambiguation",
        source: SOURCE_ID,
        message: `I couldn't reliably resolve the active sprint${projectLabel} from the Jira connector. Do you want me to try one of these approaches?`,
        options: [{
          label: sprintResolution.projectKey
            ? `Break down issues by status for ${sprintResolution.projectKey}`
            : "Break down issues by status",
          value: "status_breakdown",
        }, {
          label: "Help me pick the correct Jira board or sprint",
          value: "pick_board",
        }],
      };
    }
  }

  const sprintId = sprintResolution.status === "resolved"
    ? sprintResolution.sprintId
    : overrides.sprintId || "{{sprint_id}}";
  const boardId = sprintResolution.status === "resolved"
    ? sprintResolution.boardId
    : overrides.boardId || "{{board_id}}";
  const config = {
    source: SOURCE_ID,
    resource: intent.resource,
    mode: overrides.mode || (overrides.jql ? "jql" : "visual"),
    jql: buildJql({
      question,
      overrides,
      intent: {
        resource: intent.resource,
        issueType,
        priority: normalizedQuestion.includes("blocker") ? "Blocker" : undefined,
      },
    }),
    fields: overrides.fields || DEFAULT_FIELDS,
    sprintId,
    boardId,
    projectIdOrKey: overrides.projectIdOrKey || "{{projects}}",
    transform: overrides.transform || intent.transform,
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(overrides.pagination || {}),
    },
  };
  const validation = validateConfiguration(config);
  const chartSpec = getChartSpec(validation.configuration, question, intent.chartType);

  return {
    status: validation.valid ? "ok" : "invalid",
    source: SOURCE_ID,
    datasetName: chartSpec.title,
    configuration: validation.configuration,
    chartSpec,
    outputFields: getOutputFields(validation.configuration),
    warnings: validation.warnings,
    errors: validation.errors,
    rationale: {
      resource: validation.configuration.resource,
      mode: validation.configuration.mode,
      transform: validation.configuration.transform,
      issueType,
    },
  };
}

function buildColumns(rows, config) {
  if (rows[0]) {
    return Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] }));
  }

  return getOutputFields(config).map((field) => ({
    name: field.replace("root[].", ""),
    type: field.includes("Count") || field.includes("Points") || field.includes("Rate") ? "number" : "string",
  }));
}

async function previewConfiguration({ connection, configuration, rowLimit = 25 } = {}) {
  const validation = validateConfiguration(configuration);
  if (!validation.valid) {
    return {
      status: "invalid",
      ...validation,
    };
  }

  const previewConfig = {
    ...validation.configuration,
    pagination: {
      ...validation.configuration.pagination,
      maxRecords: Math.min(Number(validation.configuration.pagination?.maxRecords || rowLimit), rowLimit),
    },
  };
  const jiraRows = await jiraProtocol.fetchJiraRows(connection, previewConfig);
  const normalizedRows = ["issues", "sprint_issues"].includes(previewConfig.resource)
    ? jiraRows.map((issue) => jiraProtocol.normalizeIssue(issue, connection?.options?.jira?.fieldMappings || {}))
    : jiraRows;
  const rows = jiraProtocol.transformRows(normalizedRows, previewConfig);

  return {
    status: "ok",
    rows: rows.slice(0, rowLimit),
    columns: buildColumns(rows, previewConfig),
    rowCount: rows.length,
    warnings: validation.warnings,
    chartSpec: getChartSpec(previewConfig, ""),
  };
}

async function getSampleData({ connection, resource = "issues", rowLimit = 5 } = {}) {
  const plan = await planDataset({
    connection,
    question: resource === "sprint_issues" ? "sprint issue table" : "latest Jira issue table",
    overrides: {
      resource,
      transform: { type: "raw" },
      pagination: { maxRecords: rowLimit },
    },
  });

  return previewConfiguration({
    connection,
    configuration: plan.configuration,
    rowLimit,
  });
}

module.exports = {
  getCapabilities,
  getSampleData,
  getSchema,
  instructions: SOURCE_INSTRUCTIONS,
  listResources,
  listTemplates: getTemplates,
  planDataset,
  previewConfiguration,
  recommendTemplates,
  validateConfiguration,
};
