import { DEFAULT_CONFIGURATION } from "./jira.source";

export function formatDateValue(date) {
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);

  return {
    startDate: formatDateValue(start),
    endDate: formatDateValue(end),
  };
}

function resolveRelativeDateValue(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const today = new Date();

  if (["now", "now()", "today"].includes(normalizedValue)) {
    return formatDateValue(today);
  }

  const lastDaysMatch = normalizedValue.match(/^last_(\d+)_days$/);
  if (lastDaysMatch) {
    const date = new Date(today);
    date.setDate(date.getDate() - Number(lastDaysMatch[1]));
    return formatDateValue(date);
  }

  const relativeDaysMatch = normalizedValue.match(/^([+-]?\d+)d$/);
  if (relativeDaysMatch) {
    const date = new Date(today);
    date.setDate(date.getDate() + Number(relativeDaysMatch[1]));
    return formatDateValue(date);
  }

  return null;
}

export function normalizeDateRangeValue(value, fallback) {
  if (!value) return fallback;
  if (/^\{\{[^}]+\}\}$/.test(String(value || "").trim())) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value;
  const relativeDate = resolveRelativeDateValue(value);
  if (relativeDate) return relativeDate;
  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) return formatDateValue(parsedDate);
  return fallback;
}

export function getPlaceholderVariableName(value) {
  const match = String(value || "").trim().match(/^\{\{([^}]+)\}\}$/);
  return match?.[1]?.trim() || null;
}

