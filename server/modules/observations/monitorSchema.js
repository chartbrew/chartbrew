const { createHash } = require("../updateAudit");
const {
  inferChartValueFormat,
  normalizeValueFormat,
  toLegacyUnit,
} = require("./valueFormat");
const { normalizeDesiredDirection } = require("./metricDirection");

const SCALAR_MARKS = new Set(["avg", "gauge", "kpi"]);
const TIMESERIES_MARKS = new Set(["bar", "line"]);

function getRecommendedMetricBehavior(kind, aggregate) {
  if (kind === "scalar" || kind === "record_count") return "state";
  if (["count", "sum"].includes(aggregate)) return "flow";
  return null;
}

function buildDefinitionFingerprint({
  baselinePolicy,
  bindingKey,
  chartId,
  datasetId,
  metricSpec,
}) {
  return createHash({
    baselinePolicy,
    bindingKey,
    chartId: chartId || null,
    datasetId: datasetId || null,
    metricSpec: {
      aggregate: metricSpec.aggregate,
      formula: metricSpec.formula,
      kind: metricSpec.kind,
      layerId: metricSpec.layerId,
      metricBehavior: metricSpec.metricBehavior || null,
      metricField: metricSpec.metricField,
      percentageScale: metricSpec.valueFormat?.display?.scale || null,
      timeField: metricSpec.timeField,
      timeUnit: metricSpec.timeUnit,
      valueMeaning: metricSpec.valueFormat?.meaning || null,
    },
  });
}

function getMinimumSamples(kind, policyMinimum = 7) {
  return kind === "timeseries" ? 2 : Math.max(Number(policyMinimum) || 7, 3);
}
function getEligibleLayer(visualization, layerId) {
  const layers = Array.isArray(visualization?.layers) ? visualization.layers : [];
  const layer = layers.find((item) => `${item.id}` === `${layerId}`);
  if (!layer) throw new Error("The selected chart metric could not be found");
  if (!layer.encoding?.value || layer.encoding.value.type !== "quantitative") {
    throw new Error("This chart does not have a supported numeric metric");
  }
  if (layer.encoding.breakdown) {
    throw new Error("Charts with breakdowns are not supported for monitoring yet");
  }

  if (TIMESERIES_MARKS.has(layer.mark) && layer.encoding.time?.type === "temporal") {
    return { kind: "timeseries", layer };
  }
  if (SCALAR_MARKS.has(layer.mark) && !layer.encoding.time && !layer.encoding.category) {
    return {
      kind: layer.encoding.value.aggregate === "count" ? "record_count" : "scalar",
      layer,
    };
  }

  throw new Error("This chart metric is not supported for monitoring yet");
}

function getEligibleLayers(visualization) {
  const layers = Array.isArray(visualization?.layers) ? visualization.layers : [];
  return layers.flatMap((layer) => {
    try {
      const eligible = getEligibleLayer(visualization, layer.id);
      return [{
        aggregate: eligible.layer.encoding.value.aggregate || "none",
        id: layer.id,
        kind: eligible.kind,
        name: layer.name || layer.encoding?.value?.title || null,
        recommendedMetricBehavior: getRecommendedMetricBehavior(
          eligible.kind,
          eligible.layer.encoding.value.aggregate || "none"
        ),
        timeUnit: eligible.layer.encoding.time?.timeUnit || null,
        valueFormat: inferChartValueFormat(layer.encoding?.value?.formula),
      }];
    } catch (error) {
      return [];
    }
  });
}

function buildMonitorDefinition({
  chart, desiredDirection, layerId, periodContract, unit, valueFormat,
}) {
  const eligible = getEligibleLayer(chart.visualization, layerId);
  const normalizedValueFormat = normalizeValueFormat(
    valueFormat,
    eligible.layer.encoding.value.formula,
    unit
  );

  const metricSpec = {
    aggregate: eligible.layer.encoding.value.aggregate || "none",
    desiredDirection: normalizeDesiredDirection(desiredDirection),
    formula: eligible.layer.encoding.value.formula || null,
    kind: eligible.kind,
    layerId: `${eligible.layer.id}`,
    metricField: eligible.layer.encoding.value.field,
    metricBehavior: periodContract?.metricBehavior || null,
    metricTitle: eligible.layer.name
      || eligible.layer.encoding.value.title
      || chart.name
      || "Metric",
    timeField: eligible.layer.encoding.time?.field || null,
    timeUnit: eligible.layer.encoding.time?.timeUnit
      || chart.timeInterval
      || "day",
    unit: toLegacyUnit(normalizedValueFormat),
    valueFormat: normalizedValueFormat,
  };
  const baselinePolicy = periodContract?.baselinePolicy || (eligible.kind === "timeseries"
    ? { type: "previous_period" }
    : { type: "rolling_median" });
  const bindingKey = `${eligible.layer.id}:default`;
  const definitionFingerprint = buildDefinitionFingerprint({
    baselinePolicy,
    bindingKey,
    chartId: chart.id,
    metricSpec,
  });

  return {
    baselinePolicy,
    bindingKey,
    definitionFingerprint,
    kind: eligible.kind,
    metricSpec,
    name: metricSpec.metricTitle,
    publicationPolicy: periodContract?.publicationPolicy || null,
  };
}

function buildDatasetRecordCountDefinition({ dataset, desiredDirection = "neutral" }) {
  const valueFormat = normalizeValueFormat({
    mode: "override",
    scale: 1,
    type: "number",
  });
  const metricSpec = {
    aggregate: "count",
    desiredDirection: normalizeDesiredDirection(desiredDirection),
    formula: null,
    layerId: "dataset-record-count",
    metricField: "recordCount",
    metricTitle: `${dataset.name} records`,
    timeField: null,
    timeUnit: "refresh",
    unit: toLegacyUnit(valueFormat),
    valueFormat,
  };
  const baselinePolicy = { type: "rolling_median" };

  return {
    baselinePolicy,
    bindingKey: "dataset-record-count",
    definitionFingerprint: createHash({
      baselinePolicy,
      datasetId: dataset.id,
      metricSpec: {
        aggregate: metricSpec.aggregate,
        layerId: metricSpec.layerId,
        metricField: metricSpec.metricField,
        timeUnit: metricSpec.timeUnit,
      },
    }),
    kind: "record_count",
    metricSpec,
    name: metricSpec.metricTitle,
  };
}

module.exports = {
  SCALAR_MARKS,
  TIMESERIES_MARKS,
  buildDatasetRecordCountDefinition,
  buildDefinitionFingerprint,
  buildMonitorDefinition,
  getEligibleLayer,
  getEligibleLayers,
  getMinimumSamples,
  getRecommendedMetricBehavior,
};
