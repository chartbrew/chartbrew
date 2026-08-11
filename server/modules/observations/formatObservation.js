const { formatMetricValue, getValueFormat } = require("./valueFormat");
const { formatComparisonLabel, formatPeriodLabel } = require("./periodLabels");

function formatObservationText(monitor, candidate) {
  const valueFormat = getValueFormat(monitor.metric_spec);
  const changePercent = candidate.relativeDelta === null
    ? Number.NaN
    : Math.abs(Number(candidate.relativeDelta) * 100);
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
  let changeLanguage = formatMetricValue(Math.abs(candidate.absoluteDelta), valueFormat);
  if (Number.isFinite(changePercent)) changeLanguage = `${changePercent.toFixed(1)}%`;
  if (isPercentage) {
    changeLanguage = `${formattedPointChange} percentage ${pointChange === 1 ? "point" : "points"}`;
  }
  const title = `${monitor.name} ${verb} ${changeLanguage}`;
  const period = candidate.comparisonPeriodType
    || monitor.baseline_policy?.comparisonPeriod;
  const timezone = candidate.calendarTimezone
    || monitor.baseline_policy?.calendarTimezone
    || "UTC";
  const currentPeriod = candidate.currentPeriod || candidate.windows?.current;
  const comparisonPeriod = candidate.comparisonPeriod || candidate.windows?.comparison;
  let summary = `Compared with its previous result, ${monitor.name} moved from ${formatMetricValue(
    candidate.baselineValue,
    valueFormat
  )} to ${formatMetricValue(candidate.currentValue, valueFormat)}.`;
  let comparisonLabel = null;
  if (period && currentPeriod && comparisonPeriod) {
    const currentLabel = formatPeriodLabel(period, currentPeriod, timezone);
    const previousLabel = formatPeriodLabel(period, comparisonPeriod, timezone);
    comparisonLabel = formatComparisonLabel({
      comparison: comparisonPeriod,
      current: currentPeriod,
      period,
      timezone,
    });
    summary = `${currentLabel}: ${formatMetricValue(candidate.currentValue, valueFormat)}, compared with ${
      formatMetricValue(candidate.baselineValue, valueFormat)
    } in ${previousLabel}.`;
  }

  return { comparisonLabel, summary, title };
}

module.exports = {
  formatNumber: (value, unit) => formatMetricValue(value, getValueFormat({ unit })),
  formatObservationText,
};
