const { Op } = require("sequelize");

const db = require("../../models/models");
const { getProjectScope } = require("./access");
const { getObservationImpact, normalizeDesiredDirection } = require("./metricDirection");
const { formatComparisonLabel, formatPeriodLabel } = require("./periodLabels");
const { formatMetricValue, getValueFormat } = require("./valueFormat");

function getMonitorWhere(access, digest) {
  return {
    is_active: true,
    team_id: access.teamId,
    ...getProjectScope(access),
    ...(digest.project_id ? { project_id: digest.project_id } : {}),
    ...(digest.monitor_id ? { id: digest.monitor_id } : {}),
  };
}

function getLatestRevisions(evaluations) {
  const latest = new Map();
  evaluations.forEach((evaluation) => {
    const key = `${evaluation.monitor_id}:${evaluation.evaluation_key}`;
    const current = latest.get(key);
    if (!current || Number(evaluation.revision) > Number(current.revision)) {
      latest.set(key, evaluation);
    }
  });
  return [...latest.values()];
}

function getDeliveryKey(item) {
  return `${item.evaluationId}:${item.revision}`;
}

function getEvaluationDirection(evaluation) {
  const delta = Number(evaluation.absolute_delta);
  if (delta > 0) return "increase";
  if (delta < 0) return "decrease";
  return "unchanged";
}

function getKpiStatusLabel(passesThreshold, impact) {
  if (!passesThreshold) return "No meaningful change";
  if (impact === "negative") return "Needs attention";
  if (impact === "positive") return "Improved";
  return "Changed";
}

function serializeKpiEvaluation(evaluation) {
  const monitor = evaluation.MetricMonitor;
  const valueFormat = getValueFormat(monitor.metric_spec);
  const direction = getEvaluationDirection(evaluation);
  const impact = getObservationImpact(
    normalizeDesiredDirection(monitor.metric_spec?.desiredDirection),
    direction
  );
  const comparison = {
    end: evaluation.comparison_period_end,
    start: evaluation.comparison_period_start,
  };
  const current = {
    end: evaluation.current_period_end,
    start: evaluation.current_period_start,
  };
  const comparisonLabel = formatComparisonLabel({
    comparison,
    current,
    period: evaluation.comparison_period,
    timezone: evaluation.calendar_timezone,
  });
  return {
    baselineValue: evaluation.baseline_value,
    comparisonLabel,
    comparisonPeriod: comparison,
    comparisonValueLabel: formatMetricValue(evaluation.baseline_value, valueFormat),
    corrected: evaluation.finality === "revised",
    currentPeriod: current,
    currentPeriodLabel: formatPeriodLabel(
      evaluation.comparison_period,
      current,
      evaluation.calendar_timezone
    ),
    currentValue: evaluation.current_value,
    currentValueLabel: formatMetricValue(evaluation.current_value, valueFormat),
    deltaLabel: evaluation.relative_delta === null
      ? formatMetricValue(Math.abs(Number(evaluation.absolute_delta)), valueFormat)
      : `${Math.abs(Number(evaluation.relative_delta) * 100).toFixed(1)}%`,
    direction,
    evaluationId: evaluation.id,
    impact,
    importance: monitor.importance,
    material: Boolean(evaluation.passes_threshold),
    monitorId: monitor.id,
    name: monitor.name,
    observationId: evaluation.Observation?.id || null,
    project: monitor.Project ? {
      id: monitor.Project.id,
      name: monitor.Project.name,
    } : null,
    revision: Number(evaluation.revision),
    statusLabel: getKpiStatusLabel(evaluation.passes_threshold, impact),
  };
}

function rankKpiEvaluations(left, right) {
  const impactRank = { negative: 3, neutral: 2, positive: 1 };
  const materialDifference = Number(right.material) - Number(left.material);
  if (materialDifference !== 0) return materialDifference;
  const impactDifference = impactRank[right.impact] - impactRank[left.impact];
  if (impactDifference !== 0) return impactDifference;
  const importanceDifference = Number(right.importance) - Number(left.importance);
  if (importanceDifference !== 0) return importanceDifference;
  return left.name.localeCompare(right.name);
}

