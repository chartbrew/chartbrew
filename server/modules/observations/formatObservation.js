const { formatMetricValue, getValueFormat } = require("./valueFormat");

function formatObservationText(monitor, candidate) {
  const valueFormat = getValueFormat(monitor.metric_spec);
  const changePercent = Math.abs(candidate.relativeDelta * 100);
  const verb = candidate.direction === "increase" ? "increased" : "decreased";
  const isPercentage = valueFormat.meaning === "percentage";
  const pointChange = Math.abs(candidate.absoluteDelta * valueFormat.display.scale);
  const pointDigits = Number.isInteger(valueFormat.display.decimals)
    ? valueFormat.display.decimals
    : 1;
  const formattedPointChange = new Intl.NumberFormat("en", {
    maximumFractionDigits: pointDigits,
    minimumFractionDigits: pointDigits,
  }).format(pointChange);
  const changeLanguage = isPercentage
    ? `${formattedPointChange} percentage ${pointChange === 1 ? "point" : "points"}`
    : `${changePercent.toFixed(1)}%`;
  const title = `${monitor.name} ${verb} ${changeLanguage}`;
  const comparison = monitor.baseline_policy?.type === "previous_period"
    ? "the previous period"
    : "its recent baseline";
  const summary = `Compared with ${comparison}, ${monitor.name} moved from ${formatMetricValue(
    candidate.baselineValue,
    valueFormat
  )} to ${formatMetricValue(candidate.currentValue, valueFormat)}.`;

  return { summary, title };
}

module.exports = {
  formatNumber: (value, unit) => formatMetricValue(value, getValueFormat({ unit })),
  formatObservationText,
};
