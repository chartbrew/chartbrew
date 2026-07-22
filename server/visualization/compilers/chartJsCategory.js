const PieChart = require("../../charts/PieChart");
const { buildChartMetrics } = require("../metrics");
const {
  buildChartJsDatasets,
  buildSeriesMetadata,
  getDomain,
  getStableColor,
} = require("./chartJsCartesian");
const { createSeriesId, getSeriesLabel, serializeTypedValue } = require("../seriesIdentity");

const CATEGORY_MARKS = new Set(["pie", "doughnut", "radar", "polar"]);
const SLICE_COLOR_MARKS = new Set(["pie", "doughnut", "polar"]);

function buildCategoryMetadata(frame, visualization, domain) {
  const usedColors = new Set();

  return frame.layers.flatMap((layerFrame) => {
    if (!SLICE_COLOR_MARKS.has(layerFrame.mark)) return [];
    const layer = visualization.layers.find((item) => item.id === layerFrame.id);
    const presentKeys = new Set(layerFrame.rows.map((row) => serializeTypedValue(row.category)));

    return [...domain.entries()].filter(([key]) => presentKeys.has(key)).map(([key, value]) => {
      const id = createSeriesId(layerFrame.id, value);
      const override = layer?.style?.series?.[id] || layer?.style?.series?.[key] || {};
      const color = override.color || getStableColor(id, usedColors);
      usedColors.add(color);
      return {
        bindingId: layerFrame.bindingId,
        color,
        id,
        key,
        label: getSeriesLabel(value, "Unclassified"),
        layerId: layerFrame.id,
        layerName: layer?.name || null,
        value,
      };
    });
  });
}

function compileChartJsCategory({ chart, frame, visualization }) {
  const marks = [...new Set(frame.layers.map((layer) => layer.mark))];
  if (marks.length !== 1 || !CATEGORY_MARKS.has(marks[0])) {
    throw new Error("Category Chart.js compiler requires a uniform category mark");
  }

  const domain = getDomain(frame);
  const compiled = buildChartJsDatasets(frame, visualization, domain, null);
  const categories = buildCategoryMetadata(frame, visualization, domain);
  if (SLICE_COLOR_MARKS.has(marks[0])) {
    compiled.configs.forEach((config) => {
      const layerFrame = frame.layers.find((candidate) => {
        return candidate.series.some((series) => series.id === config.id);
      });
      const layer = visualization.layers.find((candidate) => candidate.id === layerFrame?.id);
      const layerCategories = categories.filter((category) => category.layerId === layerFrame?.id);
      const categoryByKey = new Map(layerCategories.map((category) => [category.key, category]));
      const usedColors = new Set(layerCategories.map((category) => category.color));
      const categoryColors = [...domain.entries()].map(([key, value]) => {
        const category = categoryByKey.get(key);
        if (category) return category.color;
        const id = createSeriesId(layerFrame.id, value);
        const override = layer?.style?.series?.[id] || layer?.style?.series?.[key] || {};
        const color = override.color || getStableColor(id, usedColors);
        usedColors.add(color);
        return color;
      });
      if (categoryColors.length > 0) {
        config.fill = true;
        config.fillColor = categoryColors;
        config.multiFill = true;
      }
    });
  }
  const chartWithSeries = {
    ...chart,
    ChartDatasetConfigs: compiled.configs,
    type: marks[0],
  };
  const axisData = {
    x: [...domain.values()],
    y: compiled.datasets,
  };
  const configuration = new PieChart(chartWithSeries, compiled.configs, axisData).getConfiguration();
  buildChartMetrics(configuration, compiled.configs, chartWithSeries);
  configuration.meta = {
    categories,
    frameVersion: frame.version,
    series: buildSeriesMetadata(frame, visualization),
    visualizationVersion: visualization.version,
    warnings: frame.warnings,
  };

  return {
    configuration,
    frame,
    isTimeseries: false,
  };
}

module.exports = {
  CATEGORY_MARKS,
  SLICE_COLOR_MARKS,
  buildCategoryMetadata,
  compileChartJsCategory,
};
