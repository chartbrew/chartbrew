const moment = require("moment-timezone");

const jiraProtocol = require("../jira.protocol");
const jiraResolver = require("./jira.resolver");
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
  "Use issue search and JQL for issue datasets. Use sprint_issues with sprintId and boardId for Agile sprint datasets.",
  "Use normalized issue fields such as key, summary, status, statusCategory, assignee, priority, issueType, createdAt, updatedAt, resolvedAt, doneAt, isDone, storyPoints, fixVersions, and epicKey.",
  "Use grouped, created_resolved_trend, sprint_summary, stale_table, or raw transforms to return chart-friendly rows.",
  "Keep previews capped. Use source_preview_configuration before creating charts when the user asks for unfamiliar JQL or sprint data.",
  "For Jira follow-ups, reuse previously resolved sprintId, boardId, and project key as source_plan_dataset overrides when they are visible in prior tool results.",
  "For active sprint questions without a project key or sprint override, ask which Jira project to use before searching records or planning a dataset.",
].join("\n");

const DISCOVERY_TARGETS = [
  "projects",
  "boards",
  "sprints",
  "versions",
  "users",
  "fields",
];

const SEMANTIC_INTENTS = [
  "sprint_status",
  "sprint_summary",
  "bug_breakdown",
  "release_progress",
  "team_workload",
  "created_resolved_trend",
  "stale_issues",
];

function uniqueResourceValues(field) {
  return Array.from(new Set(Object.values(JIRA_RESOURCES).flatMap((resource) => resource[field] || [])));
}

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
      directRecordSearch: true,
      discovery: DISCOVERY_TARGETS,
      semanticIntents: SEMANTIC_INTENTS,
      metrics: uniqueResourceValues("metrics"),
      dimensions: uniqueResourceValues("dimensions"),
      dateFields: uniqueResourceValues("dateFields"),
      riskPolicy: {
        preview: "best_match",
        persist: "disambiguate_meaningful_uncertainty",
      },
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
      metrics: resource.metrics || [],
      dimensions: resource.dimensions || [],
      filters: resource.filters || [],
      transforms: resource.transforms || getTransformsForResource(id),
      dateFields: resource.dateFields || [],
      requires: resource.requires || [],
      canAutoResolve: resource.canAutoResolve || [],
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

