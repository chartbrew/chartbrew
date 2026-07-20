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

function buildChartMetrics(configuration, configs, chart) {
  const growth = [];
  const goals = [];

  (configuration.data?.datasets || []).forEach((dataset, index) => {
    const config = configs[index] || {};
    const data = Array.isArray(dataset.data) ? dataset.data : [];
    const numericValues = data.map((value) => toNumericValue(value));
    const current = numericValues.length > 0 ? numericValues[numericValues.length - 1] : null;
    const previous = numericValues.length > 1 ? numericValues[numericValues.length - 2] : null;

    if (current !== null) {
      const comparison = getGrowth(current, previous, Boolean(chart.invertGrowth));
      growth.push({
        comparison,
        label: dataset.label,
        status: getStatus(comparison),
        value: formatMetricValue(current, config.formula),
      });
    }

    const goal = toNumericValue(config.goal);
    if (goal !== null && current !== null) {
      const parsed = parseValueFormula(config.formula);
      goals.push({
        formattedMax: `${parsed.prefix}${formatCompactNumber(goal)}${parsed.suffix}`,
        formattedValue: formatMetricValue(current, config.formula),
        goalIndex: index,
        max: goal,
        value: current,
      });
    }
  });

  configuration.goals = goals;
  configuration.growth = growth;
  return configuration;
}

module.exports = {
  buildChartMetrics,
  formatCompactNumber,
  formatMetricValue,
  getGrowth,
  getStatus,
};
