const BarChart = require("../../charts/BarChart");
const LineChart = require("../../charts/LineChart");
const { chartColors } = require("../../charts/colors");
const { buildChartMetrics } = require("../metrics");
const { serializeTypedValue } = require("../seriesIdentity");
const { expandTimeValues, formatTimeValues } = require("../time");
const { applyValueFormula } = require("../valueFormula");

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

function getDimensionRole(layer) {
  if (layer.fields.time) return "time";
  return "category";
}

function getDomain(frame) {
  const domain = new Map();

  frame.layers.forEach((layerFrame) => {
    const role = getDimensionRole(layerFrame);

    layerFrame.rows.forEach((row) => {
      const value = row[role];
      const key = serializeTypedValue(value);
      if (!domain.has(key)) domain.set(key, value);
    });
  });

  return domain;
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

function getAvailableCatalog(layerFrame) {
  const visible = layerFrame.series || [];
  const visibleIds = new Set(visible.map((series) => series.id));
  return [
    ...visible,
    ...(layerFrame.availableSeries || []).filter((series) => !visibleIds.has(series.id)),
  ];
}

function buildSeriesStyleMap(frame, visualization) {
  const entries = frame.layers.flatMap((layerFrame) => {
    const layer = visualization.layers.find((item) => item.id === layerFrame.id);
    return getAvailableCatalog(layerFrame)
      .map((series) => ({ layer, layerFrame, series }));
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

function buildSeriesMetadata(frame, visualization) {
  const styles = buildSeriesStyleMap(frame, visualization);
  return frame.layers.flatMap((layerFrame) => {
    const layer = visualization.layers.find((item) => item.id === layerFrame.id);
    return layerFrame.series.map((series) => {
      const style = styles.get(series.id);
      return {
        ...series,
        bindingId: layerFrame.bindingId,
        color: style.datasetColor,
        fillColor: style.fillColor,
        layerId: layerFrame.id,
        layerName: layer?.name || null,
      };
    });
  });
}

function buildAvailableSeriesMetadata(frame, visualization) {
  const styles = buildSeriesStyleMap(frame, visualization);
  return frame.layers.flatMap((layerFrame) => {
    const layer = visualization.layers.find((item) => item.id === layerFrame.id);
    return getAvailableCatalog(layerFrame).map((series) => {
      const style = styles.get(series.id);
      return {
        ...series,
        bindingId: layerFrame.bindingId,
        color: style.datasetColor,
        fillColor: style.fillColor,
        layerId: layerFrame.id,
        layerName: layer?.name || null,
      };
    });
  });
}

function buildChartJsDatasets(frame, spec, domain, missingValue) {
  const datasets = [];
  const configs = [];
  const styles = buildSeriesStyleMap(frame, spec);

  frame.layers.forEach((layerFrame) => {
    const layer = spec.layers.find((item) => item.id === layerFrame.id);
    const dimensionRole = getDimensionRole(layerFrame);
    const valuesBySeries = new Map();

    layerFrame.rows.forEach((row) => {
      if (!valuesBySeries.has(row.__seriesId)) {
        valuesBySeries.set(row.__seriesId, new Map());
      }
      valuesBySeries.get(row.__seriesId).set(
        serializeTypedValue(row[dimensionRole]),
        row.value
      );
    });

    layerFrame.series.forEach((series) => {
      const valuesByDimension = valuesBySeries.get(series.id) || new Map();
      const isCumulative = layer.transforms.some((transform) => {
        return transform.type === "window" && transform.operation === "cumulativeSum";
      });

      const style = styles.get(series.id);
      let cumulativeValue = 0;
      datasets.push([...domain.keys()].map((key) => {
        if (!valuesByDimension.has(key) && !isCumulative) return missingValue;
        if (valuesByDimension.has(key)) cumulativeValue = valuesByDimension.get(key);
        return applyValueFormula(
          cumulativeValue,
          layer.encoding.value?.formula,
          { formatted: ["kpi", "avg", "gauge"].includes(layer.mark) }
        );
      }));
      configs.push({
        ...style,
        formula: layer.encoding.value?.formula || null,
        goal: layer.encoding.breakdown ? null : layer.goal ?? null,
        id: series.id,
        layerId: layer.id,
      });
    });
  });

  return { configs, datasets };
}

function compileChartJsCartesian({ chart, frame, runtimeContext, timezone, visualization }) {
  const marks = [...new Set(frame.layers.map((layer) => layer.mark))];
  if (marks.length !== 1 || !["bar", "line"].includes(marks[0])) {
    throw new Error("Cartesian Chart.js compiler requires uniform bar or line layers");
  }

  let domain = getDomain(frame);
  const timeLayer = frame.layers.find((layer) => layer.fields.time);
  if (timeLayer) {
    const timeEncoding = visualization.layers.find((layer) => layer.id === timeLayer.id)?.encoding.time;
    const timeUnit = timeEncoding?.timeUnit
      || visualization.settings?.timeInterval
      || chart.timeInterval
      || "day";
    const includeZeros = visualization.settings?.includeZeros ?? chart.includeZeros;
    const canExpand = !["minute", "second"].includes(timeUnit);
    if (includeZeros && canExpand) {
      const expanded = expandTimeValues(
        [...domain.values()],
        timeUnit,
        timezone,
        runtimeContext?.effectiveDateRange || visualization.settings?.dateWindow || {}
      );
      domain = new Map(expanded.map((value) => [serializeTypedValue(value), value]));
    } else {
      domain = new Map([...domain.entries()].sort((left, right) => left[1] - right[1]));
    }
  }
  const missingPolicy = visualization.settings?.missingValues?.policy || "preserve";
  const missingValue = missingPolicy === "zero" ? 0 : null;
  const compiled = buildChartJsDatasets(frame, visualization, domain, missingValue);
  const mark = marks[0];
  const chartWithSeries = {
    ...chart,
    ChartDatasetConfigs: compiled.configs,
    displayLegend: visualization.settings?.legend?.visible ?? chart.displayLegend ?? true,
    horizontal: visualization.layers.some((layer) => layer.orientation === "horizontal"),
    stacked: visualization.layers.some((layer) => layer.stack !== "none"),
    type: mark,
  };
  const domainValues = [...domain.values()];
  const formattedTime = timeLayer
    ? formatTimeValues(
      domainValues,
      visualization.layers.find((layer) => layer.id === timeLayer.id)?.encoding.time?.timeUnit
        || visualization.settings?.timeInterval
        || chart.timeInterval
        || "day",
      timezone
    )
    : null;
  const axisData = {
    x: formattedTime?.labels || domainValues,
    y: compiled.datasets,
  };
  const compiler = mark === "bar"
    ? new BarChart(chartWithSeries, compiled.configs, axisData)
    : new LineChart(chartWithSeries, compiled.configs, axisData);
  const configuration = compiler.getConfiguration();
  buildChartMetrics(configuration, compiled.configs, chartWithSeries);

  configuration.meta = {
    availableSeries: buildAvailableSeriesMetadata(frame, visualization),
    frameVersion: frame.version,
    series: buildSeriesMetadata(frame, visualization),
    visualizationVersion: visualization.version,
    warnings: frame.warnings,
  };

  return {
    conditionsOptions: [],
    configuration,
    frame,
    isTimeseries: visualization.layers.some((layer) => Boolean(layer.encoding.time)),
    dateFormat: formattedTime?.format || "",
  };
}

module.exports = {
  SERIES_COLORS,
  buildChartJsDatasets,
  buildAvailableSeriesMetadata,
  buildSeriesMetadata,
  buildSeriesStyleMap,
  compileChartJsCartesian,
  getDomain,
  getAvailableCatalog,
  getSeriesStyle,
  getStableColor,
};
