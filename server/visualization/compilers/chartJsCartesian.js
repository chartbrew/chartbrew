const BarChart = require("../../charts/BarChart");
const LineChart = require("../../charts/LineChart");
const { chartColors } = require("../../charts/colors");
const { buildChartMetrics } = require("../metrics");
const {
  buildProjectedSeries,
  buildTimeRange,
  getDomain,
  hasField,
  projectPreparedSeries,
} = require("../seriesProjection");

const SERIES_COLORS = Object.values(chartColors).map((color) => color.hex);
const DEFAULT_RADAR_FILL_OPACITY = 0.15;

function clampOpacity(opacity) {
  const numericOpacity = Number(opacity);
  if (!Number.isFinite(numericOpacity)) return null;
  return Math.min(1, Math.max(0, numericOpacity));
}

function applyColorAlpha(color, opacity) {
  const normalizedOpacity = clampOpacity(opacity);
  if (normalizedOpacity === null || typeof color !== "string") return color;

  const hex = color.trim().match(/^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i);
  if (hex) {
    const value = hex[1].length <= 4
      ? hex[1].slice(0, 3).split("").map((character) => `${character}${character}`).join("")
      : hex[1].slice(0, 6);
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${normalizedOpacity})`;
  }

  const rgb = color.trim().match(/^rgba?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${normalizedOpacity})`;

  const hsl = color.trim().match(/^hsla?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
  if (hsl) return `hsla(${hsl[1]}, ${hsl[2]}, ${hsl[3]}, ${normalizedOpacity})`;

  return color;
}

function getStableColor(seriesId, usedColors = new Set()) {
  const hashPart = `${seriesId}`.replace(/[^a-f0-9]/gi, "").slice(-8);
  const preferredIndex = Number.parseInt(hashPart || "0", 16) % SERIES_COLORS.length;

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
  const isBreakdown = Boolean(layer.encoding.breakdown);
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
    datasetColor: color,
    fill: override.fill ?? layer.style?.fill ?? (layer.mark === "radar" ? false : isBreakdown),
    fillColor,
    fillOpacity,
    legend: override.label || series.label,
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
    const layer = visualization.layers.find((item) => item.id === result.id);
    return getAvailableCatalog(result)
      .map((series) => ({ layer, result, series }));
  });
  const usedColors = new Set(entries.map(({ layer, series }) => {
    const overrides = layer.style?.series || {};
    return (overrides[series.id] || overrides[series.key] || {}).color;
  }).filter(Boolean));
  const styles = new Map();

  entries.forEach(({ layer, series }) => {
    const generatedColor = getStableColor(series.id, usedColors);
    const style = getSeriesStyle(layer, series, { generatedColor });
    usedColors.add(style.datasetColor);
    styles.set(series.id, style);
  });

  return styles;
}

function buildSeriesMetadata(preparedData, visualization) {
  const styles = buildSeriesStyleMap(preparedData, visualization);
  return preparedData.results.flatMap((result) => {
    const layer = visualization.layers.find((item) => item.id === result.id);
    return result.series.map((series) => {
      const style = styles.get(series.id);
      return {
        ...series,
        bindingId: result.bindingId,
        color: style.datasetColor,
        fillColor: style.fillColor,
        layerId: result.id,
        layerName: layer?.name || null,
      };
    });
  });
}

function buildAvailableSeriesMetadata(preparedData, visualization) {
  const styles = buildSeriesStyleMap(preparedData, visualization);
  return preparedData.results.flatMap((result) => {
    const layer = visualization.layers.find((item) => item.id === result.id);
    return getAvailableCatalog(result).map((series) => {
      const style = styles.get(series.id);
      return {
        ...series,
        bindingId: result.bindingId,
        color: style.datasetColor,
        fillColor: style.fillColor,
        layerId: result.id,
        layerName: layer?.name || null,
      };
    });
  });
}

function buildChartJsDatasets(preparedData, spec, domain, missingValue) {
  const styles = buildSeriesStyleMap(preparedData, spec);
  const projected = buildProjectedSeries(preparedData, spec, domain, missingValue);
  const datasets = projected.map((series) => series.values);
  const configs = projected.map((series) => ({
    ...styles.get(series.id),
    formula: series.formula,
    goal: series.goal,
    id: series.id,
    layerId: series.layerId,
  }));

  return { configs, datasets };
}

function compileChartJsCartesian({ chart, preparedData, runtimeContext, timezone, visualization }) {
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  if (marks.length !== 1 || !["area", "bar", "horizontalBar", "line"].includes(marks[0])) {
    throw new Error("Cartesian Chart.js compiler requires uniform area, bar, horizontalBar, or line layers");
  }

  const projection = projectPreparedSeries({
    chart,
    preparedData,
    runtimeContext,
    timezone,
    visualization,
  });
  const domain = projection.domain;
  const timeResult = preparedData.results.find((result) => hasField(result, "time"));
  const missingPolicy = visualization.settings?.missingValues?.policy || "preserve";
  const missingValue = missingPolicy === "zero" ? 0 : null;
  const compiled = buildChartJsDatasets(preparedData, visualization, domain, missingValue);
  const mark = marks[0];
  if (mark === "area") {
    compiled.configs.forEach((config) => {
      config.fill = true;
    });
  }
  let chartType = mark;
  if (mark === "area") chartType = "line";
  if (mark === "horizontalBar") chartType = "bar";
  const chartWithSeries = {
    ...chart,
    ChartDatasetConfigs: compiled.configs,
    displayLegend: visualization.settings?.legend?.visible ?? chart.displayLegend ?? true,
    horizontal: mark === "horizontalBar",
    stacked: visualization.layers.some((layer) => layer.stack !== "none"),
    type: chartType,
  };
  const axisData = {
    x: projection.labels,
    y: compiled.datasets,
  };
  const compiler = ["bar", "horizontalBar"].includes(mark)
    ? new BarChart(chartWithSeries, compiled.configs, axisData)
    : new LineChart(chartWithSeries, compiled.configs, axisData);
  const configuration = compiler.getConfiguration();
  buildChartMetrics(configuration, compiled.configs, chartWithSeries);

  configuration.meta = {
    availableSeries: buildAvailableSeriesMetadata(preparedData, visualization),
    frameVersion: preparedData.frameVersion,
    series: buildSeriesMetadata(preparedData, visualization),
    timeRange: projection.timeRange,
    visualizationVersion: visualization.version,
    warnings: preparedData.warnings,
  };

  return {
    conditionsOptions: [],
    configuration,
    preparedData,
    isTimeseries: Boolean(timeResult),
    dateFormat: projection.dateFormat,
  };
}

module.exports = {
  SERIES_COLORS,
  buildChartJsDatasets,
  buildAvailableSeriesMetadata,
  buildSeriesMetadata,
  buildSeriesStyleMap,
  buildTimeRange,
  compileChartJsCartesian,
  getDomain,
  getAvailableCatalog,
  getSeriesStyle,
  getStableColor,
};
