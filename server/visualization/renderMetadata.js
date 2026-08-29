const { createSeriesId, getSeriesLabel, serializeTypedValue } = require("./seriesIdentity");
const { buildMetricItems } = require("./metricProjection");
const { getDomain, hasField, projectPreparedSeries } = require("./seriesProjection");
const {
  buildSeriesMetadata,
  getStableColor,
} = require("./seriesStyles");

const SLICE_COLOR_MARKS = new Set(["pie", "doughnut", "polar"]);

function buildCategoryMetadata(preparedData, visualization) {
  const domain = getDomain(preparedData);
  const usedColors = new Set();

  return preparedData.results.flatMap((result) => {
    if (!SLICE_COLOR_MARKS.has(result.mark)) return [];
    const layer = visualization.layers.find((item) => item.id === result.id);
    const presentKeys = new Set(result.rows.map((row) => serializeTypedValue(row.category)));

    return [...domain.entries()].filter(([key]) => presentKeys.has(key)).map(([key, value]) => {
      const id = createSeriesId(result.id, value);
      const override = layer?.style?.series?.[id] || layer?.style?.series?.[key] || {};
      const color = override.color || getStableColor(id, usedColors);
      usedColors.add(color);
      return {
        bindingId: result.bindingId,
        color,
        id,
        key,
        label: getSeriesLabel(value, "Unclassified"),
        layerId: result.id,
        layerName: layer?.name || null,
        value,
      };
    });
  });
}

function buildRenderMetadata({ chart, preparedData, runtimeContext, timezone, visualization }) {
  const hasTime = preparedData.results.some((result) => hasField(result, "time"));
  const marks = new Set(preparedData.results.map((result) => result.mark));
  const canProject = marks.size === 1 && !marks.has("table") && !marks.has("markdown");
  const projection = canProject ? projectPreparedSeries({
    chart,
    preparedData,
    runtimeContext,
    timezone,
    visualization,
  }) : null;

  return {
    availableSeries: buildSeriesMetadata(preparedData, visualization, true),
    categories: buildCategoryMetadata(preparedData, visualization),
    dateFormat: projection?.dateFormat || "",
    frameVersion: preparedData.frameVersion,
    isTimeseries: hasTime,
    metrics: canProject ? buildMetricItems({
      chart,
      preparedData,
      runtimeContext,
      timezone,
      visualization,
    }) : [],
    series: buildSeriesMetadata(preparedData, visualization),
    timeRange: projection?.timeRange || null,
    visualizationVersion: visualization.version,
    warnings: preparedData.warnings || [],
  };
}

module.exports = {
  buildCategoryMetadata,
  buildRenderMetadata,
};
