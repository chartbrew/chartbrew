const db = require("../../models/models");
const {
  assertCanViewProject,
  createHttpError,
} = require("../observations/access");
const { formatComparisonLabel } = require("../observations/periodLabels");

const MAX_CONTEXT_ITEMS = 10;

function normalizeContext(context) {
  if (!Array.isArray(context)) return [];
  return context.slice(0, MAX_CONTEXT_ITEMS).map((item) => ({
    entityId: item?.entity_id ?? item?.entityId ?? item?.id,
    entityType: `${item?.entity_type ?? item?.entityType ?? ""}`.toLowerCase(),
  })).filter((item) => item.entityId && item.entityType);
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
    projectId: project.id,
  };
}

async function validateChart(access, chartId) {
  const chart = await db.Chart.findOne({
    attributes: ["id", "name", "project_id"],
    include: [{
      model: db.Project,
      attributes: ["id", "team_id"],
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
    projectId: chart.project_id,
  };
}

async function validateDataset(access, datasetId) {
  const dataset = await db.Dataset.findOne({
    attributes: ["id", "legend", "name", "project_ids"],
    where: { id: datasetId, team_id: access.teamId },
  });
  if (!dataset) throw createHttpError("Context is not available", 404);
  const accessibleProjectIds = (Array.isArray(dataset.project_ids) ? dataset.project_ids : [])
    .map(Number)
    .filter((projectId) => access.allProjects || access.projectIds.includes(projectId));
  if (!access.allProjects && accessibleProjectIds.length === 0) {
    throw createHttpError("Access denied", 403);
  }
  return {
    entityId: `${dataset.id}`,
    entityType: "dataset",
    label: `Dataset: ${dataset.name || dataset.legend || dataset.id}`,
    projectId: accessibleProjectIds[0] || null,
  };
}

async function validateConnection(access, connectionId) {
  if (!access.canConfigureTeam) throw createHttpError("Access denied", 403);
  const connection = await db.Connection.findOne({
    attributes: ["id", "name"],
    where: { id: connectionId, team_id: access.teamId },
  });
  if (!connection) throw createHttpError("Context is not available", 404);
  return {
    entityId: `${connection.id}`,
    entityType: "connection",
    label: `Connection: ${connection.name}`,
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
    projectId: observation.project_id,
  };
}

async function validateAiContext(access, context) {
  const items = normalizeContext(context);
  return Promise.all(items.map((item) => {
    if (item.entityType === "project") return validateProject(access, item.entityId);
    if (item.entityType === "chart") return validateChart(access, item.entityId);
    if (item.entityType === "dataset") return validateDataset(access, item.entityId);
    if (item.entityType === "connection") return validateConnection(access, item.entityId);
    if (item.entityType === "observation") return validateObservation(access, item.entityId);
    throw createHttpError("This context type is not supported", 400);
  }));
}

module.exports = {
  normalizeContext,
  validateAiContext,
};
