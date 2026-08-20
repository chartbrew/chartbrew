const { projectPreparedSeries } = require("../seriesProjection");
const { buildSeriesStyleMap } = require("./chartJsCartesian");

function getUniqueLabel(label, usedLabels) {
  const base = label || "Value";
  let candidate = base;
  let suffix = 2;
  while (usedLabels.has(candidate)) {
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
  usedLabels.add(candidate);
  return candidate;
}

function compileShownExport({
  chart = {},
  preparedData,
  runtimeContext,
  timezone,
  visualization,
}) {
  const projection = projectPreparedSeries({
    chart,
    preparedData,
    runtimeContext,
    timezone,
    visualization,
  });
  const styles = buildSeriesStyleMap(preparedData, visualization);
  const usedLabels = new Set();
  const seriesLabels = projection.series.map((series) => {
    return getUniqueLabel(styles.get(series.id)?.legend || series.label, usedLabels);
  });
  const rows = projection.labels.map((label, index) => {
    return projection.series.reduce((row, series, seriesIndex) => {
      row[seriesLabels[seriesIndex]] = series.values[index] ?? null;
      return row;
    }, { Category: label });
  });

  return {
    [chart.name || "Chart as shown"]: rows,
  };
}

module.exports = { compileShownExport };
