const { formatCompactNumber, formatMetricValue, getGrowth, getStatus } = require("./metrics");
const { projectPreparedSeries } = require("./seriesProjection");
const { buildSeriesStyleMap } = require("./seriesStyles");
const { parseValueFormula, toNumericValue } = require("./valueFormula");

function formatMetricGoal(goal, formula) {
  const parsed = parseValueFormula(formula);
  return `${parsed.prefix}${formatCompactNumber(goal)}${parsed.suffix}`;
}

function buildMetricItems({ chart = {}, preparedData, runtimeContext, timezone, visualization }) {
  const projection = projectPreparedSeries({
    chart,
    preparedData,
    runtimeContext,
    timezone: timezone || preparedData.timezone,
    visualization,
  });
  const styles = buildSeriesStyleMap(preparedData, visualization);

  return projection.series.map((series) => {
    const values = series.values || [];
    const current = values.length > 0 ? values[values.length - 1] : null;
    const previous = values.length > 1 ? values[values.length - 2] : null;
    const currentNumber = toNumericValue(current);
    const previousNumber = toNumericValue(previous);
    const comparison = currentNumber === null
      ? null
      : getGrowth(currentNumber, previousNumber, Boolean(chart.invertGrowth));
    const goal = toNumericValue(series.goal);
    const style = styles.get(series.id) || {};

    return {
      color: style.color || null,
      comparison,
      formattedGoal: goal === null ? null : formatMetricGoal(goal, series.formula),
      goal,
      id: series.id,
      label: series.label || series.layerName || "Value",
      layerId: series.layerId,
      status: comparison === null ? "neutral" : getStatus(comparison),
      value: typeof current === "string"
        ? current
        : formatMetricValue(current, series.formula),
      valueNumber: currentNumber,
      values: [...values],
    };
  });
}

module.exports = { buildMetricItems };
