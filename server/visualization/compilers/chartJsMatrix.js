const moment = require("moment-timezone");
const MatrixChart = require("../../charts/MatrixChart");
const { projectPreparedSeries } = require("../seriesProjection");
const { buildSeriesStyleMap } = require("./chartJsCartesian");

function compileChartJsMatrix({
  chart, preparedData, runtimeContext, timezone, visualization,
}) {
  const result = preparedData.results[0];
  const layer = visualization.layers.find((item) => item.id === result.id);
  const series = result.series[0];
  const style = buildSeriesStyleMap(preparedData, visualization).get(series.id);
  const projection = projectPreparedSeries({
    chart,
    preparedData,
    runtimeContext,
    timezone,
    visualization,
  });
  const config = {
    ...style,
    id: series.id,
  };
  const momentFn = (...args) => {
    const value = moment.utc(...args);
    return timezone ? value.tz(timezone) : value;
  };
  const axisData = {
    x: projection.labels,
    y: [projection.series[0]?.values || []],
  };
  const effectiveDateRange = runtimeContext?.effectiveDateRange;
  let startDate = chart.startDate ? momentFn(chart.startDate) : null;
  let endDate = chart.endDate ? momentFn(chart.endDate) : null;
  if (effectiveDateRange?.startDate) {
    startDate = momentFn(effectiveDateRange.startDate);
  }
  if (effectiveDateRange?.endDate) {
    endDate = momentFn(effectiveDateRange.endDate);
  }
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
    frameVersion: preparedData.frameVersion,
    series: [{
      ...series,
      bindingId: result.bindingId,
      color: style.datasetColor,
      fillColor: style.fillColor,
      layerId: layer.id,
      layerName: layer.name || null,
    }],
    visualizationVersion: visualization.version,
    warnings: preparedData.warnings,
  };

  return {
    configuration,
    preparedData,
    isTimeseries: true,
  };
}

module.exports = {
  compileChartJsMatrix,
};