function serializeWaitingMonitor(monitor) {
  const reasonCopy = {
    checkpoint_missing: "Waiting for a value near the period boundary",
    comparison_required: "Choose how this metric should be compared",
    definition_changed: "Waiting for a complete comparison with the new settings",
    incomplete_coverage: "The completed period has missing data",
    initial_evaluation_failed: "Refresh the chart to collect comparison data",
    metric_not_found: "The chart no longer contains this metric",
    missing_window: "Waiting for data from both completed periods",
    native_period_required: "Waiting for one complete value for the period",
    needs_more_history: "Waiting for two complete periods",
    no_data: "Waiting for chart data",
    settling: "The completed result is still settling",
    unsupported_metric: "This metric cannot be compared safely",
    waiting_for_fresh_data: "Waiting for fresh data after the period closed",
  };
  const nextEvaluationAt = monitor.next_evaluation_at
    ? new Date(monitor.next_evaluation_at)
    : null;
  const waitingForPeriodClose = nextEvaluationAt
    && Number.isFinite(nextEvaluationAt.getTime())
    && nextEvaluationAt > new Date();
  return {
    monitorId: monitor.id,
    name: monitor.name,
    project: monitor.Project ? {
      id: monitor.Project.id,
      name: monitor.Project.name,
    } : null,
    reason: reasonCopy[monitor.status_reason]
      || (waitingForPeriodClose
        ? "Waiting for this period to close"
        : "Chartbrew does not have a complete comparison yet"),
    settling: monitor.status_reason === "settling",
  };
}

function serializeAttentionItem(observation) {
  return {
    comparisonLabel: observation.evidence?.comparisonLabel || null,
    id: observation.id,
    project: observation.Project ? {
      id: observation.Project.id,
      name: observation.Project.name,
    } : null,
    summary: observation.summary,
    title: observation.title,
  };
}

async function buildKpiReview(access, digest) {
  const monitorWhere = getMonitorWhere(access, digest);
  const observationWhere = {
    ...getProjectScope(access),
    ...(digest.project_id ? { project_id: digest.project_id } : {}),
    monitor_id: digest.monitor_id || { [Op.ne]: null },
    status: "open",
    team_id: access.teamId,
  };
  const [evaluations, monitors, deliveredItems, openObservations] = await Promise.all([
    db.MetricEvaluation.findAll({
      include: [{
        model: db.MetricMonitor,
        required: true,
        where: monitorWhere,
        include: [{ model: db.Project, attributes: ["id", "name"], required: false }],
      }, {
        model: db.Observation,
        attributes: ["id"],
        required: false,
      }],
      limit: 400,
      order: [["current_period_end", "DESC"], ["revision", "DESC"]],
      where: {
        finality: { [Op.in]: ["final", "revised"] },
        team_id: access.teamId,
      },
    }),
    db.MetricMonitor.findAll({
      include: [{ model: db.Project, attributes: ["id", "name"], required: false }],
      where: monitorWhere,
    }),
    digest.id ? db.ObservationDigestDeliveryItem.findAll({
      attributes: ["evaluation_revision", "metric_evaluation_id", "status"],
      where: { subscription_id: digest.id },
    }) : [],
    db.Observation.findAll({
      include: [{
        model: db.MetricMonitor,
        attributes: ["metric_spec"],
        required: true,
      }, {
        model: db.Project,
        attributes: ["id", "name"],
        required: false,
      }],
      limit: 50,
      order: [["last_detected_at", "DESC"]],
      where: observationWhere,
    }),
  ]);
  const reservedKeys = new Set(deliveredItems
    .filter((item) => item.status !== "failed")
    .map((item) => `${item.metric_evaluation_id}:${item.evaluation_revision}`));
  const latestByWindow = getLatestRevisions(evaluations);
  const latestByMonitor = new Map();
  latestByWindow.forEach((evaluation) => {
    const current = latestByMonitor.get(`${evaluation.monitor_id}`);
    if (!current || new Date(evaluation.current_period_end) > new Date(current.current_period_end)) {
      latestByMonitor.set(`${evaluation.monitor_id}`, evaluation);
    }
  });
  const selectedById = new Map();
  [...latestByMonitor.values()].forEach((evaluation) => {
    if (!reservedKeys.has(`${evaluation.id}:${evaluation.revision}`)) {
      selectedById.set(`${evaluation.id}`, evaluation);
    }
  });
  latestByWindow.forEach((evaluation) => {
    if (evaluation.finality === "revised"
      && !reservedKeys.has(`${evaluation.id}:${evaluation.revision}`)) {
      selectedById.set(`${evaluation.id}`, evaluation);
    }
  });
  const selected = [...selectedById.values()];
  const kpis = selected.map(serializeKpiEvaluation).sort(rankKpiEvaluations);
  const evaluatedMonitorIds = new Set(latestByMonitor.keys());
  const waitingMetrics = monitors
    .filter((monitor) => Boolean(monitor.status_reason)
      || !evaluatedMonitorIds.has(`${monitor.id}`))
    .map(serializeWaitingMonitor);
  const selectedObservationIds = new Set(kpis.map((item) => item.observationId).filter(Boolean));
  const attentionItems = openObservations.filter((observation) => {
    if (selectedObservationIds.has(observation.id)) return false;
    const direction = observation.direction;
    const impact = getObservationImpact(
      normalizeDesiredDirection(observation.MetricMonitor?.metric_spec?.desiredDirection),
      direction
    );
    return impact === "negative";
  }).map(serializeAttentionItem);
  return {
    attentionItems,
    evaluationRecords: selected.map((evaluation) => ({
      evaluationId: evaluation.id,
      revision: Number(evaluation.revision),
    })),
    kpis,
    waitingMetrics,
  };
}

