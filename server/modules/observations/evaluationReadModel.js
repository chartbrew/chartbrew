const { Op } = require("sequelize");

const db = require("../../models/models");
const {
  assertCanViewProject,
  getProjectScope,
} = require("./access");
const {
  getObservationImpact,
  normalizeDesiredDirection,
} = require("./metricDirection");
const { formatComparisonLabel } = require("./periodLabels");
const { getValueFormat } = require("./valueFormat");

const DEFAULT_LIMIT = 30;
const MAXIMUM_LIMIT = 100;

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getEvaluationDirection(evaluation) {
  const delta = toNumber(evaluation.absolute_delta);
  if (delta > 0) return "increase";
  if (delta < 0) return "decrease";
  return "unchanged";
}

function getCompletenessLabel(evaluation) {
  if (evaluation.readiness && evaluation.readiness !== "eligible") {
    return "unavailable";
  }
  return toNumber(evaluation.completeness) >= 0.999 ? "complete" : "waiting";
}

function getEvaluationStatus(evaluation, impact) {
  if (!evaluation.passes_threshold) return "no_meaningful_change";
  if (impact === "negative") return "needs_attention";
  if (impact === "positive") return "improved";
  return "changed";
}

function selectLatestRevisions(evaluations) {
  const latest = new Map();
  evaluations.forEach((evaluation) => {
    const key = `${evaluation.monitor_id}:${evaluation.evaluation_key}`;
    const selected = latest.get(key);
    if (!selected || Number(evaluation.revision) > Number(selected.revision)) {
      latest.set(key, evaluation);
    }
  });
  return [...latest.values()];
}

function serializeFinalEvaluation(evaluation) {
  const monitor = evaluation.MetricMonitor;
  const direction = getEvaluationDirection(evaluation);
  const impact = getObservationImpact(
    normalizeDesiredDirection(monitor.metric_spec?.desiredDirection),
    direction
  );
  const comparisonPeriod = {
    end: evaluation.comparison_period_end,
    start: evaluation.comparison_period_start,
  };
  const currentPeriod = {
    end: evaluation.current_period_end,
    start: evaluation.current_period_start,
  };

  return {
    absoluteDelta: toNumber(evaluation.absolute_delta),
    baselineValue: toNumber(evaluation.baseline_value),
    calendarTimezone: evaluation.calendar_timezone || "UTC",
    chart: monitor.Chart ? {
      id: monitor.Chart.id,
      name: monitor.Chart.name,
    } : null,
    comparisonLabel: formatComparisonLabel({
      comparison: comparisonPeriod,
      current: currentPeriod,
      period: evaluation.comparison_period,
      timezone: evaluation.calendar_timezone,
    }),
    comparisonPeriod,
    completeness: getCompletenessLabel(evaluation),
    correctedAt: evaluation.corrected_at,
    currentPeriod,
    currentValue: toNumber(evaluation.current_value),
    direction,
    evaluatedAt: evaluation.evaluated_at,
    evaluationId: evaluation.id,
    factId: `evaluation:${evaluation.id}:revision:${evaluation.revision}`,
    finality: evaluation.finality,
    impact,
    importance: monitor.importance,
    material: Boolean(evaluation.passes_threshold),
    metricName: monitor.name,
    monitorId: monitor.id,
    observationId: evaluation.Observation?.id || null,
    project: monitor.Project ? {
      id: monitor.Project.id,
      name: monitor.Project.name,
    } : null,
    relativeDelta: toNumber(evaluation.relative_delta),
    revision: Number(evaluation.revision),
    stale: false,
    status: getEvaluationStatus(evaluation, impact),
    valueFormat: getValueFormat(monitor.metric_spec),
  };
}

function rankFinalEvaluations(left, right) {
  const periodDifference = new Date(right.currentPeriod.end) - new Date(left.currentPeriod.end);
  if (periodDifference !== 0) return periodDifference;
  const materialDifference = Number(right.material) - Number(left.material);
  if (materialDifference !== 0) return materialDifference;
  const impactRank = { negative: 3, neutral: 2, positive: 1 };
  const impactDifference = impactRank[right.impact] - impactRank[left.impact];
  if (impactDifference !== 0) return impactDifference;
  return Number(right.importance) - Number(left.importance);
}

function markStaleEvaluations(evaluations, healthItems = []) {
  const staleChartIds = new Set();
  const staleDatasetIds = new Set();
  healthItems.forEach((item) => {
    if (item.status && item.status !== "active") return;
    if (item.type === "chart" && item.entity?.id) staleChartIds.add(Number(item.entity.id));
    if (item.type === "dataset" && item.entity?.id) staleDatasetIds.add(Number(item.entity.id));
  });
  return evaluations.map((evaluation) => {
    const stale = staleChartIds.has(Number(evaluation.chart?.id))
      || staleDatasetIds.has(Number(evaluation.datasetId));
    return stale ? { ...evaluation, completeness: "stale", stale: true } : evaluation;
  });
}

async function readFinalMetricEvaluations(access, options = {}) {
  const limit = Math.min(
    Math.max(Number.parseInt(options.limit, 10) || DEFAULT_LIMIT, 1),
    MAXIMUM_LIMIT
  );
  const monitorWhere = {
    team_id: access.teamId,
    ...getProjectScope(access),
  };
  if (options.projectId) {
    assertCanViewProject(access, options.projectId);
    monitorWhere.project_id = Number(options.projectId);
  }
  const where = {
    finality: { [Op.in]: ["final", "revised"] },
    team_id: access.teamId,
  };
  if (options.from || options.to) {
    where.current_period_end = {};
    if (options.from) where.current_period_end[Op.gte] = options.from;
    if (options.to) where.current_period_end[Op.lte] = options.to;
  }
  const evaluations = await db.MetricEvaluation.findAll({
    include: [{
      model: db.MetricMonitor,
      attributes: [
        "dataset_id", "id", "importance", "metric_spec", "name", "project_id",
      ],
      include: [{
        model: db.Chart,
        attributes: ["id", "name"],
        required: false,
      }, {
        model: db.Project,
        attributes: ["id", "name"],
        required: false,
      }],
      required: true,
      where: monitorWhere,
    }, {
      model: db.Observation,
      attributes: ["id"],
      required: false,
    }],
    limit: Math.min(limit * 4, 400),
    order: [["current_period_end", "DESC"], ["revision", "DESC"]],
    where,
  });
  const items = selectLatestRevisions(evaluations)
    .map((evaluation) => ({
      ...serializeFinalEvaluation(evaluation),
      datasetId: evaluation.MetricMonitor.dataset_id || null,
    }))
    .sort(rankFinalEvaluations);

  return {
    items: items.slice(0, limit),
    truncated: items.length > limit || evaluations.length === Math.min(limit * 4, 400),
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAXIMUM_LIMIT,
  markStaleEvaluations,
  rankFinalEvaluations,
  readFinalMetricEvaluations,
  selectLatestRevisions,
  serializeFinalEvaluation,
};
