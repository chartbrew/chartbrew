const { v4: uuid } = require("uuid");

const db = require("../../models/models");
const { extractMonitorSnapshots } = require("./extractMetrics");
const { evaluateMonitorPeriod } = require("./periodEvaluationService");
const { getObservationPolicy } = require("./policy");

async function persistSnapshots(monitor, snapshots, updateRunId, resultAsOf = null) {
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
        coverage: snapshot.coverage || "unknown",
        id: uuid(),
        result_as_of: snapshot.resultAsOf || resultAsOf,
        sample_count: snapshot.sampleCount,
        team_id: monitor.team_id,
        update_run_id: updateRunId || null,
        value: snapshot.value,
      },
    });
    const valuesChanged = created
      || Number(record.value) !== Number(snapshot.value)
      || Number(record.completeness) !== Number(snapshot.completeness)
      || record.coverage !== (snapshot.coverage || "unknown")
      || Number(record.sample_count) !== Number(snapshot.sampleCount);
    if (valuesChanged) changed = true;
    if (created) createdCount += 1;
    if (!created) {
      await record.update({
        completeness: snapshot.completeness,
        coverage: snapshot.coverage || "unknown",
        result_as_of: snapshot.resultAsOf || resultAsOf || record.result_as_of,
        sample_count: snapshot.sampleCount,
        update_run_id: updateRunId || record.update_run_id,
        value: snapshot.value,
      });
    }
  }, Promise.resolve());
  return { changed, createdCount };
}

async function processMonitor(monitor, preparedData, options, policy) {
  const extraction = extractMonitorSnapshots(monitor, preparedData, {
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

  const persistence = await persistSnapshots(
    monitor,
    extraction.snapshots,
    options.updateRunId,
    options.refreshedAt
  );
  await monitor.update({ last_sampled_at: options.refreshedAt });
  const evaluation = await evaluateMonitorPeriod(monitor, {
    asOf: options.refreshedAt,
    confirmedAt: options.refreshedAt,
  });
  return {
    evaluationStatus: evaluation.status,
    monitorId: monitor.id,
    observationId: evaluation.publication?.observation?.id || null,
    publicationStatus: evaluation.publication?.status || null,
    reason: persistence.changed ? null : "no_new_data",
    status: "captured",
  };
}

async function processChartResult(options) {
  const policy = getObservationPolicy();
  if (!policy.enabled || !options.preparedData || !options.chart?.id || !options.teamId) {
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
    return processMonitor(monitor, options.preparedData, {
      refreshedAt: options.refreshedAt || new Date(),
      updateRunId: options.updateRunId,
    }, policy);
  }));

  return {
    processed: results.length,
    published: results.filter((result) => {
      return ["corrected", "published", "updated"].includes(result.publicationStatus);
    }).length,
    results,
  };
}

module.exports = {
  persistSnapshots,
  processChartResult,
  processMonitor,
};
