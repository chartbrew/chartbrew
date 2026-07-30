function formatNumber(value, unit) {
  if (unit === "percent" || unit === "percentage_point") {
    return `${Number(value).toFixed(1)}%`;
  }
  if (unit?.startsWith("currency_")) {
    return new Intl.NumberFormat("en", {
      currency: unit.slice("currency_".length).toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  }
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function formatObservationText(monitor, candidate) {
  const changePercent = Math.abs(candidate.relativeDelta * 100);
  const verb = candidate.direction === "increase" ? "increased" : "decreased";
  const title = `${monitor.name} ${verb} ${changePercent.toFixed(1)}%`;
  const pointLanguage = monitor.metric_spec.unit === "percentage_point"
    ? `${Math.abs(candidate.absoluteDelta).toFixed(1)} percentage points`
    : `${changePercent.toFixed(1)}%`;
  const summary = `${monitor.name} changed from ${formatNumber(
    candidate.baselineValue,
    monitor.metric_spec.unit
  )} to ${formatNumber(candidate.currentValue, monitor.metric_spec.unit)}, a ${pointLanguage} ${
    candidate.direction === "increase" ? "increase" : "decrease"
  }.`;

  return { summary, title };
}

module.exports = {
  formatNumber,
  formatObservationText,
};
