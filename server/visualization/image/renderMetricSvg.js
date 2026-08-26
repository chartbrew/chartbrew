const { buildProjectedSeries } = require("../seriesProjection");
const { getGrowth, getStatus } = require("../metrics");
const { applyValueFormula, toNumericValue } = require("../valueFormula");
const { assertImageDimensions, assertPreparedRows } = require("../../modules/chartImage/imageLimits");
const { escapeXml, renderText } = require("./safeSvg");

const METRIC_COLORS = ["#048BDE", "#F59E0B", "#10B981", "#8B5CF6"];

function getMetricColor(visualization, series, index) {
  const layer = visualization.layers.find((item) => `${item.id}` === `${series.layerId}`) || {};
  const overrides = layer.style?.series || {};
  const override = overrides[series.id] || overrides[series.key] || {};
  return override.color || layer.style?.color || METRIC_COLORS[index % METRIC_COLORS.length];
}

function formatValue(value, locale) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat(locale || "en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return `${value ?? "—"}`;
}

function getMetricItems({ chart = {}, preparedData, visualization }) {
  const domain = new Map([["value", "Value"]]);
  return buildProjectedSeries(preparedData, visualization, domain, null).map((series, index) => {
    const values = series.values || [];
    const current = values.length > 0 ? values[values.length - 1] : null;
    const previous = values.length > 1 ? values[values.length - 2] : null;
    const currentNumber = toNumericValue(current);
    const previousNumber = toNumericValue(previous);
    const comparison = currentNumber === null
      ? null
      : getGrowth(currentNumber, previousNumber, Boolean(chart.invertGrowth));
    const goalValue = series.goal === null || series.goal === undefined
      ? null
      : toNumericValue(applyValueFormula(series.goal, series.formula));
    return {
      color: getMetricColor(visualization, series, index),
      comparison,
      goal: goalValue,
      id: series.id,
      label: series.label || series.layerName || "Value",
      status: comparison === null ? "neutral" : getStatus(comparison),
      value: current,
      valueNumber: currentNumber,
    };
  });
}

function renderMetricSvg({ chart = {}, colors, height, locale, preparedData, visualization, width }) {
  assertImageDimensions(width, height);
  assertPreparedRows(preparedData);
  const items = getMetricItems({ chart, preparedData, visualization }).slice(0, 4);
  const columns = Math.max(1, Math.min(items.length, width >= 720 ? 4 : 2));
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const valueSize = Math.max(30, Math.min(64, Math.round(Math.min(cellWidth / 6, cellHeight / 3))));
  const labelSize = Math.max(14, Math.round(valueSize * 0.32));
  const fragments = items.map((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = row * cellHeight;
    const centerX = x + (cellWidth / 2);
    const centerY = y + (cellHeight / 2);
    const value = renderText({
      anchor: "middle",
      color: colors.foreground,
      fontSize: valueSize,
      fontWeight: 700,
      text: formatValue(item.value, locale),
      width: cellWidth - 40,
      x: centerX,
      y: centerY,
    });
    const label = renderText({
      anchor: "middle",
      color: colors.muted,
      fontSize: labelSize,
      text: item.label,
      width: cellWidth - 40,
      x: centerX,
      y: centerY - valueSize,
    });
    let growth = "";
    if (chart.showGrowth !== false && item.comparison !== null) {
      let growthColor = colors.muted;
      let arrow = "";
      if (item.status === "positive") {
        growthColor = colors.positive;
        arrow = "↑";
      } else if (item.status === "negative") {
        growthColor = colors.negative;
        arrow = "↓";
      }
      growth = renderText({
        anchor: "middle",
        color: growthColor,
        fontSize: labelSize,
        fontWeight: 600,
        text: `${arrow}${Math.abs(item.comparison)}%`,
        width: cellWidth - 40,
        x: centerX,
        y: centerY + (valueSize * 0.72),
      });
    }
    let goal = "";
    if (item.goal !== null && item.valueNumber !== null && item.goal > 0) {
      const progress = Math.max(0, Math.min(1, item.valueNumber / item.goal));
      const barWidth = Math.min(220, cellWidth - 64);
      const barX = centerX - (barWidth / 2);
      const barY = centerY + valueSize;
      goal = `<rect x="${barX}" y="${barY}" width="${barWidth}" height="6" rx="3" fill="${colors.divider}"/>`
        + `<rect x="${barX}" y="${barY}" width="${barWidth * progress}" height="6" rx="3" fill="${escapeXml(item.color)}"/>`;
    }
    return `<g data-series-id="${escapeXml(item.id)}">${label}${value}${growth}${goal}</g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `
    + `viewBox="0 0 ${width} ${height}">${fragments}</svg>`;
}

module.exports = {
  formatValue,
  getMetricItems,
  renderMetricSvg,
};
