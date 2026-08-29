const { chartColors } = require("../charts/colors");

const SERIES_COLORS = Object.values(chartColors).map((color) => color.hex);
const DEFAULT_RADAR_FILL_OPACITY = 0.15;

function clampOpacity(opacity) {
  const value = Number(opacity);
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function applyColorAlpha(color, opacity) {
  const value = clampOpacity(opacity);
  if (value === null || typeof color !== "string") return color;

  const hex = color.trim().match(/^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i);
  if (hex) {
    const normalized = hex[1].length <= 4
      ? hex[1].slice(0, 3).split("").map((character) => `${character}${character}`).join("")
      : hex[1].slice(0, 6);
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${value})`;
  }

  const rgb = color.trim().match(/^rgba?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${value})`;

  const hsl = color.trim().match(/^hsla?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
  if (hsl) return `hsla(${hsl[1]}, ${hsl[2]}, ${hsl[3]}, ${value})`;

  return color;
}

function getStableColor(seriesId, usedColors = new Set()) {
  const hash = `${seriesId}`.replace(/[^a-f0-9]/gi, "").slice(-8);
  const preferredIndex = Number.parseInt(hash || "0", 16) % SERIES_COLORS.length;

  for (let offset = 0; offset < SERIES_COLORS.length; offset += 1) {
    const color = SERIES_COLORS[(preferredIndex + offset) % SERIES_COLORS.length];
    if (!usedColors.has(color)) return color;
  }

  return SERIES_COLORS[preferredIndex];
}

function getSeriesStyle(layer, series, options = {}) {
  const overrides = layer.style?.series || {};
  const override = overrides[series.id] || overrides[series.key] || {};
  const generatedColor = options.generatedColor || getStableColor(series.id);
  const isBreakdown = Boolean(layer.encoding?.breakdown);
  const defaultColor = isBreakdown ? generatedColor : layer.style?.color || generatedColor;
  const color = override.color || defaultColor;
  const configuredFillOpacity = clampOpacity(override.fillOpacity ?? layer.style?.fillOpacity);
  const fillOpacity = configuredFillOpacity === null && layer.mark === "radar"
    ? DEFAULT_RADAR_FILL_OPACITY
    : configuredFillOpacity;
  const defaultFillColor = layer.mark === "radar" || isBreakdown
    ? color
    : layer.style?.fillColor || color;
  const fillColor = fillOpacity === null
    ? override.fillColor || defaultFillColor
    : applyColorAlpha(color, fillOpacity);

  return {
    color,
    fill: override.fill ?? layer.style?.fill ?? (layer.mark === "radar" ? false : isBreakdown),
    fillColor,
    fillOpacity,
    label: override.label || series.label,
    multiFill: layer.mark === "radar"
      ? false
      : override.multiFill ?? layer.style?.multiFill ?? false,
    pointRadius: override.pointRadius ?? layer.style?.pointRadius ?? null,
  };
}

function getAvailableCatalog(result) {
  const visible = result.series || [];
  const visibleIds = new Set(visible.map((series) => series.id));
  return [
    ...visible,
    ...(result.availableSeries || []).filter((series) => !visibleIds.has(series.id)),
  ];
}

function buildSeriesStyleMap(preparedData, visualization) {
  const entries = preparedData.results.flatMap((result) => {
    const layer = visualization.layers.find((item) => item.id === result.id) || {};
    return getAvailableCatalog(result).map((series) => ({ layer, series }));
  });
  const usedColors = new Set(entries.map(({ layer, series }) => {
    const overrides = layer.style?.series || {};
    return (overrides[series.id] || overrides[series.key] || {}).color;
  }).filter(Boolean));
  const styles = new Map();

  entries.forEach(({ layer, series }) => {
    const style = getSeriesStyle(layer, series, {
      generatedColor: getStableColor(series.id, usedColors),
    });
    usedColors.add(style.color);
    styles.set(series.id, style);
  });

  return styles;
}

function buildSeriesMetadata(preparedData, visualization, available = false) {
  const styles = buildSeriesStyleMap(preparedData, visualization);
  return preparedData.results.flatMap((result) => {
    const layer = visualization.layers.find((item) => item.id === result.id);
    const seriesItems = available ? getAvailableCatalog(result) : result.series;
    return seriesItems.map((series) => {
      const style = styles.get(series.id) || {};
      return {
        ...series,
        bindingId: result.bindingId,
        color: style.color || null,
        fillColor: style.fillColor || null,
        layerId: result.id,
        layerName: layer?.name || null,
      };
    });
  });
}

module.exports = {
  SERIES_COLORS,
  buildSeriesMetadata,
  buildSeriesStyleMap,
  getAvailableCatalog,
  getSeriesStyle,
  getStableColor,
};
