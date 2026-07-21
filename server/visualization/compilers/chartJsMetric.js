const LineChart = require("../../charts/LineChart");
const PieChart = require("../../charts/PieChart");
const { buildChartMetrics } = require("../metrics");
const { applyValueFormula } = require("../valueFormula");
const { buildSeriesMetadata, buildSeriesStyleMap } = require("./chartJsCartesian");

const METRIC_MARKS = new Set(["kpi", "avg", "gauge"]);

function buildMetricDatasets(frame, visualization) {
  const datasets = [];
  const configs = [];
  const styles = buildSeriesStyleMap(frame, visualization);

  frame.layers.forEach((layerFrame) => {
    const layer = visualization.layers.find((item) => item.id === layerFrame.id);
    layerFrame.series.forEach((series) => {
      const style = styles.get(series.id);
      datasets.push(layerFrame.rows
        .filter((row) => row.__seriesId === series.id)
        .map((row) => applyValueFormula(row.value, layer.encoding.value?.formula, {
          formatted: true,
        })));
      configs.push({
        ...style,
        formula: layer.encoding.value?.formula || null,
        goal: layer.goal ?? null,
        id: series.id,
        layerId: layer.id,
      });
    });
  });

  return { configs, datasets };
}

function compileChartJsMetric({ chart, frame, visualization }) {
  const marks = [...new Set(frame.layers.map((layer) => layer.mark))];
  if (marks.length !== 1 || !METRIC_MARKS.has(marks[0])) {
    throw new Error("Metric Chart.js compiler requires a uniform KPI, average, or gauge mark");
  }

  const mark = marks[0];
  const compiled = buildMetricDatasets(frame, visualization);
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
  METRIC_MARKS,
  buildMetricDatasets,
  compileChartJsMetric,
};
