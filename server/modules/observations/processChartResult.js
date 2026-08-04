const { v4: uuid } = require("uuid");
const { Op } = require("sequelize");

const db = require("../../models/models");
const { createHash } = require("../updateAudit");
const { calculateBaseline } = require("./baseline");
const { extractMonitorSnapshots } = require("./extractMetrics");
const { formatObservationText } = require("./formatObservation");
const { getObservationPolicy } = require("./policy");
const { scoreCandidate } = require("./scoreCandidate");
const { queueObservationAudit } = require("./auditQueue");

async function persistSnapshots(monitor, snapshots, updateRunId) {
  let changed = false;
  let createdCount = 0;
  await snapshots.reduce(async (promise, snapshot) => {
    await promise;
    const where = {
      definition_fingerprint: monitor.definition_fingerprint,
      granularity: snapshot.granularity,
      monitor_id: monitor.id,
      period_end: snapshot.periodEnd,
      period_start: snapshot.periodStart,
      rollup: "raw",
    };
    const [record, created] = await db.MetricSnapshot.findOrCreate({
      where,
      defaults: {
        ...where,
        completeness: snapshot.completeness,
        id: uuid(),
        sample_count: snapshot.sampleCount,
        team_id: monitor.team_id,
        update_run_id: updateRunId || null,
        value: snapshot.value,
      },
    });
    const valuesChanged = created
      || Number(record.value) !== Number(snapshot.value)
      || Number(record.completeness) !== Number(snapshot.completeness)
      || Number(record.sample_count) !== Number(snapshot.sampleCount);
    if (valuesChanged) changed = true;
    if (created) createdCount += 1;
    if (!created) {
      await record.update({
        completeness: snapshot.completeness,
        sample_count: snapshot.sampleCount,
        update_run_id: updateRunId || record.update_run_id,
        value: snapshot.value,
      });
    }
  }, Promise.resolve());
  return { changed, createdCount };
}

async function getBaselineSnapshots(monitor, extractedSnapshots) {
  if (monitor.kind === "timeseries") return extractedSnapshots;
  return db.MetricSnapshot.findAll({
    where: {
      definition_fingerprint: monitor.definition_fingerprint,
      monitor_id: monitor.id,
    },
    order: [["period_start", "DESC"]],
    limit: Math.max(Number(monitor.minimum_samples) || 7, 30),
  });
}

async function resolveRecoveredObservation(monitor, candidate) {
  if (!["below_absolute_threshold", "below_threshold"].includes(candidate.reason)) return;
  await db.Observation.update({
    resolved_at: new Date(),
    status: "resolved",
  }, {
    where: {
      monitor_id: monitor.id,
      status: "open",
    },
  });
}

async function publishObservation(monitor, baseline, candidate, policy = getObservationPolicy()) {
  const now = new Date();
  const incidentCutoff = new Date(
    now.getTime() - (policy.deduplicationCooldownDays * 24 * 60 * 60 * 1000),
  );
  await db.Observation.update({
    resolved_at: now,
    status: "resolved",
  }, {
    where: {
      direction: { [Op.ne]: candidate.direction },
      monitor_id: monitor.id,
      status: "open",
      team_id: monitor.team_id,
    },
  });
  let existing = await db.Observation.findOne({
    order: [["last_detected_at", "DESC"]],
    where: {
      definition_fingerprint: monitor.definition_fingerprint,
      direction: candidate.direction,
      last_detected_at: { [Op.gte]: incidentCutoff },
      monitor_id: monitor.id,
      status: "open",
      team_id: monitor.team_id,
    },
  });
  if (!existing) {
    await db.Observation.update({
      resolved_at: now,
      status: "resolved",
    }, {
      where: {
        direction: candidate.direction,
        last_detected_at: { [Op.lt]: incidentCutoff },
        monitor_id: monitor.id,
        status: "open",
        team_id: monitor.team_id,
      },
    });
  }
  const candidateDeduplicationKey = createHash({
    baselinePolicy: monitor.baseline_policy.type,
    definitionFingerprint: monitor.definition_fingerprint,
    direction: candidate.direction,
    monitorId: monitor.id,
    windowStart: baseline.current.periodStart,
  });
  if (!existing) {
    existing = await db.Observation.findOne({
      where: {
        deduplication_key: candidateDeduplicationKey,
        team_id: monitor.team_id,
      },
    });
  }
  const deduplicationKey = existing?.deduplication_key || candidateDeduplicationKey;
  const text = formatObservationText(monitor, candidate);
  const evidence = {
    baselinePolicy: monitor.baseline_policy.type,
    baselineValue: candidate.baselineValue,
    comparisonPeriod: {
      end: baseline.comparison.periodEnd,
      start: baseline.comparison.periodStart,
    },
    completeness: candidate.features.completeness,
    currentPeriod: {
      end: baseline.current.periodEnd,
      start: baseline.current.periodStart,
    },
    currentValue: candidate.currentValue,
    featureValues: candidate.features,
    sampleCount: baseline.sampleCount,
  };
  const values = {
    absolute_delta: candidate.absoluteDelta,
    baseline_value: candidate.baselineValue,
    chart_id: monitor.chart_id,
    comparison_period_end: baseline.comparison.periodEnd,
    comparison_period_start: baseline.comparison.periodStart,
    confidence: candidate.confidence,
    current_period_end: baseline.current.periodEnd,
    current_period_start: baseline.current.periodStart,
    current_value: candidate.currentValue,
    dataset_id: monitor.dataset_id,
    definition_fingerprint: monitor.definition_fingerprint,
    direction: candidate.direction,
    evidence,
    last_detected_at: now,
    monitor_id: monitor.id,
    project_id: monitor.project_id,
    relative_delta: candidate.relativeDelta,
    score: candidate.score,
    score_version: candidate.scoreVersion,
    severity: candidate.severity,
    status: "open",
    summary: text.summary,
    team_id: monitor.team_id,
    title: text.title,
    unit: monitor.metric_spec.unit,
  };

  if (existing) {
    return existing.update({
      ...values,
      evidence_revision: existing.evidence_revision + 1,
      resolved_at: null,
    });
  }

  return db.Observation.create({
    ...values,
    deduplication_key: deduplicationKey,
    first_detected_at: now,
    opened_at: now,
  });
}

