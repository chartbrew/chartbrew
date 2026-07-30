const { createHash } = require("../updateAudit");

const SCALAR_MARKS = new Set(["avg", "gauge", "kpi"]);
const TIMESERIES_MARKS = new Set(["bar", "line"]);
const ALLOWED_UNITS = new Set([
  "currency_eur",
  "currency_gbp",
  "currency_usd",
  "number",
  "percent",
  "percentage_point",
]);

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
      }];
    } catch (error) {
      return [];
    }
  });
}

function buildMonitorDefinition({ chart, layerId, unit = "number" }) {
  const eligible = getEligibleLayer(chart.visualization, layerId);
  if (!ALLOWED_UNITS.has(unit)) {
    throw new Error("Choose a supported metric format");
  }

  const metricSpec = {
    aggregate: eligible.layer.encoding.value.aggregate || "none",
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
    unit,
  };
  const baselinePolicy = eligible.kind === "timeseries"
    ? { type: "previous_period" }
    : { type: "rolling_median" };
  const definitionFingerprint = createHash({
    baselinePolicy,
    chartId: chart.id,
    metricSpec,
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

module.exports = {
  ALLOWED_UNITS,
  SCALAR_MARKS,
  TIMESERIES_MARKS,
  buildMonitorDefinition,
  getEligibleLayer,
  getEligibleLayers,
};
