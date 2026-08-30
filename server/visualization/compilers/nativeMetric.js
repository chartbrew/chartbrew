const { buildMetricItems } = require("../metricProjection");

const METRIC_MARKS = new Set(["avg", "kpi"]);

function compileNativeMetric({ chart, preparedData, runtimeContext, timezone, visualization }) {
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  if (marks.length !== 1 || !METRIC_MARKS.has(marks[0])) {
    throw new Error("Native metric compiler requires a uniform KPI or average mark");
  }

  return {
    configuration: {
      items: buildMetricItems({
        chart,
        preparedData,
        runtimeContext,
        timezone,
        visualization,
      }),
    },
    preparedData,
  };
}

module.exports = {
  METRIC_MARKS,
  compileNativeMetric,
};
