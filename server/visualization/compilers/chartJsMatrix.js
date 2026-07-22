const moment = require("moment-timezone");
const MatrixChart = require("../../charts/MatrixChart");
const { buildSeriesStyleMap } = require("./chartJsCartesian");

function compileChartJsMatrix({ chart, frame, timezone, visualization }) {
  const layerFrame = frame.layers[0];
  const layer = visualization.layers.find((item) => item.id === layerFrame.id);
  const series = layerFrame.series[0];
  const style = buildSeriesStyleMap(frame, visualization).get(series.id);
  const config = {
    ...style,
    id: series.id,
  };
  const momentFn = (...args) => {
    const value = moment.utc(...args);
    return timezone ? value.tz(timezone) : value;
  };
  const axisData = {
    x: layerFrame.rows.map((row) => momentFn(row.time).format("YYYY-MM-DD")),
    y: [layerFrame.rows.map((row) => row.value)],
  };
  const startDate = chart.startDate ? momentFn(chart.startDate) : null;
  const endDate = chart.endDate ? momentFn(chart.endDate) : null;
  const chartWithSeries = {
    ...chart,
    ChartDatasetConfigs: [config],
    type: "matrix",
  };
  const configuration = new MatrixChart(
    chartWithSeries,
    [config],
    axisData,
    "YYYY-MM-DD",
    momentFn,
    startDate,
    endDate
  ).getConfiguration();
  configuration.meta = {
    frameVersion: frame.version,
    series: [{
      ...series,
      bindingId: layerFrame.bindingId,
      color: style.datasetColor,
      fillColor: style.fillColor,
      layerId: layer.id,
      layerName: layer.name || null,
    }],
    visualizationVersion: visualization.version,
    warnings: frame.warnings,
  };

  return {
    configuration,
    frame,
    isTimeseries: true,
  };
}

module.exports = {
  compileChartJsMatrix,
};
