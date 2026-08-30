const { buildMetricItems } = require("../metricProjection");
const { assertImageDimensions, assertPreparedRows } = require("../../modules/chartImage/imageLimits");
const { escapeXml, renderText } = require("./safeSvg");

function formatValue(value, locale) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat(locale || "en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return `${value ?? "—"}`;
}

function formatComparison(comparison) {
  if (!Number.isFinite(comparison)) return "0";
  return Math.abs(comparison % 1 === 0 ? Math.round(comparison) : comparison.toFixed(2)).toString();
}

function estimateTextWidth(text, fontSize) {
  return Math.ceil([...`${text ?? ""}`].length * fontSize * 0.55);
}

function renderKpiOverlaySvg({
  chart = {}, colors, detailScale = 1, height, items = [], scale = 1, width,
}) {
  assertImageDimensions(width, height);
  const safeDetailScale = Math.max(1, Number(detailScale) || 1);
  const safeScale = Math.max(1, Number(scale) || 1);
  const availableItems = items.filter((item) => item.valueNumber !== null);
  const logicalWidth = width / safeDetailScale;
  const capacity = Math.max(1, Math.min(8, Math.floor(logicalWidth / 130)));
  const visibleItems = availableItems.slice(0, capacity);
  const hiddenCount = Math.max(0, availableItems.length - visibleItems.length);
  const gap = Math.round(20 * safeScale);
  const valueSize = Math.round(32 * safeScale);
  const labelSize = Math.round(16 * safeScale);
  const growthSize = Math.round(14 * safeScale);
  const chipHeight = Math.round(28 * safeScale);
  const chipPadding = Math.round(10 * safeScale);
  const hiddenWidth = hiddenCount > 0 ? Math.round(44 * safeScale) : 0;
  const metricsWidth = Math.max(1, width - hiddenWidth - (hiddenCount > 0 ? gap : 0));
  const itemWidth = visibleItems.length > 0
    ? Math.max(
      1,
      (metricsWidth - (gap * Math.max(0, visibleItems.length - 1))) / visibleItems.length,
    )
    : metricsWidth;
  const valueBaseline = Math.round(34 * safeScale);
  const labelBaseline = Math.min(height - Math.round(4 * safeScale), Math.round(64 * safeScale));
  const showGrowth = Boolean(chart.showGrowth);
  const fragments = visibleItems.map((item, index) => {
    const x = index * (itemWidth + gap);
    const valueText = `${item.value ?? "—"}`;
    const valueWidth = Math.min(itemWidth, estimateTextWidth(valueText, valueSize));
    const value = renderText({
      color: colors.foreground,
      fontSize: valueSize,
      fontWeight: 700,
      text: valueText,
      width: itemWidth,
      x,
      y: valueBaseline,
    });
    let growth = "";
    if (showGrowth && item.comparison !== null) {
      let arrow = "";
      let growthColor = colors.muted;
      if (item.status === "positive") {
        arrow = "↗";
        growthColor = colors.positive;
      } else if (item.status === "negative") {
        arrow = "↘";
        growthColor = colors.negative;
      }
      const growthText = `${arrow}${arrow ? " " : ""}${formatComparison(item.comparison)}%`;
      const chipWidth = Math.min(
        Math.max(chipHeight, estimateTextWidth(growthText, growthSize) + (chipPadding * 2)),
        Math.max(1, itemWidth - valueWidth - Math.round(8 * safeScale)),
      );
      const chipX = x + valueWidth + Math.round(8 * safeScale);
      const chipY = valueBaseline - Math.round(chipHeight * 0.78);
      if (chipWidth >= chipHeight) {
        growth = [
          `<g data-kpi-growth="${escapeXml(item.status)}">`,
          `<rect x="${chipX}" y="${chipY}" width="${chipWidth}" height="${chipHeight}" `
            + `rx="${Math.round(chipHeight / 2)}" fill="${growthColor}" fill-opacity="0.14"/>`,
          renderText({
            anchor: "middle",
            color: growthColor,
            fontSize: growthSize,
            fontWeight: 600,
            text: growthText,
            width: chipWidth - (chipPadding * 2),
            x: chipX + (chipWidth / 2),
            y: chipY + Math.round(chipHeight * 0.69),
          }),
          "</g>",
        ].join("");
      }
    }
    const label = renderText({
      color: availableItems.length > 1 ? escapeXml(item.color) : colors.muted,
      fontSize: labelSize,
      text: item.label,
      width: itemWidth,
      x,
      y: labelBaseline,
    });
    return `<g data-kpi-series-id="${escapeXml(item.id)}">${value}${growth}${label}</g>`;
  }).join("");
  const hidden = hiddenCount > 0 ? renderText({
    anchor: "end",
    color: colors.muted,
    fontSize: labelSize,
    fontWeight: 600,
    text: `+${hiddenCount}`,
    width: hiddenWidth,
    x: width,
    y: valueBaseline,
  }) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `
    + `viewBox="0 0 ${width} ${height}"><g data-kpi-overlay="true">`
    + `${fragments}${hidden}</g></svg>`;
}

function renderMetricSvg({
  chart = {}, colors, detailScale = 1, height, locale, preparedData, renderContext,
  visualization, width,
}) {
  assertImageDimensions(width, height);
  assertPreparedRows(preparedData);
  const scale = Math.max(1, Number(detailScale) || 1);
  const items = buildMetricItems({
    chart,
    preparedData,
    runtimeContext: renderContext,
    visualization,
  }).slice(0, 4);
  const columns = Math.max(1, Math.min(items.length, width >= 720 ? 4 : 2));
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const logicalCellWidth = cellWidth / scale;
  const logicalCellHeight = cellHeight / scale;
  const logicalValueSize = Math.max(
    30,
    Math.min(64, Math.round(Math.min(logicalCellWidth / 6, logicalCellHeight / 3)))
  );
  const valueSize = Math.round(logicalValueSize * scale);
  const labelSize = Math.round(Math.max(14, logicalValueSize * 0.32) * scale);
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
      width: cellWidth - (40 * scale),
      x: centerX,
      y: centerY,
    });
    const label = renderText({
      anchor: "middle",
      color: colors.muted,
      fontSize: labelSize,
      text: item.label,
      width: cellWidth - (40 * scale),
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
        width: cellWidth - (40 * scale),
        x: centerX,
        y: centerY + (valueSize * 0.72),
      });
    }
    let goal = "";
    if (item.goal !== null && item.valueNumber !== null && item.goal > 0) {
      const progress = Math.max(0, Math.min(1, item.valueNumber / item.goal));
      const barWidth = Math.max(1, Math.min(220 * scale, cellWidth - (64 * scale)));
      const barX = centerX - (barWidth / 2);
      const barY = centerY + valueSize;
      goal = `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${6 * scale}" rx="${3 * scale}" fill="${colors.divider}"/>`
        + `<rect x="${barX}" y="${barY}" width="${barWidth * progress}" height="${6 * scale}" rx="${3 * scale}" fill="${escapeXml(item.color)}"/>`;
    }
    return `<g data-series-id="${escapeXml(item.id)}">${label}${value}${growth}${goal}</g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `
    + `viewBox="0 0 ${width} ${height}">${fragments}</svg>`;
}

module.exports = {
  formatComparison,
  formatValue,
  getMetricItems: buildMetricItems,
  renderKpiOverlaySvg,
  renderMetricSvg,
};
