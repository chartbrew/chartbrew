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
    reason: persistence.changed ? null : "no_new_data",
    status: "captured",
  };
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
    published: 0,
    results,
  };
}

function countDatasetRecords(data, depth = 0) {
  if (Array.isArray(data)) return data.length;
  if (data === null || data === undefined) return 0;
  if (typeof data === "object" && depth < 3) {
    const values = Object.values(data);
    const arrays = values.filter(Array.isArray);
    if (arrays.length === 1) return arrays[0].length;
    const nestedObjects = values.filter((value) => {
      return value && typeof value === "object" && !Array.isArray(value);
    });
    if (arrays.length === 0 && nestedObjects.length === 1) {
      return countDatasetRecords(nestedObjects[0], depth + 1);
    }
  }
  return 1;
}

async function processDatasetResult(options) {
  const policy = getObservationPolicy();
  if (!policy.enabled || !options.dataset?.id || !options.teamId) {
    return { processed: 0, published: 0 };
  }

  const monitors = await db.MetricMonitor.findAll({
    where: {
      chart_id: null,
      dataset_id: options.dataset.id,
      is_active: true,
      kind: "record_count",
      team_id: options.teamId,
    },
  });
  const recordCount = countDatasetRecords(options.data);
  const results = await Promise.all(monitors.map((monitor) => {
    return processMonitor(monitor, {
      layers: [{
        fields: { value: "recordCount" },
        id: monitor.metric_spec.layerId,
        mark: "kpi",
        rows: [{ value: recordCount }],
        warnings: [],
      }],
    }, {
      refreshedAt: options.refreshedAt || new Date(),
      updateRunId: options.updateRunId,
    }, policy);
  }));

  return {
    processed: results.length,
    published: 0,
    results,
  };
}

module.exports = {
  countDatasetRecords,
  persistSnapshots,
  processChartResult,
  processDatasetResult,
  processMonitor,
};
