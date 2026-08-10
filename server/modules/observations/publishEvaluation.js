const { Op } = require("sequelize");

const db = require("../../models/models");
const { createHash } = require("../updateAudit");
const { formatObservationText } = require("./formatObservation");
const { getObservationImpact, normalizeDesiredDirection } = require("./metricDirection");
const { getSeverity } = require("./scoreCandidate");

function getEvaluationDirection(evaluation) {
  const delta = Number(evaluation.absolute_delta);
  if (delta > 0) return "increase";
  if (delta < 0) return "decrease";
  return "unchanged";
}

function getEvaluationDeduplicationKey(monitor, evaluation) {
  return createHash({
    evaluationKey: evaluation.evaluation_key,
    monitorId: monitor.id,
  });
}

function getDetectedAt(evaluation) {
  return evaluation.corrected_at
    || evaluation.finalized_at
    || evaluation.evaluated_at
    || new Date();
}

function getObservationValues(monitor, evaluation, deduplicationKey) {
  const direction = getEvaluationDirection(evaluation);
  const relativeMagnitude = Math.abs(Number(evaluation.relative_delta));
  const score = Number.isFinite(relativeMagnitude) ? Math.min(relativeMagnitude, 1) : 1;
  const candidate = {
    absoluteDelta: Number(evaluation.absolute_delta),
    baselineValue: Number(evaluation.baseline_value),
    calendarTimezone: evaluation.calendar_timezone,
    comparisonPeriod: {
      end: evaluation.comparison_period_end,
      start: evaluation.comparison_period_start,
    },
    comparisonPeriodType: evaluation.comparison_period,
    currentPeriod: {
      end: evaluation.current_period_end,
      start: evaluation.current_period_start,
    },
    currentValue: Number(evaluation.current_value),
    direction,
    relativeDelta: evaluation.relative_delta === null
      ? null
      : Number(evaluation.relative_delta),
  };
  const text = formatObservationText(monitor, candidate);
  const detectedAt = getDetectedAt(evaluation);
  return {
    absolute_delta: candidate.absoluteDelta,
    baseline_value: candidate.baselineValue,
    chart_id: monitor.chart_id,
    comparison_period_end: evaluation.comparison_period_end,
    comparison_period_start: evaluation.comparison_period_start,
    confidence: "high",
    current_period_end: evaluation.current_period_end,
    current_period_start: evaluation.current_period_start,
    current_value: candidate.currentValue,
    dataset_id: monitor.dataset_id,
    deduplication_key: deduplicationKey,
    definition_fingerprint: monitor.definition_fingerprint,
    direction,
    evidence: {
      comparisonLabel: text.comparisonLabel,
      completeness: Number(evaluation.completeness),
      correction: evaluation.finality === "revised",
      evaluationRevision: Number(evaluation.revision),
      sourceBucketCount: Number(evaluation.source_bucket_count),
      sourceCheckpointCount: Number(evaluation.source_checkpoint_count),
      threshold: {
        passed: Boolean(evaluation.passes_threshold),
        type: evaluation.publication_threshold_type,
        value: Number(evaluation.publication_threshold_value),
      },
    },
    evidence_revision: Number(evaluation.revision),
    last_detected_at: detectedAt,
    metric_evaluation_id: evaluation.id,
    monitor_id: monitor.id,
    project_id: monitor.project_id,
    relative_delta: candidate.relativeDelta,
    resolved_at: null,
    score,
    score_version: evaluation.policy_version,
    severity: getSeverity(Number.isFinite(relativeMagnitude) ? relativeMagnitude : 1),
    status: "open",
    summary: text.summary,
    team_id: monitor.team_id,
    title: text.title,
    unit: monitor.metric_spec?.unit,
  };
}

async function resolveOpenObservations(monitor, detectedAt, deduplicationKey = null) {
  const where = {
    monitor_id: monitor.id,
    status: "open",
    team_id: monitor.team_id,
  };
  if (deduplicationKey) where.deduplication_key = { [Op.ne]: deduplicationKey };
  await db.Observation.update({
    resolved_at: detectedAt,
    status: "resolved",
  }, { where });
}

async function publishMetricEvaluation(monitor, evaluation) {
  if (!evaluation || !["final", "revised"].includes(evaluation.finality)) {
    return { status: "not_final" };
  }

  const deduplicationKey = getEvaluationDeduplicationKey(monitor, evaluation);
  const direction = getEvaluationDirection(evaluation);
  const desiredDirection = normalizeDesiredDirection(monitor.metric_spec?.desiredDirection);
  const impact = getObservationImpact(desiredDirection, direction);
  const detectedAt = getDetectedAt(evaluation);
  const existing = await db.Observation.findOne({
    where: {
      deduplication_key: deduplicationKey,
      team_id: monitor.team_id,
    },
  });

  if (!evaluation.passes_threshold || direction === "unchanged") {
    if (existing?.status === "open") {
      await existing.update({ resolved_at: detectedAt, status: "resolved" });
    }
    if (impact !== "negative") await resolveOpenObservations(monitor, detectedAt);
    return { observation: existing || null, status: "below_threshold" };
  }

  await resolveOpenObservations(monitor, detectedAt, deduplicationKey);
  const values = getObservationValues(monitor, evaluation, deduplicationKey);
  if (existing) {
    if (`${existing.metric_evaluation_id}` === `${evaluation.id}`
      && Number(existing.evidence_revision) === Number(evaluation.revision)
      && existing.status === "open") {
      return { observation: existing, status: "unchanged" };
    }
    const observation = await existing.update(values);
    return { observation, status: evaluation.finality === "revised" ? "corrected" : "updated" };
  }

  const observation = await db.Observation.create({
    ...values,
    first_detected_at: detectedAt,
    opened_at: detectedAt,
  });
  return { observation, status: "published" };
}

module.exports = {
  getEvaluationDeduplicationKey,
  getEvaluationDirection,
  getObservationValues,
  publishMetricEvaluation,
  resolveOpenObservations,
};