async function claimKpiReviewDelivery(subscription, evaluationRecords, now = new Date()) {
  const claimed = [];
  for (const item of evaluationRecords) {
    // oxlint-disable-next-line no-await-in-loop
    const [record, created] = await db.ObservationDigestDeliveryItem.findOrCreate({
      defaults: {
        delivery_attempted_at: now,
        status: "pending",
      },
      where: {
        evaluation_revision: item.revision,
        metric_evaluation_id: item.evaluationId,
        subscription_id: subscription.id,
      },
    });
    if (created) {
      claimed.push(item);
    } else if (record.status === "failed") {
      // oxlint-disable-next-line no-await-in-loop
      const [updated] = await db.ObservationDigestDeliveryItem.update({
        delivery_attempted_at: now,
        status: "pending",
      }, {
        where: { id: record.id, status: "failed" },
      });
      if (updated === 1) claimed.push(item);
    }
  }
  return claimed;
}

async function updateClaimedDeliveries(subscription, evaluationRecords, values) {
  for (const item of evaluationRecords) {
    // oxlint-disable-next-line no-await-in-loop
    await db.ObservationDigestDeliveryItem.update(values, {
      where: {
        evaluation_revision: item.revision,
        metric_evaluation_id: item.evaluationId,
        status: "pending",
        subscription_id: subscription.id,
      },
    });
  }
}

async function completeKpiReviewDelivery(subscription, evaluationRecords, now = new Date()) {
  return updateClaimedDeliveries(subscription, evaluationRecords, {
    delivered_at: now,
    status: "delivered",
  });
}

async function failKpiReviewDelivery(subscription, evaluationRecords) {
  return updateClaimedDeliveries(subscription, evaluationRecords, {
    status: "failed",
  });
}

module.exports = {
  buildKpiReview,
  claimKpiReviewDelivery,
  completeKpiReviewDelivery,
  failKpiReviewDelivery,
  getDeliveryKey,
  getLatestRevisions,
  getMonitorWhere,
  rankKpiEvaluations,
  serializeKpiEvaluation,
};