async function processMonitor(monitor, frame, options, policy) {
  const extraction = extractMonitorSnapshots(monitor, frame, {
    maximumSnapshotsPerRefresh: policy.maximumSnapshotsPerRefresh,
    refreshedAt: options.refreshedAt,
  });
  if (extraction.snapshots.length === 0) {
    await monitor.update({
      status: extraction.status,
      status_reason: extraction.reason,
    });
    return { monitorId: monitor.id, status: extraction.status };
  }

  const persistence = await persistSnapshots(monitor, extraction.snapshots, options.updateRunId);
  if (monitor.kind === "timeseries" && !persistence.changed) {
    await monitor.update({
      last_sampled_at: options.refreshedAt,
      status: "ready",
      status_reason: "no_new_data",
    });
    return { monitorId: monitor.id, reason: "no_new_data", status: "ready" };
  }
  const history = await getBaselineSnapshots(monitor, extraction.snapshots);
  const baseline = calculateBaseline(history, monitor);
  if (!baseline.eligible) {
    await monitor.update({
      last_sampled_at: options.refreshedAt,
      status: "collecting",
      status_reason: baseline.reason,
    });
    return {
      monitorId: monitor.id,
      sampleCount: baseline.sampleCount,
      status: "collecting",
    };
  }

  const candidate = scoreCandidate(baseline, monitor, policy);
  if (candidate.reason === "incomplete_data") {
    await monitor.update({
      last_sampled_at: options.refreshedAt,
      status: "waiting_for_data",
      status_reason: "incomplete_data",
    });
    return { monitorId: monitor.id, reason: candidate.reason, status: "waiting_for_data" };
  }
  await monitor.update({
    last_sampled_at: options.refreshedAt,
    status: "ready",
    status_reason: null,
  });
  if (!candidate.publish) {
    await resolveRecoveredObservation(monitor, candidate);
    queueObservationAudit({
      aggregate: monitor.metric_spec.aggregate,
      baselinePolicy: monitor.baseline_policy.type,
      candidateFingerprint: createHash({
        definitionFingerprint: monitor.definition_fingerprint,
        periodEnd: baseline.current.periodEnd,
      }),
      direction: candidate.direction,
      features: candidate.features,
      published: false,
      reason: candidate.reason,
      relativeDelta: candidate.relativeDelta,
      sampleCount: baseline.sampleCount,
      teamId: monitor.team_id,
      unit: monitor.metric_spec.unit,
    });
    return { monitorId: monitor.id, reason: candidate.reason, status: "ready" };
  }

  const observation = await publishObservation(monitor, baseline, candidate, policy);
  queueObservationAudit({
    aggregate: monitor.metric_spec.aggregate,
    baselinePolicy: monitor.baseline_policy.type,
    candidateFingerprint: observation.deduplication_key,
    direction: candidate.direction,
    features: candidate.features,
    observationId: observation.id,
    published: true,
    relativeDelta: candidate.relativeDelta,
    sampleCount: baseline.sampleCount,
    teamId: monitor.team_id,
    unit: monitor.metric_spec.unit,
  });
  return { monitorId: monitor.id, observationId: observation.id, status: "published" };
}

async function processChartResult(options) {
  const policy = getObservationPolicy();
  if (!policy.enabled || !options.frame || !options.chart?.id || !options.teamId) {
    return { processed: 0, published: 0 };
  }

  const monitors = await db.MetricMonitor.findAll({
    where: {
      chart_id: options.chart.id,
      is_active: true,
      team_id: options.teamId,
    },
  });
  const results = await Promise.all(monitors.map((monitor) => {
    return processMonitor(monitor, options.frame, {
      refreshedAt: options.refreshedAt || new Date(),
      updateRunId: options.updateRunId,
    }, policy);
  }));

  return {
    processed: results.length,
    published: results.filter((result) => result.status === "published").length,
    results,
  };
}

module.exports = {
  getBaselineSnapshots,
  persistSnapshots,
  processChartResult,
  processMonitor,
  publishObservation,
};
