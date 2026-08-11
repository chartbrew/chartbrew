const { Op } = require("sequelize");

const HomeController = require("../../controllers/HomeController");
const {
  getIncludes,
  serializeObservation,
} = require("../../controllers/ObservationController");
const db = require("../../models/models");
const {
  assertCanViewProject,
  getProjectScope,
} = require("../observations/access");
const {
  markStaleEvaluations,
  readFinalMetricEvaluations,
} = require("../observations/evaluationReadModel");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 7;
const MAXIMUM_LOOKBACK_DAYS = 180;
const DEFAULT_OBSERVATION_LIMIT = 20;
const MAXIMUM_OBSERVATION_LIMIT = 50;
const DEFAULT_EVALUATION_LIMIT = 30;
const MAXIMUM_EVALUATION_LIMIT = 100;
const DEFAULT_HEALTH_LIMIT = 10;
const MAXIMUM_HEALTH_LIMIT = 25;
const DEFAULT_ALERT_LIMIT = 10;
const MAXIMUM_ALERT_LIMIT = 25;

function clampLimit(value, fallback, maximum) {
  return Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), maximum);
}

function parseDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function getActivityRange(input = {}) {
  const now = new Date();
  const requestedTo = parseDate(input.to, now);
  let requestedFrom = parseDate(
    input.from,
    new Date(requestedTo.getTime() - (DEFAULT_LOOKBACK_DAYS * DAY_MS))
  );
  const maximumLookbackDays = Math.min(
    MAXIMUM_LOOKBACK_DAYS,
    getWorkspaceOrchestratorPolicy().maximumSummaryLookbackDays
  );
  const earliest = new Date(requestedTo.getTime() - (maximumLookbackDays * DAY_MS));
  if (requestedFrom < earliest) requestedFrom = earliest;
  if (requestedFrom >= requestedTo) {
    requestedFrom = new Date(requestedTo.getTime() - (DEFAULT_LOOKBACK_DAYS * DAY_MS));
  }
  return { from: requestedFrom, to: requestedTo };
}

function serializeActivityChange(observation) {
  return {
    absoluteDelta: observation.absoluteDelta,
    baselineValue: observation.baselineValue,
    chart: observation.chart,
    comparisonLabel: observation.comparisonLabel,
    comparisonPeriod: observation.comparisonPeriod,
    currentPeriod: observation.currentPeriod,
    currentValue: observation.currentValue,
    direction: observation.direction,
    factId: `observation:${observation.id}:revision:${observation.evaluation?.revision || 1}`,
    finality: observation.evaluation?.finality || "final",
    impact: observation.impact,
    metricName: observation.monitor?.name || observation.title,
    monitorId: observation.monitor?.id || null,
    observedAt: observation.lastDetectedAt,
    project: observation.project,
    relativeDelta: observation.relativeDelta,
    severity: observation.severity,
    summary: observation.summary,
    title: observation.title,
    unit: observation.unit,
  };
}

function isVisibleActivityItem(observation, now = new Date()) {
  if (observation.preference?.dismissedAt) return false;
  if (observation.preference?.snoozedUntil
    && new Date(observation.preference.snoozedUntil) > now) return false;
  return observation.feedback?.verdict !== "not_relevant";
}

function serializeHealthItem(item) {
  return {
    detectedAt: item.detectedAt,
    factId: item.id,
    freshnessEffect: ["chart", "dataset", "connection"].includes(item.type)
      ? "latest_metric_evidence_may_be_stale"
      : null,
    message: item.message,
    project: item.project,
    resolvedAt: item.resolvedAt,
    state: item.status,
    title: item.title,
    type: item.type,
  };
}

function serializeAlert(alert) {
  return {
    chart: alert.chart,
    factId: alert.lastTriggeredAt
      ? `alert-event:${alert.id}:${new Date(alert.lastTriggeredAt).toISOString()}`
      : `alert:${alert.id}`,
    lastTriggeredAt: alert.lastTriggeredAt,
    name: `${alert.chart.name} alert`,
    project: alert.project,
    state: alert.active ? "active" : "inactive",
  };
}

function filterProject(items, projectId) {
  if (!projectId) return items;
  return items.filter((item) => Number(item.project?.id) === Number(projectId));
}

async function readObservations(access, range, projectId, limit) {
  const where = {
    last_detected_at: { [Op.between]: [range.from, range.to] },
    team_id: access.teamId,
    ...getProjectScope(access),
  };
  if (projectId) where.project_id = Number(projectId);
  const observations = await db.Observation.findAll({
    include: getIncludes(access.userId),
    limit: Math.min(limit * 2, MAXIMUM_OBSERVATION_LIMIT),
    order: [["last_detected_at", "DESC"], ["id", "ASC"]],
    where,
  });
  const visible = observations
    .map((observation) => serializeObservation(observation))
    .filter((observation) => isVisibleActivityItem(observation))
    .slice(0, limit);
  return {
    evaluationIds: observations
      .map((observation) => observation.metric_evaluation_id)
      .filter(Boolean),
    items: visible.map(serializeActivityChange),
    truncated: observations.length >= Math.min(limit * 2, MAXIMUM_OBSERVATION_LIMIT)
      || visible.length > limit,
  };
}

