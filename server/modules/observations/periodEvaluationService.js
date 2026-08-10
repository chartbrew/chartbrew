const { Op } = require("sequelize");

const db = require("../../models/models");
const { evaluateCompletedPeriod } = require("./evaluatePeriod");
const { getMonitorPeriodContract } = require("./periodContract");
const { getPeriodEvaluationSchedule } = require("./periodWindows");

const MAXIMUM_REVISIONS = 3;

function getEvaluationSchedule(contract, asOf) {
  const policy = contract.baselinePolicy;
  return getPeriodEvaluationSchedule({
    asOf,
    comparison: policy.comparison,
    comparisonPeriod: policy.comparisonPeriod,
    periodMode: policy.periodMode,
    settlingDelayMinutes: policy.settlingDelayMinutes,
    timezone: policy.calendarTimezone,
    weekStartsOn: policy.weekStartsOn,
  });
}

function getEvaluationValues(monitor, contract, result, now) {
  return {
    absolute_delta: result.absoluteDelta,
    baseline_value: result.baselineValue,
    calendar_timezone: contract.baselinePolicy.calendarTimezone,
    comparison_period: contract.baselinePolicy.comparisonPeriod,
    comparison_period_end: result.windows.comparison.end,
    comparison_period_start: result.windows.comparison.start,
    comparison_rule: contract.baselinePolicy.comparison,
    completeness: result.completeness,
    current_period_end: result.windows.current.end,
    current_period_start: result.windows.current.start,
    current_value: result.currentValue,
    definition_fingerprint: monitor.definition_fingerprint,
    evaluated_at: now,
    evaluation_key: result.evaluationKey,
    evidence: {
      ...result.evidence,
      passesThreshold: result.passesThreshold,
    },
    finality: result.finality,
    finalized_at: result.finalizedAt,
    metric_behavior: contract.metricBehavior,
    monitor_id: monitor.id,
    passes_threshold: result.passesThreshold,
    period_mode: contract.baselinePolicy.periodMode,
    policy_version: contract.baselinePolicy.policyVersion,
    publication_threshold_type: contract.publicationPolicy.thresholdType,
    publication_threshold_value: contract.publicationPolicy.thresholdValue,
    readiness: result.readiness,
    relative_delta: result.relativeDelta,
    source_bucket_count: result.sourceBucketCount,
    source_checkpoint_count: result.sourceCheckpointCount,
    team_id: monitor.team_id,
    week_starts_on: contract.baselinePolicy.weekStartsOn,
  };
}

function hasEvaluationChanged(evaluation, values) {
  return evaluation.evidence?.inputFingerprint !== values.evidence.inputFingerprint
    || Number(evaluation.current_value) !== Number(values.current_value)
    || Number(evaluation.baseline_value) !== Number(values.baseline_value)
    || Number(evaluation.completeness) !== Number(values.completeness);
}

async function persistEvaluation(monitor, contract, result, now) {
  const values = getEvaluationValues(monitor, contract, result, now);
  let latest = await db.MetricEvaluation.findOne({
    order: [["revision", "DESC"]],
    where: {
      evaluation_key: result.evaluationKey,
      monitor_id: monitor.id,
    },
  });

  if (!latest) {
    const [evaluation, created] = await db.MetricEvaluation.findOrCreate({
      defaults: { ...values, revision: 1 },
      where: {
        evaluation_key: result.evaluationKey,
        monitor_id: monitor.id,
        revision: 1,
      },
    });
    if (created) return evaluation;
    latest = evaluation;
  }

  const changed = hasEvaluationChanged(latest, values);
  if (!changed) {
    if (latest.finality === "settling" && result.finality === "final") {
      return latest.update(values);
    }
    await latest.update({ evaluated_at: now });
    return latest;
  }

  if (latest.finality === "settling") {
    return latest.update(values);
  }

  const revision = Math.min(Number(latest.revision) + 1, MAXIMUM_REVISIONS);
  const correctedValues = {
    ...values,
    corrected_at: now,
    finality: result.finality === "final" ? "revised" : result.finality,
    revision,
  };
  if (revision === Number(latest.revision)) {
    return latest.update(correctedValues);
  }
  const [correction, created] = await db.MetricEvaluation.findOrCreate({
    defaults: correctedValues,
    where: {
      evaluation_key: result.evaluationKey,
      monitor_id: monitor.id,
      revision,
    },
  });
  if (created || !hasEvaluationChanged(correction, correctedValues)) return correction;
  return correction.update(correctedValues);
}

async function updateWaitingMonitor(monitor, result, schedule) {
  const status = result.readiness === "waiting" ? "collecting" : "waiting_for_data";
  await monitor.update({
    next_evaluation_at: schedule.nextDueAt,
    status,
    status_reason: result.reason,
  });
  return { result, status: result.reason };
}

async function evaluateMonitorPeriod(monitor, options = {}) {
  const asOf = new Date(options.asOf || Date.now());
  let contract;
  try {
    contract = getMonitorPeriodContract(monitor);
  } catch (error) {
    await monitor.update({
      next_evaluation_at: null,
      status: "review_required",
      status_reason: error.code || "comparison_required",
    });
    return { error, status: "review_required" };
  }

  const schedule = getEvaluationSchedule(contract, asOf);
  const toleranceMs = contract.baselinePolicy.checkpointToleranceMinutes * 60 * 1000;
  const snapshots = await db.MetricSnapshot.findAll({
    order: [["period_start", "ASC"]],
    where: {
      definition_fingerprint: monitor.definition_fingerprint,
      monitor_id: monitor.id,
      period_end: { [Op.gte]: new Date(schedule.windows.comparison.start.getTime() - toleranceMs) },
      period_start: { [Op.lte]: new Date(schedule.windows.current.end.getTime() + toleranceMs) },
    },
  });
  const result = evaluateCompletedPeriod({
    asOf,
    confirmedAt: options.confirmedAt,
    monitor,
    snapshots,
  });
  if (!result.eligible) return updateWaitingMonitor(monitor, result, schedule);

  const evaluation = await persistEvaluation(monitor, contract, result, asOf);
  const nextEvaluationAt = ["final", "revised"].includes(evaluation.finality)
    ? schedule.nextDueAt
    : schedule.currentDueAt;
  await monitor.update({
    last_evaluated_period_end: result.windows.current.end,
    next_evaluation_at: nextEvaluationAt,
    status: "ready",
    status_reason: evaluation.finality === "settling" ? "settling" : null,
  });
  return { evaluation, result, status: evaluation.finality };
}

module.exports = {
  MAXIMUM_REVISIONS,
  evaluateMonitorPeriod,
  getEvaluationSchedule,
  hasEvaluationChanged,
  persistEvaluation,
};
