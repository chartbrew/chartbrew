const moment = require("moment-timezone");

const db = require("../../../models/models");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { processVariablesInString } = require("../../shared/variables/stringVariables");
const { serializeResponsePreview } = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../../shared/connectorRuntime");
const jiraConnection = require("./jira.connection");
const { DEFAULT_FIELDS, JIRA_RESOURCES } = require("./jira.resources");

const DEFAULT_CONFIGURATION = {
  source: "jira",
  resource: "issues",
  mode: "visual",
  jql: "created >= {{start_date}} AND created <= {{end_date}} ORDER BY updated DESC",
  fields: DEFAULT_FIELDS,
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

function getDefaultDataRequest() {
  return {
    method: "GET",
    route: null,
    headers: {},
    body: null,
    conditions: null,
    configuration: { ...DEFAULT_CONFIGURATION },
    query: null,
    pagination: true,
    items: "issues",
    itemsLimit: 5000,
    offset: "startAt",
    paginationField: null,
    template: "jira",
    useGlobalHeaders: true,
  };
}

function getConfiguration(dataRequest = {}) {
  const configuration = dataRequest.configuration || {};
  return {
    ...DEFAULT_CONFIGURATION,
    ...configuration,
    fields: configuration.fields || DEFAULT_CONFIGURATION.fields,
    transform: {
      ...DEFAULT_CONFIGURATION.transform,
      ...(configuration.transform || {}),
    },
    visual: {
      ...DEFAULT_CONFIGURATION.visual,
      ...(configuration.visual || {}),
    },
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(configuration.pagination || {}),
    },
  };
}

function validateConfiguration(configuration = {}) {
  const config = getConfiguration({ configuration });
  const errors = [];

  if (config.source !== "jira") {
    errors.push("configuration.source must be jira");
  }

  if (!JIRA_RESOURCES[config.resource]) {
    errors.push(`Unsupported Jira resource: ${config.resource || "missing"}`);
  }

  if (!["visual", "jql", "advanced"].includes(config.mode)) {
    errors.push("mode must be visual, jql, or advanced");
  }

  if (config.resource === "issues" && !String(config.jql || "").trim()) {
    errors.push("jql is required for issue searches");
  }
  if (config.resource === "sprints" && !config.boardId) {
    errors.push("boardId is required for sprint requests");
  }
  if (config.resource === "versions" && !config.projectIdOrKey) {
    errors.push("projectIdOrKey is required for version requests");
  }

  const maxResults = Number(config.pagination?.maxResults);
  const maxRecords = Number(config.pagination?.maxRecords);
  if (!Number.isFinite(maxResults) || maxResults <= 0 || maxResults > 100) {
    errors.push("pagination.maxResults must be between 1 and 100");
  }
  if (!Number.isFinite(maxRecords) || maxRecords <= 0 || maxRecords > 10000) {
    errors.push("pagination.maxRecords must be between 1 and 10000");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    configuration: config,
  };
}

function assertValidConfiguration(configuration) {
  const validation = validateConfiguration(configuration);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }
  return validation.configuration;
}

function getBuilderMetadata() {
  return Promise.resolve({
    source: "jira",
    resources: JIRA_RESOURCES,
    defaults: DEFAULT_CONFIGURATION,
  });
}

function getSavedConnection(connection) {
  if (!connection?.id) return Promise.resolve(connection);

  return db.Connection.findByPk(connection.id)
    .then((savedConnection) => savedConnection || connection)
    .catch(() => connection);
}

function parseMaybeJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getJiraOptions(connection) {
  const options = parseMaybeJson(connection?.options, {});
  return options?.jira || {};
}

function convertVariableValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function processConfigValue(value, dataRequest, variables) {
  if (typeof value === "string") {
    return processVariablesInString({
      value,
      dataRequest: {
        ...dataRequest,
        VariableBindings: dataRequest.VariableBindings || [],
      },
      variables,
      convertValue: convertVariableValue,
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => processConfigValue(item, dataRequest, variables));
  }

  if (value && typeof value === "object") {
    return Object.keys(value).reduce((processed, key) => ({
      ...processed,
      [key]: processConfigValue(value[key], dataRequest, variables),
    }), {});
  }

  return value;
}

function applyVariables({ dataRequest, variables }) {
  const processedConfiguration = processConfigValue(dataRequest.configuration || {}, dataRequest, variables || {});

  return {
    dataRequest,
    processedDataRequest: {
      ...dataRequest,
      configuration: processedConfiguration,
      Connection: dataRequest.Connection,
      VariableBindings: dataRequest.VariableBindings,
    },
  };
}

function getSchema() {
  return Promise.resolve({
    source: "jira",
    entities: Object.entries(JIRA_RESOURCES).map(([name, resource]) => ({
      name,
      label: resource.label,
      endpoint: resource.endpoint,
      columns: (resource.fields || []).map((field) => ({
        name: field,
        type: field.includes("date") || ["created", "updated", "resolutiondate"].includes(field) ? "date" : "string",
      })),
    })),
  });
}

function readMappedField(fields, fieldId) {
  if (!fieldId) return null;
  const value = fields[fieldId];
  if (value === undefined || value === null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value.value || value.name || value.displayName || value.key || null;
  }
  return value;
}

function normalizeLookupValue(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isDoneStatusCategory(statusCategory = {}) {
  return ["done", "completed"].includes(normalizeLookupValue(statusCategory.key))
    || normalizeLookupValue(statusCategory.name) === "done";
}

function getDefaultDoneStatusLookup() {
  return {
    ids: new Set(),
    names: new Set(["done", "closed", "resolved"]),
  };
}

function getDoneStatusLookup(statuses = []) {
  const lookup = getDefaultDoneStatusLookup();

  statuses.forEach((status) => {
    if (isDoneStatusCategory({
      key: status.statusCategoryKey,
      name: status.statusCategory,
    })) {
      if (status.id) lookup.ids.add(String(status.id));
      if (status.name) lookup.names.add(normalizeLookupValue(status.name));
    }
  });

  return lookup;
}

async function loadDoneStatusLookup(connection) {
  try {
    const statuses = await jiraConnection.listStatuses(connection);
    return getDoneStatusLookup(statuses);
  } catch (error) {
    return getDefaultDoneStatusLookup();
  }
}

function getChangelogHistories(issue = {}) {
  if (Array.isArray(issue.changelog?.histories)) return issue.changelog.histories;
  if (Array.isArray(issue.changelog?.values)) return issue.changelog.values;
  return [];
}

function getDoneAtFromChangelog(issue, doneStatusLookup) {
  const fields = issue.fields || {};
  const currentStatus = fields.status || {};

  if (!isDoneStatusCategory(currentStatus.statusCategory || {})) {
    return null;
  }

  const lookup = doneStatusLookup || getDefaultDoneStatusLookup();
  const histories = getChangelogHistories(issue)
    .filter((history) => history?.created)
    .sort((a, b) => String(a.created).localeCompare(String(b.created)));
  let doneAt = null;

  histories.forEach((history) => {
    (history.items || []).forEach((item) => {
      if (normalizeLookupValue(item.fieldId || item.field) !== "status") return;

      const targetStatusId = String(item.to || "");
      const targetStatusName = normalizeLookupValue(item.toString);
      if (lookup.ids.has(targetStatusId) || lookup.names.has(targetStatusName)) {
        doneAt = history.created;
      }
    });
  });

  return doneAt;
}

function normalizeIssue(issue, fieldMappings = {}, options = {}) {
  const fields = issue.fields || {};
  const doneAtFromChangelog = options.includeDoneAt
    ? getDoneAtFromChangelog(issue, options.doneStatusLookup)
    : null;
  const normalizedIssue = {
    key: issue.key,
    summary: fields.summary || "",
    projectKey: fields.project?.key || null,
    issueType: fields.issuetype?.name || null,
    status: fields.status?.name || null,
    statusCategory: fields.status?.statusCategory?.name || null,
    assignee: fields.assignee?.displayName || null,
    reporter: fields.reporter?.displayName || null,
    priority: fields.priority?.name || null,
    createdAt: fields.created || null,
    updatedAt: fields.updated || null,
    resolvedAt: fields.resolutiondate || null,
    doneAt: doneAtFromChangelog || fields.resolutiondate || null,
    isDone: isDoneStatusCategory(fields.status?.statusCategory || {}),
    storyPoints: Number(readMappedField(fields, fieldMappings.storyPoints) || 0),
    severity: readMappedField(fields, fieldMappings.severity),
    team: readMappedField(fields, fieldMappings.team),
    labels: fields.labels || [],
    fixVersions: (fields.fixVersions || []).map((version) => version.name),
    epicKey: fields.parent?.key || readMappedField(fields, fieldMappings.epic) || null,
  };

  if (issue._trendEvent) {
    normalizedIssue._trendEvent = issue._trendEvent;
  }

  return normalizedIssue;
}

function getGroupValue(row, groupBy) {
  const value = row[groupBy];
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  return value || "None";
}

function transformGrouped(rows, transform = {}) {
  const groupBy = transform.groupBy || "status";
  const grouped = new Map();

  rows.forEach((row) => {
    const label = getGroupValue(row, groupBy);
    const current = grouped.get(label) || {
      [groupBy]: label,
      issueCount: 0,
      storyPoints: 0,
    };

    current.issueCount += 1;
    current.storyPoints += Number(row.storyPoints || 0);
    grouped.set(label, current);
  });

  return Array.from(grouped.values());
}

function getPeriod(value, interval = "day") {
  const date = moment(value);
  if (!date.isValid()) return null;
  if (interval === "week") return date.startOf("isoWeek").format("YYYY-MM-DD");
  if (interval === "month") return date.startOf("month").format("YYYY-MM-DD");
  return date.format("YYYY-MM-DD");
}

function transformCreatedResolvedTrend(rows, transform = {}) {
  const byPeriod = new Map();
  const interval = transform.interval || "day";

  rows.forEach((row) => {
    const shouldCountCreated = !row._trendEvent || row._trendEvent === "created";
    const shouldCountResolved = !row._trendEvent || row._trendEvent === "resolved";

    const createdPeriod = shouldCountCreated ? getPeriod(row.createdAt, interval) : null;
    if (createdPeriod) {
      const current = byPeriod.get(createdPeriod) || { period: createdPeriod, created: 0, resolved: 0, open: 0 };
      current.created += 1;
      byPeriod.set(createdPeriod, current);
    }

    const resolvedPeriod = shouldCountResolved ? getPeriod(row.doneAt || row.resolvedAt, interval) : null;
    if (resolvedPeriod) {
      const current = byPeriod.get(resolvedPeriod) || { period: resolvedPeriod, created: 0, resolved: 0, open: 0 };
      current.resolved += 1;
      byPeriod.set(resolvedPeriod, current);
    }
  });

  let open = 0;
  return Array.from(byPeriod.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((row) => {
      open += row.created - row.resolved;
      return { ...row, open };
    });
}

function transformSprintSummary(rows) {
  const completedRows = rows.filter((row) => row.statusCategory === "Done");
  const totalStoryPoints = rows.reduce((sum, row) => sum + Number(row.storyPoints || 0), 0);
  const completedStoryPoints = completedRows.reduce((sum, row) => sum + Number(row.storyPoints || 0), 0);

  return [{
    committedIssues: rows.length,
    completedIssues: completedRows.length,
    completionRate: rows.length ? completedRows.length / rows.length : 0,
    committedStoryPoints: totalStoryPoints,
    completedStoryPoints,
  }];
}

function transformRows(rows, config = {}) {
  const transform = config.transform || {};

  if (transform.type === "grouped") {
    return transformGrouped(rows, transform);
  }
  if (transform.type === "created_resolved_trend") {
    return transformCreatedResolvedTrend(rows, transform);
  }
  if (transform.type === "sprint_summary") {
    return transformSprintSummary(rows);
  }
  if (transform.type === "stale_table") {
    return [...rows].sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
  }

  return rows;
}

function getFieldMappings(connection) {
  return getJiraOptions(connection).fieldMappings || {};
}

function getSearchRoute(config) {
  if (config.resource === "sprint_issues") {
    if (!config.sprintId) {
      throw new Error("sprintId is required for sprint issue requests");
    }
    return `/rest/agile/1.0/sprint/${config.sprintId}/issue`;
  }

  return "/rest/api/3/search/jql";
}

function normalizeFields(fields) {
  if (Array.isArray(fields)) return fields;
  return String(fields || "").split(",").map((field) => field.trim()).filter(Boolean);
}

function shouldIncludeDoneAt(config = {}) {
  const transformType = config.transform?.type || "raw";
  return Boolean(config.includeDoneAt)
    || ["created_resolved_trend", "sprint_summary"].includes(transformType);
}

function getExpandValues(config = {}) {
  const expand = Array.isArray(config.expand)
    ? config.expand
    : String(config.expand || "").split(",");
  const expandValues = expand.map((value) => String(value || "").trim()).filter(Boolean);

  if (shouldIncludeDoneAt(config) && !expandValues.includes("changelog")) {
    expandValues.push("changelog");
  }

  return expandValues;
}

function buildIssueSearchBody(config, nextPageToken = null) {
  const maxResults = Math.min(Number(config.pagination?.maxResults || 100), 100);
  const expand = getExpandValues(config);
  const body = {
    jql: config.jql,
    fields: normalizeFields(config.fields),
    maxResults,
  };

  if (expand.length > 0) {
    body.expand = expand.join(",");
  }

  if (nextPageToken) {
    body.nextPageToken = nextPageToken;
  }

  return body;
}

function stripOrderBy(jql = "") {
  return String(jql || "").replace(/\s+ORDER\s+BY[\s\S]*$/i, "").trim();
}

function extractTrendDateValue(jql = "", field, operator) {
  const escapedField = String(field).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedOperator = String(operator).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(jql || "").match(new RegExp(`${escapedField}\\s*${escapedOperator}\\s*("(?:\\\\"|[^"])*"|now\\(\\)|[^\\s)]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function getTrendDateRange(config = {}) {
  const jql = config.jql || "";
  const visual = config.visual || {};
  const startDate = extractTrendDateValue(jql, "created", ">=")
    || extractTrendDateValue(jql, "statusCategoryChangedDate", ">=")
    || (visual.startDate && !String(visual.startDate).includes("{{") ? visual.startDate : "");
  const endDate = extractTrendDateValue(jql, "created", "<=")
    || extractTrendDateValue(jql, "statusCategoryChangedDate", "<=")
    || (visual.endDate && !String(visual.endDate).includes("{{") ? visual.endDate : "");

  return { startDate, endDate };
}

function getTrendBaseJql(jql = "") {
  const withoutOrder = stripOrderBy(jql);
  const templateDateBlockIndex = withoutOrder.search(/\s+AND\s+\(\(\s*created\s*>=/i);
  if (templateDateBlockIndex > -1) {
    return withoutOrder.slice(0, templateDateBlockIndex).trim();
  }

  return withoutOrder
    .replace(/\s+AND\s+created\s*>=\s*[^\s)]+/gi, "")
    .replace(/\s+AND\s+created\s*<=\s*[^\s)]+/gi, "")
    .replace(/\s+AND\s+statusCategoryChangedDate\s*>=\s*[^\s)]+/gi, "")
    .replace(/\s+AND\s+statusCategoryChangedDate\s*<=\s*[^\s)]+/gi, "")
    .trim();
}

function appendJqlClause(baseJql, clause) {
  const base = String(baseJql || "").trim();
  return base ? `${base} AND ${clause}` : clause;
}

function getCreatedResolvedTrendConfigs(config = {}) {
  const { startDate, endDate } = getTrendDateRange(config);
  if (!startDate || !endDate) return null;

  const baseJql = getTrendBaseJql(config.jql);

  return [{
    event: "created",
    config: {
      ...config,
      jql: `${appendJqlClause(baseJql, `created >= ${startDate} AND created <= ${endDate}`)} ORDER BY created ASC`,
    },
  }, {
    event: "resolved",
    config: {
      ...config,
      jql: `${appendJqlClause(baseJql, `statusCategory = Done AND statusCategoryChangedDate >= ${startDate} AND statusCategoryChangedDate <= ${endDate}`)} ORDER BY updated ASC`,
    },
  }];
}

async function fetchIssueRows(connection, config) {
  const rows = [];
  const maxRecords = Math.min(Number(config.pagination?.maxRecords || 5000), 10000);
  let nextPageToken = null;
  let hasMore = true;

  while (hasMore && rows.length < maxRecords) {
    // oxlint-disable-next-line no-await-in-loop
    const response = await jiraConnection.jiraRequest(connection, getSearchRoute(config), {
      method: "POST",
      body: buildIssueSearchBody(config, nextPageToken),
    });
    const pageRows = Array.isArray(response?.issues) ? response.issues : [];
    rows.push(...pageRows);
    nextPageToken = response?.nextPageToken || null;
    hasMore = pageRows.length > 0 && Boolean(nextPageToken) && rows.length < maxRecords;
  }

  return rows.slice(0, maxRecords);
}

async function fetchCreatedResolvedTrendIssueRows(connection, config) {
  const trendConfigs = getCreatedResolvedTrendConfigs(config);
  if (!trendConfigs) {
    return fetchIssueRows(connection, config);
  }

  const rows = [];

  await trendConfigs.reduce((promise, trendConfig) => promise.then(async () => {
    const trendRows = await fetchIssueRows(connection, trendConfig.config);
    rows.push(...trendRows.map((row) => ({
      ...row,
      _trendEvent: trendConfig.event,
    })));
  }), Promise.resolve());

  return rows;
}

function buildSprintIssueSearchParams(config, startAt) {
  const maxResults = Math.min(Number(config.pagination?.maxResults || 100), 100);
  const expand = getExpandValues(config);
  const params = {
    fields: Array.isArray(config.fields) ? config.fields.join(",") : config.fields,
    startAt,
    maxResults,
  };
  const jql = String(config.jql || "").trim();

  if (jql && !jql.includes("{{")) {
    params.jql = jql;
  }

  if (expand.length > 0) {
    params.expand = expand.join(",");
  }

  return params;
}

async function fetchJiraRows(connection, config) {
  if (config.resource === "boards") {
    const boards = await jiraConnection.listBoards(connection, {
      maxResults: Math.min(Number(config.pagination?.maxRecords || 50), 50),
      projectKeyOrId: config.projectIdOrKey,
      type: config.boardType,
    });
    return boards;
  }

  if (config.resource === "sprints") {
    const sprints = await jiraConnection.listSprints(connection, {
      boardId: config.boardId,
      maxResults: Math.min(Number(config.pagination?.maxRecords || 50), 50),
      state: config.state,
    });
    return sprints;
  }

  if (config.resource === "versions") {
    const versions = await jiraConnection.listVersions(connection, {
      projectIdOrKey: config.projectIdOrKey,
    });
    return versions.slice(0, Number(config.pagination?.maxRecords || 100));
  }

  if (config.resource === "issues") {
    if (config.transform?.type === "created_resolved_trend") {
      return fetchCreatedResolvedTrendIssueRows(connection, config);
    }

    return fetchIssueRows(connection, config);
  }

  const rows = [];
  const maxResults = Math.min(Number(config.pagination?.maxResults || 100), 100);
  const maxRecords = Math.min(Number(config.pagination?.maxRecords || 5000), 10000);
  let startAt = Number(config.pagination?.startAt || 0);
  let hasMore = true;

  while (hasMore && rows.length < maxRecords) {
    // oxlint-disable-next-line no-await-in-loop
    const response = await jiraConnection.jiraRequest(connection, getSearchRoute(config), {
      qs: buildSprintIssueSearchParams(config, startAt),
    });
    const pageRows = Array.isArray(response?.issues) ? response.issues : [];
    rows.push(...pageRows);

    const nextStart = startAt + maxResults;
    const total = Number(response?.total || rows.length);
    hasMore = pageRows.length > 0
      && pageRows.length >= maxResults
      && nextStart < total
      && rows.length < maxRecords;
    startAt = nextStart;
  }

  return rows.slice(0, maxRecords);
}

async function testConnection({ connection }) {
  const myself = await jiraConnection.getMyself(connection);
  return {
    success: true,
    metadata: {
      accountId: myself.accountId || null,
      displayName: myself.displayName || null,
      emailAddress: myself.emailAddress || null,
    },
  };
}

function testUnsavedConnection({ connection }) {
  return testConnection({ connection });
}

async function prepareConnectionData({ connection }) {
  const credentials = jiraConnection.getCredentials(connection);
  let metadata = null;

  try {
    metadata = await jiraConnection.getMyself(connection);
  } catch (error) {
    metadata = null;
  }

  return {
    ...connection,
    type: "jira",
    subType: "jira",
    host: credentials.siteUrl,
    schema: {
      ...(connection.schema || {}),
      jira: {
        accountId: metadata?.accountId || null,
        displayName: metadata?.displayName || null,
        emailAddress: metadata?.emailAddress || null,
        siteUrl: credentials.siteUrl,
      },
      resources: Object.keys(JIRA_RESOURCES),
    },
    options: {
      ...(connection.options || {}),
      jira: {
        ...(connection.options?.jira || {}),
        siteUrl: credentials.siteUrl,
      },
    },
  };
}

async function runDataRequest({
  connection,
  dataRequest,
  getCache,
  processedDataRequest = null,
  auditContext = null,
}) {
  const savedConnection = await getSavedConnection(connection);
  const dataRequestToRun = processedDataRequest || dataRequest;
  const config = assertValidConfiguration(dataRequestToRun.configuration || {});

  if (getCache) {
    const drCache = await checkAndGetCache(savedConnection.id, dataRequest);
    if (drCache) {
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType: "jira",
        resource: config.resource,
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  try {
    const jiraRows = await fetchJiraRows(savedConnection, config);
    const fieldMappings = getFieldMappings(savedConnection);
    const includeDoneAt = shouldIncludeDoneAt(config);
    const doneStatusLookup = includeDoneAt ? await loadDoneStatusLookup(savedConnection) : null;
    const normalizedRows = ["issues", "sprint_issues"].includes(config.resource)
      ? jiraRows.map((issue) => normalizeIssue(issue, fieldMappings, { includeDoneAt, doneStatusLookup }))
      : jiraRows;
    const transformedRows = transformRows(normalizedRows, config);
    const dataToCache = {
      dataRequest,
      responseData: {
        data: transformedRows,
      },
      connection_id: savedConnection.id,
    };

    await drCacheController.create(dataRequest.id, dataToCache);
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "jira",
      resource: config.resource,
      recordsProcessed: jiraRows.length,
      ...serializeResponsePreview(dataToCache.responseData),
    });

    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, "connection", {
      cacheHit: false,
      connectionType: "jira",
      resource: config.resource,
    });
    throw error;
  }
}

const actions = {
  listProjects({ connection }) {
    return jiraConnection.listProjects(connection);
  },
  listIssueTypes({ connection }) {
    return jiraConnection.listIssueTypes(connection);
  },
  listStatuses({ connection }) {
    return jiraConnection.listStatuses(connection);
  },
  listUsers({ connection, params }) {
    return jiraConnection.listUsers(connection, params);
  },
  listBoards({ connection, params }) {
    return jiraConnection.listBoards(connection, params);
  },
  listSprints({ connection, params }) {
    return jiraConnection.listSprints(connection, params);
  },
  listVersions({ connection, params }) {
    return jiraConnection.listVersions(connection, params);
  },
  listFields({ connection }) {
    return jiraConnection.listFields(connection);
  },
  validateJql({ connection, params }) {
    return jiraConnection.validateJql(connection, params);
  },
  previewJql({ connection, params }) {
    return jiraConnection.previewJql(connection, params);
  },
  detectFieldMappings({ connection }) {
    return jiraConnection.detectFieldMappings(connection);
  },
};

module.exports = {
  actions,
  applyVariables,
  assertValidConfiguration,
  fetchJiraRows,
  getBuilderMetadata,
  getDefaultDataRequest,
  getSchema,
  normalizeIssue,
  prepareConnectionData,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
  transformRows,
  validateConfiguration,
};
