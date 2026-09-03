const db = require("../../models/models");
const {
  col, fn, Op, where,
} = require("sequelize");
const {
  assertCanViewProject,
  createHttpError,
  getProjectScope,
} = require("../observations/access");
const { formatComparisonLabel } = require("../observations/periodLabels");

const MAX_CONTEXT_ITEMS = 10;
const MAX_CONTEXT_SEARCH_ITEMS = 50;
const SEARCHABLE_CONTEXT_TYPES = new Set(["project", "chart", "dataset", "connection"]);

function normalizeContext(context) {
  if (!Array.isArray(context)) return [];
  const normalized = context.map((item) => ({
    entityId: item?.entity_id ?? item?.entityId ?? item?.id,
    entityType: `${item?.entity_type ?? item?.entityType ?? ""}`.toLowerCase(),
  })).filter((item) => item.entityId && item.entityType);
  const seen = new Set();
  return normalized.filter((item) => {
    const key = `${item.entityType}:${item.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serializeContextId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : `${value}`;
}

function serializeAiContext(context = []) {
  return context.map((item) => ({
    entity_type: item.entityType,
    id: serializeContextId(item.entityId),
    label: item.label,
    metadata: item.metadata || {},
    name: item.name || item.label,
    project_id: item.projectId || null,
  }));
}

async function validateProject(access, projectId) {
  const project = await db.Project.findOne({
    attributes: ["id", "name"],
    where: {
      id: projectId,
      team_id: access.teamId,
      ghost: false,
    },
  });
  if (!project) throw createHttpError("Context is not available", 404);
  assertCanViewProject(access, project.id);
  return {
    entityId: `${project.id}`,
    entityType: "project",
    label: `Dashboard: ${project.name}`,
    metadata: {},
    name: project.name,
    projectId: project.id,
  };
}

async function validateChart(access, chartId) {
  const chart = await db.Chart.findOne({
    attributes: ["id", "name", "project_id", "type"],
    include: [{
      model: db.Project,
      attributes: ["id", "name", "team_id"],
      required: true,
    }],
    where: { id: chartId },
  });
  if (!chart || Number(chart.Project.team_id) !== access.teamId) {
    throw createHttpError("Context is not available", 404);
  }
  assertCanViewProject(access, chart.project_id);
  return {
    entityId: `${chart.id}`,
    entityType: "chart",
    label: `Chart: ${chart.name}`,
    metadata: {
      chartType: chart.type,
      dashboardName: chart.Project.name,
    },
    name: chart.name,
    projectId: chart.project_id,
  };
}

async function validateDataset(access, datasetId) {
  const dataset = await db.Dataset.findOne({
    attributes: ["id", "legend", "main_dr_id", "name", "project_ids"],
    include: [{
      model: db.DataRequest,
      attributes: ["id"],
      include: [{
        model: db.Connection,
        attributes: ["id", "name", "subType", "type"],
        required: false,
        where: { team_id: access.teamId },
      }],
      required: false,
    }],
    where: { id: datasetId, team_id: access.teamId },
  });
  if (!dataset) throw createHttpError("Context is not available", 404);
  const accessibleProjectIds = (Array.isArray(dataset.project_ids) ? dataset.project_ids : [])
    .map(Number)
    .filter((projectId) => access.allProjects || access.projectIds.includes(projectId));
  if (!access.allProjects && accessibleProjectIds.length === 0) {
    throw createHttpError("Access denied", 403);
  }
  const mainRequest = dataset.DataRequests?.find((request) => request.id === dataset.main_dr_id)
    || dataset.DataRequests?.[0];
  const connection = mainRequest?.Connection;
  const name = dataset.name || dataset.legend || `${dataset.id}`;
  return {
    entityId: `${dataset.id}`,
    entityType: "dataset",
    label: `Dataset: ${name}`,
    metadata: {
      connectionName: connection?.name || null,
      sourceType: connection?.subType || connection?.type || null,
    },
    name,
    projectId: accessibleProjectIds[0] || null,
  };
}

async function validateConnection(access, connectionId) {
  if (!access.canConfigureTeam) throw createHttpError("Access denied", 403);
  const connection = await db.Connection.findOne({
    attributes: ["active", "id", "name", "subType", "type"],
    where: { active: true, id: connectionId, team_id: access.teamId },
  });
  if (!connection) throw createHttpError("Context is not available", 404);
  return {
    entityId: `${connection.id}`,
    entityType: "connection",
    label: `Connection: ${connection.name}`,
    metadata: {
      connectionState: "Connected",
      sourceType: connection.subType || connection.type,
    },
    name: connection.name,
    projectId: null,
  };
}

async function validateObservation(access, observationId) {
  const observation = await db.Observation.findOne({
    attributes: [
      "baseline_value",
      "comparison_period_end",
      "comparison_period_start",
      "current_period_end",
      "current_period_start",
      "current_value",
      "id",
      "project_id",
      "summary",
      "title",
      "unit",
    ],
    include: [{
      model: db.Chart,
      attributes: ["id", "name"],
      required: false,
    }, {
      model: db.Dataset,
      attributes: ["id", "legend", "name"],
      required: false,
    }, {
      model: db.MetricMonitor,
      attributes: ["baseline_policy"],
      required: false,
    }],
    where: { id: observationId, team_id: access.teamId },
  });
  if (!observation) throw createHttpError("Context is not available", 404);
  assertCanViewProject(access, observation.project_id);
  const comparisonPeriod = observation.MetricMonitor?.baseline_policy?.comparisonPeriod;
  const comparisonLabel = comparisonPeriod ? formatComparisonLabel({
    comparison: {
      end: observation.comparison_period_end,
      start: observation.comparison_period_start,
    },
    current: {
      end: observation.current_period_end,
      start: observation.current_period_start,
    },
    period: comparisonPeriod,
    timezone: observation.MetricMonitor?.baseline_policy?.calendarTimezone || "UTC",
  }) : null;
  const contextLines = [
    `Detected change: ${observation.title}`,
    observation.summary,
    comparisonLabel ? `Business comparison: ${comparisonLabel}` : null,
    `Current value: ${observation.current_value} (${observation.unit || "number"})`,
    `Comparison value: ${observation.baseline_value} (${observation.unit || "number"})`,
    `Current period: ${observation.current_period_start?.toISOString() || "unavailable"} to ${observation.current_period_end?.toISOString() || "unavailable"}`,
    `Comparison period: ${observation.comparison_period_start?.toISOString() || "unavailable"} to ${observation.comparison_period_end?.toISOString() || "unavailable"}`,
  ].filter(Boolean);
  if (observation.Chart) {
    contextLines.push(`Source chart: ${observation.Chart.name} (ID ${observation.Chart.id})`);
  }
  if (observation.Dataset) {
    contextLines.push(
      `Authorized dataset: ${observation.Dataset.name || observation.Dataset.legend || "Dataset"} (ID ${observation.Dataset.id})`,
    );
  }
  return {
    entityId: `${observation.id}`,
    entityType: "observation",
    label: contextLines.join("\n"),
    metadata: {},
    name: observation.title,
    projectId: observation.project_id,
  };
}

async function validateAiContext(access, context) {
  const items = normalizeContext(context);
  if (items.length > MAX_CONTEXT_ITEMS) {
    throw createHttpError(`Select up to ${MAX_CONTEXT_ITEMS} context items`, 400);
  }
  return Promise.all(items.map((item) => {
    if (item.entityType === "project") return validateProject(access, item.entityId);
    if (item.entityType === "chart") return validateChart(access, item.entityId);
    if (item.entityType === "dataset") return validateDataset(access, item.entityId);
    if (item.entityType === "connection") return validateConnection(access, item.entityId);
    if (item.entityType === "observation") return validateObservation(access, item.entityId);
    throw createHttpError("This context type is not supported", 400);
  }));
}

function getSearchLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 20;
  return Math.min(parsed, MAX_CONTEXT_SEARCH_ITEMS);
}

function getTextSearch(modelName, fields, query) {
  if (!query) return {};
  const pattern = `%${query.toLowerCase()}%`;
  return {
    [Op.or]: fields.map((field) => where(
      fn("LOWER", col(`${modelName}.${field}`)),
      { [Op.like]: pattern },
    )),
  };
}

function getContextOption({
  entityType, id, label, metadata, name, projectId, updatedAt,
}) {
  return {
    entity_type: entityType,
    id: serializeContextId(id),
    label,
    metadata: metadata || {},
    name,
    project_id: projectId || null,
    updatedAt,
  };
}

async function searchProjects(access, query, limit) {
  const projects = await db.Project.findAll({
    attributes: ["id", "name", "updatedAt"],
    limit,
    order: [["updatedAt", "DESC"]],
    where: {
      ghost: false,
      team_id: access.teamId,
      ...getProjectScope(access, "id"),
      ...getTextSearch("Project", ["name"], query),
    },
  });
  const projectIds = projects.map((project) => project.id);
  const counts = projectIds.length > 0 ? await db.Chart.count({
    group: ["project_id"],
    where: { project_id: { [Op.in]: projectIds } },
  }) : [];
  const countByProject = new Map(counts.map((item) => [
    Number(item.project_id),
    Number(item.count),
  ]));
  return projects.map((project) => getContextOption({
    entityType: "project",
    id: project.id,
    label: `Dashboard: ${project.name}`,
    metadata: { chartCount: countByProject.get(project.id) || 0 },
    name: project.name,
    projectId: project.id,
    updatedAt: project.updatedAt,
  }));
}

async function searchCharts(access, query, limit) {
  const charts = await db.Chart.findAll({
    attributes: ["id", "name", "project_id", "type", "updatedAt"],
    include: [{
      model: db.Project,
      attributes: ["id", "name"],
      required: true,
      where: {
        ghost: false,
        team_id: access.teamId,
        ...getProjectScope(access, "id"),
      },
    }],
    limit,
    order: [["updatedAt", "DESC"]],
    where: getTextSearch("Chart", ["name", "type"], query),
  });
  return charts.map((chart) => getContextOption({
    entityType: "chart",
    id: chart.id,
    label: `Chart: ${chart.name}`,
    metadata: {
      chartType: chart.type,
      dashboardName: chart.Project.name,
    },
    name: chart.name,
    projectId: chart.project_id,
    updatedAt: chart.updatedAt,
  }));
}

async function searchDatasets(access, query, limit) {
  // ponytail: project_ids is JSON text; keep the access filter in memory until it is relational.
  const datasets = await db.Dataset.findAll({
    attributes: ["id", "legend", "main_dr_id", "name", "project_ids", "updatedAt"],
    ...(access.allProjects ? { limit } : {}),
    order: [["updatedAt", "DESC"]],
    where: {
      draft: false,
      team_id: access.teamId,
      ...getTextSearch("Dataset", ["name", "legend"], query),
    },
  });
  const visible = datasets.filter((dataset) => {
    if (access.allProjects) return true;
    const projectIds = Array.isArray(dataset.project_ids) ? dataset.project_ids.map(Number) : [];
    return projectIds.some((projectId) => access.projectIds.includes(projectId));
  }).slice(0, limit);
  const datasetIds = visible.map((dataset) => dataset.id);
  const requests = datasetIds.length > 0 ? await db.DataRequest.findAll({
    attributes: ["connection_id", "dataset_id", "id"],
    include: [{
      model: db.Connection,
      attributes: ["id", "name", "subType", "type"],
      required: false,
      where: { team_id: access.teamId },
    }],
    where: { dataset_id: { [Op.in]: datasetIds } },
  }) : [];
  const datasetById = new Map(visible.map((dataset) => [dataset.id, dataset]));
  const requestByDataset = new Map();
  requests.forEach((request) => {
    const dataset = datasetById.get(request.dataset_id);
    const current = requestByDataset.get(request.dataset_id);
    if (!current || request.id === dataset?.main_dr_id) {
      requestByDataset.set(request.dataset_id, request);
    }
  });
  return visible.map((dataset) => {
    const request = requestByDataset.get(dataset.id);
    const connection = request?.Connection;
    const projectIds = Array.isArray(dataset.project_ids) ? dataset.project_ids.map(Number) : [];
    const projectId = projectIds.find((id) => access.allProjects || access.projectIds.includes(id));
    const name = dataset.name || dataset.legend || `${dataset.id}`;
    return getContextOption({
      entityType: "dataset",
      id: dataset.id,
      label: `Dataset: ${name}`,
      metadata: {
        connectionName: connection?.name || null,
        sourceType: connection?.subType || connection?.type || null,
      },
      name,
      projectId,
      updatedAt: dataset.updatedAt,
    });
  });
}

async function searchConnections(access, query, limit) {
  if (!access.canConfigureTeam) return [];
  const connections = await db.Connection.findAll({
    attributes: ["active", "id", "name", "subType", "type", "updatedAt"],
    limit,
    order: [["updatedAt", "DESC"]],
    where: {
      active: true,
      team_id: access.teamId,
      ...getTextSearch("Connection", ["name", "subType", "type"], query),
    },
  });
  return connections.map((connection) => getContextOption({
    entityType: "connection",
    id: connection.id,
    label: `Connection: ${connection.name}`,
    metadata: {
      connectionState: "Connected",
      sourceType: connection.subType || connection.type,
    },
    name: connection.name,
    projectId: null,
    updatedAt: connection.updatedAt,
  }));
}

async function searchAiContext(access, options = {}) {
  const query = `${options.query || ""}`.trim().slice(0, 100);
  const limit = getSearchLimit(options.limit);
  const requestedType = options.type === "dashboard" ? "project" : options.type;
  if (requestedType && requestedType !== "all" && !SEARCHABLE_CONTEXT_TYPES.has(requestedType)) {
    throw createHttpError("This context type is not supported", 400);
  }
  const types = requestedType && requestedType !== "all"
    ? [requestedType]
    : [...SEARCHABLE_CONTEXT_TYPES];
  const searchByType = {
    chart: searchCharts,
    connection: searchConnections,
    dataset: searchDatasets,
    project: searchProjects,
  };
  const groups = await Promise.all(types.map((type) => searchByType[type](access, query, limit)));
  return groups.flat()
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    .slice(0, limit)
    .map((item) => ({
      entity_type: item.entity_type,
      id: item.id,
      label: item.label,
      metadata: item.metadata,
      name: item.name,
      project_id: item.project_id,
    }));
}

async function replaceAiConversationContext(conversationId, teamId, context = []) {
  const desired = new Map(context.map((item) => [
    `${item.entityType}:${item.entityId}`,
    item,
  ]));
  await db.sequelize.transaction(async (transaction) => {
    const existing = await db.AiConversationContext.findAll({
      transaction,
      where: { conversation_id: conversationId, team_id: teamId },
    });
    const staleIds = existing
      .filter((item) => !desired.has(`${item.entity_type}:${item.entity_id}`))
      .map((item) => item.id);
    if (staleIds.length > 0) {
      await db.AiConversationContext.destroy({
        transaction,
        where: { id: { [Op.in]: staleIds } },
      });
    }
    const existingKeys = new Set(existing.map((item) => `${item.entity_type}:${item.entity_id}`));
    const missing = [...desired.values()].filter((item) => (
      !existingKeys.has(`${item.entityType}:${item.entityId}`)
    ));
    if (missing.length > 0) {
      await db.AiConversationContext.bulkCreate(missing.map((item) => ({
        conversation_id: conversationId,
        entity_id: item.entityId,
        entity_type: item.entityType,
        team_id: teamId,
      })), { transaction });
    }
  });
}

async function loadAiConversationContext(access, conversationId) {
  const stored = await db.AiConversationContext.findAll({
    order: [["createdAt", "ASC"]],
    where: { conversation_id: conversationId, team_id: access.teamId },
  });
  const active = stored.slice(0, MAX_CONTEXT_ITEMS);
  const results = await Promise.allSettled(active.map((item) => validateAiContext(access, [{
    entityId: item.entity_id,
    entityType: item.entity_type,
  }])));
  const context = [];
  const invalidIds = stored.slice(MAX_CONTEXT_ITEMS).map((item) => item.id);
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      context.push(result.value[0]);
      return;
    }
    if (![400, 403, 404].includes(result.reason?.statusCode)) throw result.reason;
    invalidIds.push(active[index].id);
  });
  if (invalidIds.length > 0) {
    await db.AiConversationContext.destroy({ where: { id: { [Op.in]: invalidIds } } });
  }
  return { context, removedCount: invalidIds.length };
}

module.exports = {
  loadAiConversationContext,
  normalizeContext,
  replaceAiConversationContext,
  searchAiContext,
  serializeAiContext,
  validateAiContext,
};
