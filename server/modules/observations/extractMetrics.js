function addPeriod(date, granularity) {
  const value = new Date(date);
  const fieldByGranularity = {
    second: "Seconds",
    minute: "Minutes",
    hour: "Hours",
    day: "Date",
    week: "Date",
    month: "Month",
    year: "FullYear",
  };
  const field = fieldByGranularity[granularity] || "Date";
  const increment = granularity === "week" ? 7 : 1;
  const utcMethod = `setUTC${field}`;
  const getUtcMethod = `getUTC${field}`;
  value[utcMethod](value[getUtcMethod]() + increment);
  return value;
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
  const completeness = (layer.warnings || []).length === 0 ? 1 : 0;
  return {
    reason: rows.length < 2 ? "needs_more_history" : null,
    snapshots: rows.map((row, index) => ({
      completeness,
      granularity,
      periodEnd: rows[index + 1]
        ? new Date(rows[index + 1].time)
        : addPeriod(new Date(row.time), granularity),
      periodStart: new Date(row.time),
      sampleCount: 1,
      value: row.value,
    })),
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
      granularity: "refresh",
      periodEnd: new Date(periodStart.getTime() + 1),
      periodStart,
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
