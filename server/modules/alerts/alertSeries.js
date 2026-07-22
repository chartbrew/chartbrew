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

function getAlertSeries(chart, bindingId, legacyIndex = 0) {
  const datasets = getChartValue(chart, "chartData")?.data?.datasets || [];
  const seriesMetadata = getChartValue(chart, "chartData")?.meta?.series || [];
  const visualization = parseVisualization(getChartValue(chart, "visualization"));
  const bindingLayers = (visualization?.layers || []).filter((layer) => {
    return `${layer.bindingId}` === `${bindingId}`;
  });
  const layerIds = new Set(bindingLayers.map((layer) => `${layer.id}`));
  const layersById = new Map(bindingLayers.map((layer) => [`${layer.id}`, layer]));
  const matched = datasets.map((dataset, datasetIndex) => {
    const metadata = seriesMetadata[datasetIndex] || {};
    const layer = layersById.get(`${metadata.layerId}`);
    const seriesLabel = metadata.label || dataset.label || `Series ${datasetIndex + 1}`;
    const layerLabel = metadata.layerName || layer?.name;
    const displayLabel = bindingLayers.length > 1 && layerLabel && layerLabel !== seriesLabel
      ? `${layerLabel} — ${seriesLabel}`
      : seriesLabel;

    return {
      dataset,
      datasetIndex,
      layerId: metadata.layerId || layer?.id || null,
      seriesId: metadata.id || `binding-${bindingId}-series-${datasetIndex}`,
      seriesLabel: displayLabel,
      matchesBinding: `${metadata.bindingId}` === `${bindingId}`
        || layerIds.has(`${metadata.layerId}`),
    };
  }).filter((series) => series.matchesBinding);

  if (matched.length > 0) return matched;

  const dataset = datasets[legacyIndex];
  if (!dataset) return [];
  return [{
    dataset,
    datasetIndex: legacyIndex,
    layerId: null,
    seriesId: `binding-${bindingId}-series-${legacyIndex}`,
    seriesLabel: dataset.label || `Series ${legacyIndex + 1}`,
  }];
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
  const labels = getChartValue(chart, "chartData")?.data?.labels || [];
  const onlyLatestPoint = Boolean(getChartValue(chart, "isTimeseries"));

  return series.flatMap((item) => {
    const values = Array.isArray(item.dataset?.data) ? item.dataset.data : [];
    const indexes = onlyLatestPoint && values.length > 0
      ? [values.length - 1]
      : values.map((value, index) => index);

    return indexes.flatMap((index) => {
      const value = values[index];
      if (!matchesAlertRule(alert.type, alert.rules, value)) return [];
      return [makeAlertItem(item, labels[index] ?? `Point ${index + 1}`, value)];
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