function inferVisualValueFromJql(jql = "", fieldNames = [], operator = "=") {
  const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  const escapedFields = fields
    .filter(Boolean)
    .map((field) => String(field).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  if (!escapedFields) return "";

  const escapedOperator = String(operator).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(jql || "").match(new RegExp(`(?:${escapedFields})\\s*${escapedOperator}\\s*([^\\s)]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function inferProjectValueFromJql(jql = "") {
  const inMatch = String(jql || "").match(/project\s+IN\s*\(([^)]+)\)/i);
  if (inMatch) return inMatch[1].trim();

  const equalsMatch = String(jql || "").match(/project\s*=\s*([^\s)]+)/i);
  return equalsMatch?.[1]?.trim() || "";
}

function normalizeCsvValue(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export function normalizeVisualConfig(visual = {}) {
  const defaultRange = getDefaultDateRange();

  return {
    ...visual,
    projects: normalizeCsvValue(visual.projects),
    dateField: visual.dateField || "created",
    startDate: normalizeDateRangeValue(visual.startDate, defaultRange.startDate),
    endDate: normalizeDateRangeValue(visual.endDate, defaultRange.endDate),
  };
}

export function mergeConfiguration(dataRequest) {
  const requestConfiguration = dataRequest?.configuration || {};
  const requestVisual = requestConfiguration.visual || {};
  const inferredVisual = {
    projects: requestVisual.projects || inferProjectValueFromJql(requestConfiguration.jql),
    startDate: requestVisual.startDate || inferVisualValueFromJql(requestConfiguration.jql, [
      "created",
      "updated",
      "resolutiondate",
      "statusCategoryChangedDate",
    ], ">="),
    endDate: requestVisual.endDate || inferVisualValueFromJql(requestConfiguration.jql, [
      "created",
      "updated",
      "resolutiondate",
      "statusCategoryChangedDate",
    ], "<="),
  };
  const mergedConfiguration = {
    ...DEFAULT_CONFIGURATION,
    ...requestConfiguration,
    fields: requestConfiguration.fields || DEFAULT_CONFIGURATION.fields,
    transform: {
      ...DEFAULT_CONFIGURATION.transform,
      ...(requestConfiguration.transform || {}),
    },
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(requestConfiguration.pagination || {}),
    },
    visual: normalizeVisualConfig({
      ...(DEFAULT_CONFIGURATION.visual || {}),
      ...inferredVisual,
      ...requestVisual,
    }),
  };

  if ((mergedConfiguration.mode || "visual") === "visual") {
    return {
      ...mergedConfiguration,
      jql: buildJqlFromVisualConfig(mergedConfiguration),
    };
  }

  return mergedConfiguration;
}

function quoteJqlValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return `"${String(value).replace(/"/g, "\\\"")}"`;
}

function addClause(clauses, clause) {
  if (clause) clauses.push(clause);
}

function getJqlDateField(dateField) {
  if (dateField === "doneAt") return "statusCategoryChangedDate";
  return dateField || "created";
}

export function buildJqlFromVisualConfig(configuration) {
  const visual = configuration.visual || {};
  const clauses = [];
  const dateField = visual.dateField || "created";
  const jqlDateField = getJqlDateField(dateField);
  const isDoneDateField = dateField === "doneAt";
  const projects = normalizeCsvValue(visual.projects);

  addClause(clauses, projects ? `project IN (${projects})` : null);
  addClause(clauses, visual.issueType ? `issuetype = ${quoteJqlValue(visual.issueType)}` : null);
  addClause(clauses, isDoneDateField ? "statusCategory = Done" : null);
  addClause(clauses, !isDoneDateField && visual.statusCategory ? `statusCategory = ${quoteJqlValue(visual.statusCategory)}` : null);
  addClause(clauses, visual.assignee ? `assignee = ${quoteJqlValue(visual.assignee)}` : null);
  addClause(clauses, visual.priority ? `priority = ${quoteJqlValue(visual.priority)}` : null);
  addClause(clauses, visual.fixVersion ? `fixVersion = ${quoteJqlValue(visual.fixVersion)}` : null);
  addClause(clauses, visual.startDate ? `${jqlDateField} >= ${visual.startDate}` : null);
  addClause(clauses, visual.endDate ? `${jqlDateField} <= ${visual.endDate}` : null);

  const query = clauses.join(" AND ");
  return query ? `${query} ORDER BY ${isDoneDateField ? "updated" : jqlDateField} DESC` : "ORDER BY updated DESC";
}

export function withVisualJql(configuration, visualUpdates = {}) {
  const nextConfiguration = {
    ...configuration,
    visual: {
      ...(configuration.visual || {}),
      ...visualUpdates,
    },
  };

  return {
    ...nextConfiguration,
    jql: buildJqlFromVisualConfig(nextConfiguration),
  };
}

export function getDefaultsForResource(resource, currentConfiguration = {}) {
  const currentVisual = currentConfiguration.visual || {};
  const currentTransform = currentConfiguration.transform || {};
  const base = {
    resource,
    mode: "visual",
    transform: {
      type: "raw",
    },
  };

  if (resource === "issues") {
    const issueTransform = currentConfiguration.resource === "issues"
      && ["grouped", "created_resolved_trend", "stale_table", "raw"].includes(currentTransform.type)
      ? currentTransform
      : { type: "raw" };
    const nextConfiguration = {
      ...currentConfiguration,
      ...base,
      visual: currentVisual,
      transform: issueTransform,
    };

    return {
      ...nextConfiguration,
      jql: buildJqlFromVisualConfig(nextConfiguration),
    };
  }

  if (resource === "sprint_issues") {
    const sprintIssueTransform = currentConfiguration.resource === "sprint_issues"
      && ["grouped", "sprint_summary", "stale_table", "raw"].includes(currentTransform.type)
      ? currentTransform
      : { type: "sprint_summary" };
    return {
      ...base,
      boardId: currentConfiguration.boardId || "",
      sprintId: currentConfiguration.sprintId || "",
      jql: currentConfiguration.resource === "sprint_issues" ? currentConfiguration.jql || "" : "",
      transform: sprintIssueTransform,
      pagination: currentConfiguration.pagination,
    };
  }

  if (resource === "boards") {
    return {
      ...base,
      projectIdOrKey: currentConfiguration.projectIdOrKey || currentVisual.projects || "",
      boardType: currentConfiguration.boardType || "",
      jql: "",
      pagination: currentConfiguration.pagination,
    };
  }

  if (resource === "sprints") {
    return {
      ...base,
      boardId: currentConfiguration.boardId || "",
      state: currentConfiguration.state || "active",
      jql: "",
      pagination: currentConfiguration.pagination,
    };
  }

  if (resource === "versions") {
    return {
      ...base,
      projectIdOrKey: currentConfiguration.projectIdOrKey || currentVisual.projects || "",
      jql: "",
      pagination: currentConfiguration.pagination,
    };
  }

  return base;
}

export function getPreviewRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.response?.dataRequest?.responseData?.data)) {
    return payload.response.dataRequest.responseData.data;
  }
  return [];
}

export function getPreviewColumns(payload) {
  const firstRow = getPreviewRows(payload)[0];
  return firstRow ? Object.keys(firstRow) : [];
}

export function getSuggestedCharts(configuration) {
  if (configuration.transform?.type === "grouped") return ["Bar", "Doughnut", "Table"];
  if (configuration.transform?.type === "created_resolved_trend") return ["Line", "Bar"];
  if (configuration.transform?.type === "sprint_summary") return ["KPI", "Gauge"];
  if (configuration.transform?.type === "stale_table") return ["Table"];
  return ["Table"];
}

export function formatPreviewValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