async function prepareTemplateVariables({
  connection = null,
  templateSlug = "",
  question = "",
  variableDefaults = {},
} = {}) {
  const sprintDefault = variableDefaults.sprint_id || variableDefaults.sprintId;
  const boardDefault = variableDefaults.board_id || variableDefaults.boardId;

  if (templateSlug !== "sprint-health" || (sprintDefault && boardDefault)) {
    return {
      variableDefaults,
    };
  }

  const resolvedContext = await jiraResolver.resolveContext({
    connection,
    question,
    overrides: {
      ...variableDefaults,
      sprintId: sprintDefault,
      boardId: boardDefault,
      project: variableDefaults.project || variableDefaults.projects,
    },
    intent: {
      id: "sprint_status",
      resource: "sprint_issues",
    },
    mode: "persist",
  });
  const resolution = resolvedContext.entities || {};

  if (resolvedContext.needsDisambiguation) {
    return {
      source: SOURCE_ID,
      status: "needs_disambiguation",
      needs_user_input: true,
      prompt: "I found multiple active Jira sprints. Which one should this dashboard use?",
      options: resolvedContext.options || [],
      resolution,
    };
  }

  if (!resolution.sprint?.id || !resolution.board?.id) {
    return {
      source: SOURCE_ID,
      status: "needs_more_context",
      needs_user_input: true,
      prompt: "I need a Jira project with a sprint and board before I can create this sprint health dashboard.",
      options: [],
      resolution,
    };
  }

  return {
    source: SOURCE_ID,
    status: "ok",
    variableDefaults: {
      ...variableDefaults,
      sprint_id: resolution.sprint.id,
      board_id: resolution.board?.id,
      project: resolution.project?.key || variableDefaults.project,
      projects: resolution.project?.key || variableDefaults.projects,
    },
    resolution,
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

function hasExplicitDateRange(question = "", overrides = {}) {
  const normalizedQuestion = question.toLowerCase();
  return Boolean(overrides.dateRange)
    || normalizedQuestion.includes("last month")
    || normalizedQuestion.includes("today")
    || /last\s+\d+\s+days?/.test(normalizedQuestion);
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
  const shouldSkipDefaultDateWindow = (intent.skipDefaultDateWindow || overrides.skipDefaultDateRange || overrides.skipDefaultDateWindow)
    && !hasExplicitDateRange(question, overrides);
  const projectValue = overrides.projects || overrides.project || extractProjectKey(question, overrides);
  const clauses = [];

  if (projectValue) clauses.push(`project IN (${quoteList(projectValue)})`);
  if (intent.issueType || overrides.issueType) clauses.push(`issuetype = ${quoteList(intent.issueType || overrides.issueType)}`);
  if (overrides.statusCategory || intent.statusCategory) clauses.push(`statusCategory = ${quoteList(overrides.statusCategory || intent.statusCategory)}`);
  if (intent.statusCategoryNotDone || overrides.statusCategoryNotDone) clauses.push("statusCategory != Done");
  if (overrides.status) clauses.push(`status = ${quoteList(overrides.status)}`);
  if (overrides.assignee) clauses.push(`assignee IN (${quoteList(overrides.assignee)})`);
  if (overrides.priority || intent.priority) clauses.push(`priority IN (${quoteList(overrides.priority || intent.priority)})`);
  if (overrides.fixVersion) clauses.push(`fixVersion IN (${quoteList(overrides.fixVersion)})`);
  if (intent.resource === "sprint_issues" || shouldSkipDefaultDateWindow) {
    // Some scoped Jira requests should not get default date variables unless asked explicitly.
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

function resolveOverrideIntent(question = "", overrides = {}) {
  if (overrides.intent === "created_resolved_trend") {
    return {
      id: "created_resolved_trend",
      resource: overrides.resource || "issues",
      transform: overrides.transform || {
        type: "created_resolved_trend",
        interval: overrides.interval || inferInterval(question.toLowerCase()),
      },
      chartType: overrides.chartType || "line",
    };
  }

  return {
    id: overrides.intent,
    resource: overrides.resource || "issues",
    transform: overrides.transform || { type: "raw" },
    chartType: overrides.chartType || "table",
  };
}

function resolveIntent(question = "", overrides = {}) {
  const normalizedQuestion = question.toLowerCase();
  const groupBy = overrides.groupBy || inferGroupBy(normalizedQuestion);

  if (overrides.intent) {
    return resolveOverrideIntent(question, overrides);
  }

  if (overrides.resource) {
    return {
      id: "issue_table",
      resource: overrides.resource,
      transform: overrides.transform || { type: "raw" },
      chartType: overrides.chartType || "table",
    };
  }

  if (normalizedQuestion.includes("release") || normalizedQuestion.includes("version") || normalizedQuestion.includes("fix version")) {
    return {
      id: "release_progress",
      resource: "issues",
      needsVersion: true,
      transform: { type: "grouped", groupBy: "statusCategory", metric: "count" },
      chartType: "bar",
    };
  }

  if (
    normalizedQuestion.includes("sprint")
    && (normalizedQuestion.includes("story point") || normalizedQuestion.includes("story points"))
    && (
      normalizedQuestion.includes("completed")
      || normalizedQuestion.includes("complete")
      || normalizedQuestion.includes("done")
      || normalizedQuestion.includes("finished")
    )
  ) {
    return {
      id: "sprint_completed_story_points",
      resource: "sprint_issues",
      needsSprint: true,
      needsUser: true,
      statusCategory: "Done",
      transform: { type: "raw" },
      chartType: "kpi",
    };
  }

  if (normalizedQuestion.includes("sprint") || overrides.sprintId) {
    const isSummary = normalizedQuestion.includes("summary")
      || normalizedQuestion.includes("completion")
      || normalizedQuestion.includes("health");
    const sprintGroupBy = groupBy || "status";
    const sprintMetric = ["status", "statusCategory"].includes(sprintGroupBy) ? "count" : "storyPoints";

    return {
      id: isSummary ? "sprint_summary" : "sprint_status",
      resource: "sprint_issues",
      needsSprint: true,
      transform: isSummary
        ? { type: "sprint_summary" }
        : { type: "grouped", groupBy: sprintGroupBy, metric: overrides.metric || sprintMetric },
      chartType: isSummary ? "gauge" : "bar",
    };
  }

  if (normalizedQuestion.includes("bug") || normalizedQuestion.includes("defect")) {
    return {
      id: "bug_breakdown",
      resource: "issues",
      issueType: "Bug",
      transform: { type: "grouped", groupBy: groupBy || "priority", metric: overrides.metric || "count" },
      chartType: "bar",
    };
  }

  if (normalizedQuestion.includes("stale") || normalizedQuestion.includes("stuck") || normalizedQuestion.includes("oldest")) {
    return {
      id: "stale_issues",
      resource: "issues",
      transform: { type: "stale_table" },
      chartType: "table",
    };
  }

  if (normalizedQuestion.includes("created vs resolved") || normalizedQuestion.includes("created and resolved") || normalizedQuestion.includes("trend") || normalizedQuestion.includes("over time")) {
    return {
      id: "created_resolved_trend",
      resource: "issues",
      transform: {
        type: "created_resolved_trend",
        interval: overrides.interval || inferInterval(normalizedQuestion),
      },
      chartType: "line",
    };
  }

  if (normalizedQuestion.includes("working on") || normalizedQuestion.includes("currently") || normalizedQuestion.includes("current tasks")) {
    return {
      id: "current_work",
      resource: "issues",
      needsUser: true,
      statusCategoryNotDone: true,
      skipDefaultDateWindow: true,
      transform: { type: "raw" },
      chartType: "table",
    };
  }

  if (normalizedQuestion.includes("completed") || normalizedQuestion.includes("done") || normalizedQuestion.includes("recent")) {
    return {
      id: "completed_work",
      resource: "issues",
      transform: { type: "raw" },
      chartType: "table",
    };
  }

  if (normalizedQuestion.includes("workload") || normalizedQuestion.includes("assignee") || normalizedQuestion.includes("team load")) {
    return {
      id: "team_workload",
      resource: "issues",
      transform: { type: "grouped", groupBy: "assignee", metric: overrides.metric || "count" },
      chartType: "bar",
    };
  }

  if (groupBy) {
    return {
      id: "issue_breakdown",
      resource: "issues",
      transform: { type: "grouped", groupBy, metric: overrides.metric || "count" },
      chartType: normalizedQuestion.includes("doughnut") || normalizedQuestion.includes("donut") ? "doughnut" : "bar",
    };
  }

  if (normalizedQuestion.includes("table") || normalizedQuestion.includes("recent") || normalizedQuestion.includes("latest")) {
    return {
      id: "issue_table",
      resource: "issues",
      transform: { type: "raw" },
      chartType: "table",
    };
  }

  return {
    id: "project_overview",
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
  return jiraResolver.extractProjectKey(question, overrides);
}

function firstOverrideValue(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : null;
  return String(value).split(",")[0].trim();
}

function extractVersionName(question = "", overrides = {}) {
  const explicitVersion = firstOverrideValue(overrides.fixVersion || overrides.version);
  if (explicitVersion) return explicitVersion;

  const match = String(question || "").match(/\bv?\d+(?:\.\d+){1,3}(?:[-_][A-Za-z0-9]+)?\b/i);
  return match ? match[0] : null;
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

  if (chartType === "kpi" && String(question || "").toLowerCase().includes("story point")) {
    return {
      type: "kpi",
      title,
      xAxis: "root[].storyPoints",
      yAxis: "root[].storyPoints",
      yAxisOperation: "sum",
      legend: "Completed pts",
    };
  }

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
      yAxisOperation: "sum",
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

function appendJqlClause(jql = "", clause = "") {
  const normalizedJql = String(jql || "").trim();
  const normalizedClause = String(clause || "").trim();
  if (!normalizedJql || !normalizedClause) return normalizedJql;
  if (normalizedJql.toLowerCase().includes(normalizedClause.toLowerCase())) return normalizedJql;

  const orderMatch = normalizedJql.match(/\s+ORDER\s+BY\s+[\s\S]*$/i);
  if (!orderMatch) return `${normalizedJql} AND ${normalizedClause}`;

  const baseJql = normalizedJql.slice(0, orderMatch.index).trim();
  return `${baseJql} AND ${normalizedClause}${orderMatch[0]}`;
}

function shouldRepairCompletedStoryPointsKpi({ question = "", configuration = {} } = {}) {
  const normalizedQuestion = String(question || "").toLowerCase();
  return configuration.source === SOURCE_ID
    && configuration.resource === "sprint_issues"
    && normalizedQuestion.includes("sprint")
    && normalizedQuestion.includes("story point")
    && (
      normalizedQuestion.includes("completed")
      || normalizedQuestion.includes("complete")
      || normalizedQuestion.includes("done")
      || normalizedQuestion.includes("finished")
    );
}

function repairDatasetIntent({ question = "", configuration = {} } = {}) {
  if (!shouldRepairCompletedStoryPointsKpi({ question, configuration })) return null;

  const repairedConfiguration = {
    ...configuration,
    jql: appendJqlClause(configuration.jql, "statusCategory = \"Done\""),
    transform: { type: "raw" },
  };
  const validation = validateConfiguration(repairedConfiguration);
  const chartSpec = getChartSpec(validation.configuration, question, "kpi");

  return {
    repaired: validation.valid,
    repairReason: "Use a KPI sum of completed Jira story points instead of the last issue estimate.",
    configuration: validation.configuration,
    chartSpec,
    validation,
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

function buildActions(intent, resolution = {}) {
  const actions = [];

  if (intent.resource === "sprint_issues") {
    actions.push({
      label: "Change sprint",
      value: "change_sprint",
    });
    actions.push({
      label: "Group by assignee",
      value: "group_by_assignee",
      overrides: {
        groupBy: "assignee",
      },
    });
  }

  if (resolution.project?.key) {
    actions.push({
      label: `Show status breakdown for ${resolution.project.key}`,
      value: "status_breakdown",
      overrides: {
        project: resolution.project.key,
        groupBy: "status",
      },
    });
  }

  if (intent.id !== "issue_table") {
    actions.push({
      label: "Show issue table",
      value: "show_table",
      overrides: {
        intent: "issue_table",
        transform: { type: "raw" },
        chartType: "table",
      },
    });
  }

  return actions;
}

function buildProjectStatusFallback({
  question,
  overrides = {},
  resolution = {},
  reason,
  warnings = [],
} = {}) {
  const projectKey = resolution.project?.key || overrides.projects || overrides.project;
  const clauses = ["statusCategory != Done"];
  if (projectKey) clauses.unshift(`project IN (${quoteList(projectKey)})`);
  const jql = `${clauses.join(" AND ")} ORDER BY updated DESC`;
  const config = {
    source: SOURCE_ID,
    resource: "issues",
    mode: overrides.mode || (overrides.jql ? "jql" : "visual"),
    jql,
    fields: overrides.fields || DEFAULT_FIELDS,
    projectIdOrKey: projectKey,
    transform: {
      type: "grouped",
      groupBy: "status",
      metric: "count",
    },
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(overrides.pagination || {}),
    },
  };
  const validation = validateConfiguration(config);
  const chartSpec = getChartSpec(validation.configuration, question, "bar");
  const fallbackIntent = {
    id: "status_breakdown_fallback",
    resource: "issues",
  };

  return {
    status: "fallback",
    source: SOURCE_ID,
    message: `I could not resolve the active sprint, so I planned a project status breakdown${reason ? `: ${reason}` : "."}`,
    datasetName: chartSpec.title,
    configuration: validation.configuration,
    chartSpec,
    outputFields: getOutputFields(validation.configuration),
    resolution,
    actions: buildActions(fallbackIntent, resolution),
    warnings: [
      ...validation.warnings,
      ...warnings,
    ],
    errors: validation.errors,
    rationale: {
      intent: fallbackIntent.id,
      resource: validation.configuration.resource,
      mode: validation.configuration.mode,
      transform: validation.configuration.transform,
    },
  };
}

function hasSprintProjectContext(question = "", overrides = {}) {
  return Boolean(
    overrides.sprintId
    || overrides.project
    || overrides.projects
    || overrides.projectIdOrKey
    || extractProjectKey(question, overrides)
  );
}

function buildProjectDisambiguation({
  intent,
  resolution = {},
  warnings = [],
} = {}) {
  return {
    status: "needs_disambiguation",
    source: SOURCE_ID,
    message: "Which Jira project should I use for the active sprint?",
    options: [],
    resolution,
    actions: buildActions(intent, resolution),
    warnings,
    errors: [],
    rationale: {
      intent: intent.id,
      resource: intent.resource,
      transform: intent.transform,
    },
  };
}

function getProjectStatusFallbackConfiguration(configuration = {}) {
  const projectKey = configuration.projectIdOrKey && !String(configuration.projectIdOrKey).includes("{{")
    ? configuration.projectIdOrKey
    : null;
  const clauses = ["statusCategory != Done"];
  if (projectKey) clauses.unshift(`project IN (${quoteList(projectKey)})`);

  return {
    ...configuration,
    resource: "issues",
    sprintId: undefined,
    boardId: undefined,
    projectIdOrKey: projectKey,
    jql: `${clauses.join(" AND ")} ORDER BY updated DESC`,
    transform: {
      type: "grouped",
      groupBy: "status",
      metric: "count",
    },
    includeDoneAt: false,
  };
}

function shouldFallbackSprintPreview(error) {
  return /sprint|agile|board/i.test(error?.message || "");
}

async function planDataset({
  connection = null,
  question = "",
  overrides = {},
  mode = "preview",
} = {}) {
  const intent = resolveIntent(question, overrides);
  const normalizedQuestion = question.toLowerCase();
  const issueType = overrides.issueType || intent.issueType || (normalizedQuestion.includes("bug") || normalizedQuestion.includes("defect") ? "Bug" : undefined);

  if (intent.resource === "sprint_issues" && !hasSprintProjectContext(question, overrides)) {
    return buildProjectDisambiguation({ intent });
  }

  const resolvedContext = await jiraResolver.resolveContext({
    connection,
    question,
    overrides,
    intent,
    mode: overrides.modeContext || mode,
  });
  const resolution = resolvedContext.entities || {};

  if (resolvedContext.needsDisambiguation) {
    return {
      status: "needs_disambiguation",
      source: SOURCE_ID,
      message: "I found multiple Jira matches. Which one should I use?",
      options: resolvedContext.options,
      resolution,
      actions: buildActions(intent, resolution),
      warnings: resolvedContext.warnings || [],
      errors: [],
      rationale: {
        intent: intent.id,
        resource: intent.resource,
        transform: intent.transform,
      },
    };
  }

  if (intent.resource === "sprint_issues" && !resolution.sprint?.id) {
    return buildProjectStatusFallback({
      question,
      overrides,
      resolution,
      reason: "no active sprint was found",
      warnings: resolvedContext.warnings || [],
    });
  }

  const sprintId = resolution.sprint?.id || overrides.sprintId || "{{sprint_id}}";
  const boardId = resolution.board?.id || overrides.boardId || "{{board_id}}";
  const projectKey = resolution.project?.key || overrides.projects || overrides.project;
  const fixVersion = resolution.version?.name
    || overrides.fixVersion
    || (intent.id === "release_progress" ? extractVersionName(question, overrides) : undefined);
  const assignee = resolution.user?.accountId || resolution.user?.displayName || overrides.assignee;
  const includeDoneAt = overrides.includeDoneAt
    || ["completed_work", "created_resolved_trend", "sprint_summary"].includes(intent.id);
  const config = {
    source: SOURCE_ID,
    resource: intent.resource,
    mode: overrides.mode || (overrides.jql ? "jql" : "visual"),
    jql: buildJql({
      question,
      overrides: {
        ...overrides,
        projects: projectKey,
        fixVersion,
        assignee,
      },
      intent: {
        resource: intent.resource,
        issueType,
        priority: normalizedQuestion.includes("blocker") ? "Blocker" : undefined,
        statusCategory: intent.statusCategory,
        skipDefaultDateWindow: intent.id === "release_progress" || intent.skipDefaultDateWindow,
        statusCategoryNotDone: intent.statusCategoryNotDone,
      },
    }),
    fields: overrides.fields || DEFAULT_FIELDS,
    sprintId,
    boardId,
    projectIdOrKey: projectKey,
    transform: overrides.transform || intent.transform,
    includeDoneAt,
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
    resolution,
    actions: buildActions(intent, resolution),
    warnings: [
      ...validation.warnings,
      ...(resolvedContext.warnings || []),
    ],
    errors: validation.errors,
    rationale: {
      intent: intent.id,
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

function getSearchOverrides(question = "", overrides = {}, filters = {}) {
  const normalizedQuestion = question.toLowerCase();
  const wantsOpenWork = filters.open === true
    || normalizedQuestion.includes("open")
    || normalizedQuestion.includes("working on")
    || normalizedQuestion.includes("currently")
    || normalizedQuestion.includes("current tasks")
    || normalizedQuestion.includes("active");

  return {
    ...overrides,
    ...(wantsOpenWork ? { statusCategoryNotDone: true } : {}),
    ...(!hasExplicitDateRange(question, overrides) ? { skipDefaultDateWindow: true } : {}),
  };
}

function pickSearchRecordFields(row, fields) {
  const defaultFields = ["key", "summary", "status", "assignee", "priority", "issueType", "updatedAt"];
  const fieldsToUse = Array.isArray(fields) && fields.length > 0 ? fields : defaultFields;

  return fieldsToUse.reduce((record, field) => ({
    ...record,
    [field]: row[field],
  }), {});
}

async function searchRecords({
  connection,
  question = "",
  resource = null,
  filters = {},
  jql = null,
  fields = null,
  rowLimit = 25,
  overrides = {},
} = {}) {
  const maxRecords = Math.min(Number(rowLimit || 25), 50);
  const searchOverrides = getSearchOverrides(question, {
    ...overrides,
    ...(resource ? { resource } : {}),
  }, filters);
  const plan = jql
    ? {
      status: "ok",
      configuration: {
        source: SOURCE_ID,
        resource: resource || "issues",
        mode: "jql",
        jql,
        fields: fields || DEFAULT_FIELDS,
        transform: { type: "raw" },
        pagination: {
          ...DEFAULT_PAGINATION,
          maxResults: maxRecords,
          maxRecords,
        },
      },
      resolution: {},
      warnings: [],
    }
    : await planDataset({
      connection,
      question,
      overrides: searchOverrides,
      mode: "preview",
    });

  if (["needs_disambiguation", "needs_more_context", "invalid"].includes(plan.status)) {
    return plan;
  }

  const configuration = {
    ...plan.configuration,
    fields: fields || plan.configuration.fields || DEFAULT_FIELDS,
    transform: { type: "raw" },
    pagination: {
      ...(plan.configuration.pagination || DEFAULT_PAGINATION),
      maxResults: maxRecords,
      maxRecords,
    },
  };
  const { normalizedRows } = await jiraProtocol.fetchNormalizedRows(connection, configuration);
  const rows = normalizedRows
    .slice(0, maxRecords)
    .map((row) => pickSearchRecordFields(row, fields));

  return {
    source: SOURCE_ID,
    status: "ok",
    resource: configuration.resource,
    rows,
    rowCount: rows.length,
    columns: buildColumns(rows, configuration),
    configuration,
    resolution: plan.resolution || {},
    warnings: plan.warnings || [],
  };
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
  let previewConfigToUse = previewConfig;
  let fallbackMessage = null;
  let normalizedRows;

  try {
    ({ normalizedRows } = await jiraProtocol.fetchNormalizedRows(connection, previewConfigToUse));
  } catch (error) {
    if (previewConfig.resource !== "sprint_issues" || !shouldFallbackSprintPreview(error)) throw error;

    previewConfigToUse = getProjectStatusFallbackConfiguration(previewConfig);
    ({ normalizedRows } = await jiraProtocol.fetchNormalizedRows(connection, previewConfigToUse));
    fallbackMessage = `I could not preview sprint issues, so I used the project status breakdown instead: ${error.message}`;
  }

  const rows = jiraProtocol.transformRows(normalizedRows, previewConfigToUse);

  return {
    status: fallbackMessage ? "fallback" : "ok",
    ...(fallbackMessage ? { message: fallbackMessage } : {}),
    rows: rows.slice(0, rowLimit),
    columns: buildColumns(rows, previewConfigToUse),
    rowCount: rows.length,
    warnings: fallbackMessage
      ? [...validation.warnings, fallbackMessage]
      : validation.warnings,
    chartSpec: getChartSpec(previewConfigToUse, ""),
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

async function resolveContext({
  connection,
  question = "",
  overrides = {},
  intent = {},
  mode = "preview",
} = {}) {
  const resolution = await jiraResolver.resolveContext({
    connection,
    question,
    overrides,
    intent,
    mode,
  });

  return {
    source: SOURCE_ID,
    resolution,
  };
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
  prepareTemplateVariables,
  recommendTemplates,
  repairDatasetIntent,
  resolveContext,
  searchRecords,
  validateConfiguration,
};
