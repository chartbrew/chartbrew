const { legacyChartToVisualization } = require("./legacyChartToVisualization");
const { getMarkDefinition } = require("./registry");
const { assertVisualizationSpec, normalizeVisualizationSpec } = require("./spec");

const CARTESIAN_MARKS = new Set(["bar", "line"]);
const CATEGORY_MARKS = new Set(["doughnut", "pie", "polar", "radar"]);
const METRIC_MARKS = new Set(["avg", "gauge", "kpi"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isTemporalEncoding(encoding = {}) {
  return encoding.type === "temporal";
}

function canonicalizeAiEncoding(encoding = {}, mark = "line") {
  const next = clone(encoding);

  if (mark === "scatter") return next;

  if (CARTESIAN_MARKS.has(mark)) {
    if (!next.time && !next.category && next.x) {
      next[isTemporalEncoding(next.x) ? "time" : "category"] = next.x;
    }
    if (!next.value && next.y) next.value = next.y;
  } else if (CATEGORY_MARKS.has(mark)) {
    if (!next.category && next.x) next.category = next.x;
    if (!next.value && next.y) next.value = next.y;
  } else if (METRIC_MARKS.has(mark) && !next.value) {
    next.value = next.y || next.x;
  }

  delete next.x;
  delete next.y;
  return next;
}

function finalizeAiVisualization(input = {}) {
  const source = clone(input);
  source.layers = (source.layers || []).map((layer) => ({
    ...layer,
    encoding: canonicalizeAiEncoding(layer.encoding, `${layer.mark || "line"}`.toLowerCase()),
  }));

  const normalized = normalizeVisualizationSpec(source);
  normalized.layers.forEach((layer) => {
    const markDefinition = getMarkDefinition(layer.mark);
    if (!markDefinition) return;

    Object.keys(layer.encoding).forEach((role) => {
      if (!markDefinition.slots[role]) {
        throw new Error(`AI visualization encoding role "${role}" is not valid for ${layer.mark}`);
      }
    });
  });

  return assertVisualizationSpec(normalized);
}

function buildAiVisualization(options = {}) {
  const {
    bindingId = "binding-1",
    chart = {},
    cdc = {},
    encoding,
    goal,
    visualization,
  } = options;

  if (visualization?.layers) {
    const next = clone(visualization);
    next.metadata = { ...(next.metadata || {}), createdBy: "ai" };
    delete next.metadata.migratedFrom;
    next.layers = next.layers.map((layer) => ({
      ...layer,
      bindingId: layer.bindingId ?? bindingId,
    }));
    return finalizeAiVisualization(next);
  }

  if (encoding && typeof encoding === "object") {
    return finalizeAiVisualization({
      version: 2,
      metadata: { createdBy: "ai" },
      layers: [{
        bindingId,
        encoding,
        goal: goal ?? cdc.goal ?? null,
        id: "ai-value-1",
        mark: chart.type || "line",
        name: cdc.legend || chart.name || "Value",
        orientation: chart.horizontal ? "horizontal" : "vertical",
        stack: chart.stacked ? "normal" : "none",
        style: {
          color: cdc.datasetColor,
          fill: cdc.fill,
          fillColor: cdc.fillColor,
          label: cdc.legend,
          multiFill: cdc.multiFill,
          pointRadius: cdc.pointRadius,
        },
        transforms: [],
      }],
      settings: {
        includeZeros: chart.includeZeros,
        legend: { visible: chart.displayLegend !== false },
        timeInterval: chart.timeInterval,
      },
    });
  }

  const legacy = legacyChartToVisualization({
    ...chart,
    ChartDatasetConfigs: [{ ...cdc, id: bindingId }],
  }).visualization;
  return finalizeAiVisualization({
    ...legacy,
    metadata: { createdBy: "ai" },
  });
}

module.exports = {
  buildAiVisualization,
  canonicalizeAiEncoding,
  finalizeAiVisualization,
};
