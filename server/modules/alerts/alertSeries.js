const { projectPreparedSeries } = require("../../visualization/seriesProjection");

function getChartValue(chart, key) {
  if (typeof chart?.getDataValue === "function") return chart.getDataValue(key);
  return chart?.[key];
}

function parseVisualization(visualization) {
  if (!visualization) return null;
  if (typeof visualization === "object") return visualization;

  try {
    return JSON.parse(visualization);
  } catch (error) {
    return null;
  }
}

function getAlertSeries(preparedData, visualizationValue, bindingId, options = {}) {
  const visualization = parseVisualization(visualizationValue);
  if (!preparedData || !visualization) return [];
  const projection = projectPreparedSeries({
    chart: options.chart || {},
    preparedData,
    runtimeContext: options.runtimeContext,
    timezone: options.timezone || preparedData.timezone,
    visualization,
  });
  const bindingLayers = (visualization?.layers || []).filter((layer) => {
    return `${layer.bindingId}` === `${bindingId}`;
  });
  const layersById = new Map(bindingLayers.map((layer) => [`${layer.id}`, layer]));
  return projection.series.filter((series) => {
    return `${series.bindingId}` === `${bindingId}` && layersById.has(`${series.layerId}`);
  }).map((series, seriesIndex) => {
    const layer = layersById.get(`${series.layerId}`);
    const seriesLabel = series.label || `Series ${seriesIndex + 1}`;
    const layerLabel = series.layerName || layer?.name;
    const displayLabel = bindingLayers.length > 1 && layerLabel && layerLabel !== seriesLabel
      ? `${layerLabel} — ${seriesLabel}`
      : seriesLabel;

    return {
      dateFormat: projection.dateFormat,
      layerId: series.layerId,
      points: projection.labels.map((label, index) => ({
        label,
        value: series.values[index] ?? null,
      })),
      seriesId: series.id,
      seriesLabel: displayLabel,
    };
  });
}

function isNumericAlertValue(value) {
  return value !== null
    && value !== undefined
    && value !== ""
    && Number.isFinite(Number(value));
}

function matchesAlertRule(type, rules, itemValue) {
  if (!isNumericAlertValue(itemValue)) return false;

  const numericValue = Number(itemValue);
  const value = Number(rules.value);
  const lower = Number(rules.lower);
  const upper = Number(rules.upper);

  if (type === "milestone") return numericValue >= value;
  if (type === "threshold_above") return numericValue > value;
  if (type === "threshold_below") return numericValue < value;
  if (type === "threshold_between") return numericValue > lower && numericValue < upper;
  if (type === "threshold_outside") return numericValue < lower || numericValue > upper;
  return false;
}

function makeAlertItem(series, label, value) {
  return {
    label,
    layerId: series.layerId,
    seriesId: series.seriesId,
    seriesLabel: series.seriesLabel,
    value,
  };
}

function findThresholdMatches(chart, alert, series) {
  const onlyLatestPoint = Boolean(getChartValue(chart, "isTimeseries"));

  return series.flatMap((item) => {
    const points = Array.isArray(item.points) ? item.points : [];
    const indexes = onlyLatestPoint && points.length > 0
      ? [points.length - 1]
      : points.map((value, index) => index);

    return indexes.flatMap((index) => {
      const point = points[index];
      const value = point?.value;
      if (!matchesAlertRule(alert.type, alert.rules, value)) return [];
      return [makeAlertItem(item, point?.label ?? `Point ${index + 1}`, value)];
    });
  });
}

function getAlertItemIdentity(item) {
  if (item?.seriesId) return `${item.seriesId}:${item.label}`;
  return `${item?.label}`;
}

function removePreviouslyTriggeredItems(chart, alert, alertsFound) {
  if (!getChartValue(chart, "isTimeseries") || !alert.events?.length) return alertsFound;

  const previousItems = Array.isArray(alert.events[0]?.trigger) ? alert.events[0].trigger : [];
  const previousIdentities = new Set(previousItems.map(getAlertItemIdentity));
  const previousLegacyLabels = new Set(previousItems
    .filter((item) => !item?.seriesId)
    .map((item) => `${item?.label}`));

  return alertsFound.filter((item) => {
    return !previousIdentities.has(getAlertItemIdentity(item))
      && !previousLegacyLabels.has(`${item.label}`);
  });
}

module.exports = {
  findThresholdMatches,
  getAlertItemIdentity,
  getAlertSeries,
  getChartValue,
  isNumericAlertValue,
  makeAlertItem,
  matchesAlertRule,
  removePreviouslyTriggeredItems,
};
