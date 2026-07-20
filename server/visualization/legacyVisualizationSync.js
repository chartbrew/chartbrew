const LEGACY_CHART_FIELDS = new Set([
  "content",
  "currentEndDate",
  "dashedLastPoint",
  "dataLabels",
  "displayLegend",
  "draft",
  "endDate",
  "fixedStartDate",
  "horizontal",
  "includeZeros",
  "isLogarithmic",
  "maxValue",
  "minValue",
  "mode",
  "stacked",
  "startDate",
  "subType",
  "timeInterval",
  "type",
  "xLabelTicks",
]);

const LEGACY_CDC_FIELDS = new Set([
  "columnsOrder",
  "configuration",
  "datasetColor",
  "excludedFields",
  "fill",
  "fillColor",
  "formula",
  "goal",
  "legend",
  "maxRecords",
  "multiFill",
  "order",
  "pointRadius",
  "sort",
  "xAxis",
  "xAxisOperation",
  "yAxis",
  "yAxisOperation",
]);

function hasAnyField(data, fields) {
  return Boolean(data) && Object.keys(data).some((field) => fields.has(field));
}

function isLegacyOwnedVisualization(visualization) {
  if (!visualization) return true;
  return visualization.metadata?.migratedFrom === "legacy";
}

function shouldSyncLegacyChart(data) {
  if (data?.visualization !== undefined) return false;
  return hasAnyField(data, LEGACY_CHART_FIELDS);
}

function shouldSyncLegacyCdc(data) {
  return hasAnyField(data, LEGACY_CDC_FIELDS);
}

module.exports = {
  LEGACY_CDC_FIELDS,
  LEGACY_CHART_FIELDS,
  isLegacyOwnedVisualization,
  shouldSyncLegacyCdc,
  shouldSyncLegacyChart,
};