function removeEvaluationDuplicates(evaluations, representedEvaluationIds = []) {
  const represented = new Set(representedEvaluationIds.map((id) => `${id}`));
  return evaluations.filter((evaluation) => !represented.has(`${evaluation.evaluationId}`));
}

async function readWorkspaceActivity(access, input = {}) {
  const range = getActivityRange(input);
  const projectId = input.projectId ? Number(input.projectId) : null;
  if (projectId) assertCanViewProject(access, projectId);
  const observationLimit = clampLimit(
    input.observationLimit,
    DEFAULT_OBSERVATION_LIMIT,
    MAXIMUM_OBSERVATION_LIMIT
  );
  const evaluationLimit = clampLimit(
    input.evaluationLimit,
    DEFAULT_EVALUATION_LIMIT,
    MAXIMUM_EVALUATION_LIMIT
  );
  const healthLimit = clampLimit(input.healthLimit, DEFAULT_HEALTH_LIMIT, MAXIMUM_HEALTH_LIMIT);
  const alertLimit = clampLimit(input.alertLimit, DEFAULT_ALERT_LIMIT, MAXIMUM_ALERT_LIMIT);
  const includeAlerts = input.includeAlerts !== false;
  const includeHealth = input.includeHealth !== false;
  const homeController = new HomeController();

  const [observations, evaluationResult, healthResult, alertResult, monitors] = await Promise.all([
    readObservations(access, range, projectId, observationLimit),
    readFinalMetricEvaluations(access, {
      from: range.from,
      limit: evaluationLimit,
      projectId,
      to: range.to,
    }),
    includeHealth
      ? homeController.getDataHealth(access, projectId)
      : { active: [], resolved: [] },
    includeAlerts ? homeController.getAlerts(access) : [],
    db.MetricMonitor.findAll({
      attributes: ["id", "project_id", "status", "status_reason"],
      where: {
        is_active: true,
        team_id: access.teamId,
        ...(projectId ? { project_id: projectId } : getProjectScope(access)),
      },
    }),
  ]);
  const healthItems = [
    ...(healthResult.active || []),
    ...(healthResult.resolved || []).filter((item) => {
      return item.resolvedAt && new Date(item.resolvedAt) >= range.from;
    }),
  ];
  const scopedHealth = filterProject(healthItems, projectId).slice(0, healthLimit);
  const alerts = filterProject(alertResult, projectId)
    .filter((alert) => alert.lastTriggeredAt
      && new Date(alert.lastTriggeredAt) >= range.from
      && new Date(alert.lastTriggeredAt) <= range.to)
    .slice(0, alertLimit);
  const markedEvaluations = markStaleEvaluations(
    evaluationResult.items,
    healthResult.active || []
  );
  const evaluations = removeEvaluationDuplicates(
    markedEvaluations,
    observations.evaluationIds
  );
  const evaluatedMonitorIds = new Set(
    markedEvaluations.map((evaluation) => `${evaluation.monitorId}`)
  );
  const waitingMetrics = monitors.filter((monitor) => {
    return !evaluatedMonitorIds.has(`${monitor.id}`)
      || ["collecting", "waiting_for_data"].includes(monitor.status)
      || Boolean(monitor.status_reason);
  });
  const unhealthyMonitorIds = new Set((healthResult.active || [])
    .filter((item) => item.type === "monitor")
    .map((item) => `${item.entity?.id}`));

  return {
    alerts: alerts.map(serializeAlert),
    changes: observations.items,
    coverage: {
      evaluatedMetricCount: evaluatedMonitorIds.size,
      limitedToAccessibleProjects: !access.allProjects,
      omittedProjectCount: 0,
      truncated: observations.truncated
        || evaluationResult.truncated
        || healthItems.length > healthLimit
        || alertResult.length > alertLimit,
      unhealthyMetricCount: unhealthyMonitorIds.size,
      waitingMetricCount: waitingMetrics.length,
      watchedMetricCount: monitors.length,
    },
    evaluations: evaluations.map((evaluation) => {
      const publicEvaluation = { ...evaluation };
      delete publicEvaluation.datasetId;
      delete publicEvaluation.evaluationId;
      return publicEvaluation;
    }),
    health: scopedHealth.map(serializeHealthItem),
    nextCursor: null,
    range: {
      from: range.from.toISOString(),
      timezone: "UTC",
      to: range.to.toISOString(),
    },
  };
}

module.exports = {
  DEFAULT_LOOKBACK_DAYS,
  MAXIMUM_LOOKBACK_DAYS,
  getActivityRange,
  isVisibleActivityItem,
  readWorkspaceActivity,
  removeEvaluationDuplicates,
  serializeActivityChange,
};
