const { createHash } = require("../updateAudit");
const {
  inferChartValueFormat,
  normalizeValueFormat,
  toLegacyUnit,
} = require("./valueFormat");
const { normalizeDesiredDirection } = require("./metricDirection");

const SCALAR_MARKS = new Set(["avg", "gauge", "kpi"]);
const TIMESERIES_MARKS = new Set(["bar", "line"]);

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
        id: layer.id,
        kind: eligible.kind,
        name: layer.name || layer.encoding?.value?.title || null,
        valueFormat: inferChartValueFormat(layer.encoding?.value?.formula),
      }];
    } catch (error) {
      return [];
    }
  });
}

function buildMonitorDefinition({
  chart, desiredDirection, layerId, unit, valueFormat,
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
    layerId: `${eligible.layer.id}`,
    metricField: eligible.layer.encoding.value.field,
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
  const baselinePolicy = eligible.kind === "timeseries"
    ? { type: "previous_period" }
    : { type: "rolling_median" };
  const definitionFingerprint = createHash({
    baselinePolicy,
    chartId: chart.id,
    metricSpec: {
      aggregate: metricSpec.aggregate,
      formula: metricSpec.formula,
      layerId: metricSpec.layerId,
      metricField: metricSpec.metricField,
      timeField: metricSpec.timeField,
      timeUnit: metricSpec.timeUnit,
    },
    visualizationVersion: chart.visualization?.version || null,
  });

  return {
    baselinePolicy,
    bindingKey: `${eligible.layer.id}:default`,
    definitionFingerprint,
    kind: eligible.kind,
    metricSpec,
    name: metricSpec.metricTitle,
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
  buildMonitorDefinition,
  getEligibleLayer,
  getEligibleLayers,
  getMinimumSamples,
};
