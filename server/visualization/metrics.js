const { parseValueFormula, toNumericValue } = require("./valueFormula");

function formatCompactNumber(number) {
  const absolute = Math.abs(number);
  if (absolute < 1000) return number.toLocaleString();
  if (absolute < 1_000_000) return `${(number / 1000).toFixed(1)}K`;
  if (absolute < 1_000_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (absolute < 1_000_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (absolute < 1_000_000_000_000_000) return `${(number / 1_000_000_000_000).toFixed(1)}T`;
  return number.toExponential(2);
}

function getGrowth(current, previous, invertGrowth) {
  let comparison;
  if (previous === null) {
    comparison = current === 0 ? 0 : 100;
  } else if (previous === 0) {
    comparison = current * 100;
  } else {
    comparison = ((current - previous) / previous) * 100;
  }

  if (invertGrowth) comparison *= -1;
  return Number(comparison.toFixed(2));
}

function getStatus(comparison) {
  if (comparison > 0) return "positive";
  if (comparison < 0) return "negative";
  return "neutral";
}

function formatMetricValue(value, formula) {
  const numeric = toNumericValue(value);
  const parsed = parseValueFormula(formula);
  if (numeric === null) return value;
  return `${parsed.prefix}${numeric.toLocaleString()}${parsed.suffix}`;
}

module.exports = {
  formatCompactNumber,
  formatMetricValue,
  getGrowth,
  getStatus,
};
