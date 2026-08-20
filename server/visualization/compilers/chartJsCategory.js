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

function buildCategoryMetadata(preparedData, visualization, domain) {
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

function compileChartJsCategory({ chart, preparedData, visualization }) {
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  if (marks.length !== 1 || !CATEGORY_MARKS.has(marks[0])) {
    throw new Error("Category Chart.js compiler requires a uniform category mark");
  }

  const domain = getDomain(preparedData);
  const compiled = buildChartJsDatasets(preparedData, visualization, domain, null);
  const categories = buildCategoryMetadata(preparedData, visualization, domain);
  if (SLICE_COLOR_MARKS.has(marks[0])) {
    compiled.configs.forEach((config) => {
      const result = preparedData.results.find((candidate) => {
        return candidate.series.some((series) => series.id === config.id);
      });
      const layer = visualization.layers.find((candidate) => candidate.id === result?.id);
      const layerCategories = categories.filter((category) => category.layerId === result?.id);
      const categoryByKey = new Map(layerCategories.map((category) => [category.key, category]));
      const usedColors = new Set(layerCategories.map((category) => category.color));
      const categoryColors = [...domain.entries()].map(([key, value]) => {
        const category = categoryByKey.get(key);
        if (category) return category.color;
        const id = createSeriesId(result.id, value);
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
    frameVersion: preparedData.frameVersion,
    series: buildSeriesMetadata(preparedData, visualization),
    visualizationVersion: visualization.version,
    warnings: preparedData.warnings,
  };

  return {
    configuration,
    preparedData,
    isTimeseries: false,
  };
}

module.exports = {
  CATEGORY_MARKS,
  SLICE_COLOR_MARKS,
  buildCategoryMetadata,
  compileChartJsCategory,
};
