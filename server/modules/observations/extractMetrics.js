const { DateTime } = require("luxon");

function addPeriod(date, granularity, timezone = "UTC") {
  const durationByGranularity = {
    day: { days: 1 },
    hour: { hours: 1 },
    minute: { minutes: 1 },
    month: { months: 1 },
    second: { seconds: 1 },
    week: { weeks: 1 },
    year: { years: 1 },
  };
  return DateTime.fromJSDate(new Date(date), { zone: timezone })
    .plus(durationByGranularity[granularity] || { days: 1 })
    .toJSDate();
}

function getLayer(frame, layerId) {
  return frame?.layers?.find((layer) => `${layer.id}` === `${layerId}`) || null;
}

function normalizeValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function extractTimeseries(monitor, layer, options) {
  if (!layer.fields?.time || layer.fields?.breakdown) {
    return { reason: "unsupported_metric", snapshots: [], status: "ineligible" };
  }

  const rows = (layer.rows || [])
    .map((row) => ({
      time: Number(row.time),
      value: normalizeValue(row.value),
    }))
    .filter((row) => Number.isFinite(row.time) && row.value !== null)
    .sort((left, right) => left.time - right.time)
    .slice(-options.maximumSnapshotsPerRefresh);

  if (rows.length === 0) {
    return { reason: "no_data", snapshots: [], status: "waiting_for_data" };
  }

  const granularity = monitor.metric_spec.timeUnit || "day";
  const refreshedAt = new Date(options.refreshedAt || Date.now());
  const hasCompleteResult = (layer.warnings || []).length === 0;
  const timezone = monitor.baseline_policy?.calendarTimezone || "UTC";
  return {
    reason: rows.length < 2 ? "needs_more_history" : null,
    snapshots: rows.map((row, index) => {
      const periodEnd = rows[index + 1]
        ? new Date(rows[index + 1].time)
        : addPeriod(new Date(row.time), granularity, timezone);
      const coverage = hasCompleteResult && periodEnd <= refreshedAt ? "complete" : "partial";
      return {
        completeness: coverage === "complete" ? 1 : 0,
        coverage,
        granularity,
        periodEnd,
        periodStart: new Date(row.time),
        resultAsOf: refreshedAt,
        sampleCount: 1,
        value: row.value,
      };
    }),
    status: rows.length < 2 ? "collecting" : "ready",
  };
}

function extractScalar(monitor, layer, refreshedAt) {
  if (!["avg", "gauge", "kpi"].includes(layer.mark) || layer.fields?.time || layer.fields?.breakdown) {
    return { reason: "unsupported_metric", snapshots: [], status: "ineligible" };
  }

  const values = (layer.rows || [])
    .map((row) => normalizeValue(row.value))
    .filter((value) => value !== null);
  if (values.length !== 1) {
    return {
      reason: values.length === 0 ? "no_data" : "ambiguous_metric",
      snapshots: [],
      status: values.length === 0 ? "waiting_for_data" : "ineligible",
    };
  }

  const periodStart = new Date(refreshedAt);
  return {
    reason: "needs_more_history",
    snapshots: [{
      completeness: (layer.warnings || []).length === 0 ? 1 : 0,
      coverage: (layer.warnings || []).length === 0 ? "complete" : "partial",
      granularity: "refresh",
      periodEnd: new Date(periodStart.getTime() + 1),
      periodStart,
      resultAsOf: periodStart,
      sampleCount: 1,
      value: values[0],
    }],
    status: "collecting",
  };
}

function extractMonitorSnapshots(monitor, frame, options = {}) {
  const layer = getLayer(frame, monitor.metric_spec?.layerId);
  if (!layer) {
    return { reason: "metric_not_found", snapshots: [], status: "ineligible" };
  }

  const extractionOptions = {
    maximumSnapshotsPerRefresh: options.maximumSnapshotsPerRefresh || 400,
    refreshedAt: options.refreshedAt || new Date(),
  };
  if (monitor.kind === "timeseries") {
    return extractTimeseries(monitor, layer, extractionOptions);
  }
  if (monitor.kind === "scalar" || monitor.kind === "record_count") {
    return extractScalar(monitor, layer, options.refreshedAt || new Date());
  }

  return { reason: "unsupported_metric", snapshots: [], status: "ineligible" };
}

module.exports = {
  addPeriod,
  extractMonitorSnapshots,
  normalizeValue,
};
