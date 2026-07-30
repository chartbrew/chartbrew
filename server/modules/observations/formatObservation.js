const { formatMetricValue, getValueFormat } = require("./valueFormat");

function formatObservationText(monitor, candidate) {
  const valueFormat = getValueFormat(monitor.metric_spec);
  const changePercent = Math.abs(candidate.relativeDelta * 100);
  const verb = candidate.direction === "increase" ? "increased" : "decreased";
  const title = `${monitor.name} ${verb} ${changePercent.toFixed(1)}%`;
  const pointLanguage = valueFormat.type === "percentage"
    ? `${Math.abs(candidate.absoluteDelta * valueFormat.scale).toFixed(1)} percentage points`
    : `${changePercent.toFixed(1)}%`;
  const summary = `${monitor.name} changed from ${formatMetricValue(
    candidate.baselineValue,
    valueFormat
  )} to ${formatMetricValue(candidate.currentValue, valueFormat)}, a ${pointLanguage} ${
    candidate.direction === "increase" ? "increase" : "decrease"
  }.`;

  return { summary, title };
}

module.exports = {
  formatNumber: (value, unit) => formatMetricValue(value, getValueFormat({ unit })),
  formatObservationText,
};
