const LineChart = require("../../charts/LineChart");
const PieChart = require("../../charts/PieChart");
const { buildChartMetrics } = require("../metrics");
const { buildProjectedSeries } = require("../seriesProjection");
const { buildSeriesMetadata, buildSeriesStyleMap } = require("./chartJsCartesian");

const METRIC_MARKS = new Set(["kpi", "avg", "gauge"]);

function buildMetricDatasets(preparedData, visualization) {
  const styles = buildSeriesStyleMap(preparedData, visualization);
  const projected = buildProjectedSeries(
    preparedData,
    visualization,
    new Map([["value", "Value"]]),
    null
  );
  const datasets = projected.map((series) => series.values);
  const configs = projected.map((series) => ({
    ...styles.get(series.id),
    formula: series.formula,
    goal: series.goal,
    id: series.id,
    layerId: series.layerId,
  }));

  return { configs, datasets };
}

function compileChartJsMetric({ chart, preparedData, visualization }) {
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  if (marks.length !== 1 || !METRIC_MARKS.has(marks[0])) {
    throw new Error("Metric Chart.js compiler requires a uniform KPI, average, or gauge mark");
  }

  const mark = marks[0];
  const compiled = buildMetricDatasets(preparedData, visualization);
  const chartWithSeries = {
    ...chart,
    ChartDatasetConfigs: compiled.configs,
    type: mark,
  };
  const axisData = {
    x: ["Value"],
    y: compiled.datasets,
  };
  const compiler = mark === "gauge"
    ? new PieChart(chartWithSeries, compiled.configs, axisData)
    : new LineChart(chartWithSeries, compiled.configs, axisData);
  const configuration = compiler.getConfiguration();
  buildChartMetrics(configuration, compiled.configs, chartWithSeries);
  configuration.meta = {
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
  METRIC_MARKS,
  buildMetricDatasets,
  compileChartJsMetric,
};
