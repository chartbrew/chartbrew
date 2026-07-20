const PieChart = require("../../charts/PieChart");
const { buildChartMetrics } = require("../metrics");
const {
  buildChartJsDatasets,
  buildSeriesMetadata,
  getDomain,
} = require("./chartJsCartesian");

const CATEGORY_MARKS = new Set(["pie", "doughnut", "radar", "polar"]);

function compileChartJsCategory({ chart, frame, visualization }) {
  const marks = [...new Set(frame.layers.map((layer) => layer.mark))];
  if (marks.length !== 1 || !CATEGORY_MARKS.has(marks[0])) {
    throw new Error("Category Chart.js compiler requires a uniform category mark");
  }

  const domain = getDomain(frame);
  const compiled = buildChartJsDatasets(frame, visualization, domain, null);
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
  compileChartJsCategory,
};
