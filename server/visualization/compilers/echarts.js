const moment = require("moment-timezone");

const { toJsonValue } = require("../preparedData");
const { createRenderContext } = require("../renderContext");
const {
  RESPONSIVE_LAYOUT,
  getBarLimitedMaxWidth,
  getLineLimitedMaxWidth,
} = require("../responsiveLayout");
const { createSeriesId, serializeTypedValue } = require("../seriesIdentity");
const { projectPreparedSeries } = require("../seriesProjection");
const { applyValueFormula, parseValueFormula } = require("../valueFormula");
const {
  buildCategoryMetadata,
} = require("./chartJsCategory");
const {
  buildSeriesStyleMap,
  getStableColor,
} = require("./chartJsCartesian");

const CARTESIAN_PRESETS = new Set(["area", "bar", "line"]);
const PIE_PRESETS = new Set(["doughnut", "pie"]);
const CENTRAL_VALUE_FONT = "Inter Tight, sans-serif";
const MATRIX_CELL_GAP = 3;
const MATRIX_GRID_INSET = Object.freeze({
  bottom: 24,
  left: 8,
  right: 40,
  top: 12,
});

function getMatrixCellLayout(width, height, columnCount, rowCount) {
  const columns = Math.max(1, columnCount);
  const rows = Math.max(1, rowCount);
  const availableWidth = Math.max(1, Number(width) - MATRIX_GRID_INSET.left - MATRIX_GRID_INSET.right);
  const availableHeight = Math.max(1, Number(height) - MATRIX_GRID_INSET.top - MATRIX_GRID_INSET.bottom);
  const cellSize = Math.max(1, Math.floor(Math.min(availableWidth / columns, availableHeight / rows)));
  const gridWidth = cellSize * columns;
  const gridHeight = cellSize * rows;
  return {
    cellSize,
    gap: MATRIX_CELL_GAP,
    grid: {
      containLabel: false,
      height: gridHeight,
      left: MATRIX_GRID_INSET.left + Math.floor(Math.max(0, availableWidth - gridWidth) / 2),
      top: MATRIX_GRID_INSET.top + Math.floor(Math.max(0, availableHeight - gridHeight) / 2),
      width: gridWidth,
    },
    symbolSize: Math.max(1, cellSize - MATRIX_CELL_GAP),
  };
}

function getLayer(visualization, layerId) {
  return visualization.layers.find((layer) => `${layer.id}` === `${layerId}`) || {};
}

function getLegend(visualization, position = "top") {
  return {
    show: visualization.settings?.legend?.visible !== false,
    type: "scroll",
    [position]: 0,
    textStyle: { fontSize: 11 },
  };
}

function getBaseOption(visualization, renderContext, trigger = "axis") {
  const dark = renderContext.theme === "dark";
  return {
    animation: !renderContext.reducedMotion,
    aria: {
      decal: { show: false },
      enabled: true,
    },
    backgroundColor: "transparent",
    legend: getLegend(visualization),
    textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    tooltip: {
      backgroundColor: dark ? "#18181b" : "#ffffff",
      borderColor: dark ? "#3f3f46" : "#e4e4e7",
      borderWidth: 1,
      confine: true,
      enterable: false,
      extraCssText: "border-radius: 8px; box-shadow: 0 6px 18px rgba(17, 24, 39, 0.12);",
      padding: [7, 9],
      textStyle: {
        color: dark ? "#e4e4e7" : "#3f3f46",
        fontSize: 11,
        fontWeight: 400,
      },
      trigger,
    },
  };
}

function getLayerSeriesStyle(styles, series, layer) {
  const style = styles.get(series.id) || {};
  const pointRadius = style.pointRadius ?? layer.style?.pointRadius;
  return {
    areaStyle: layer.mark === "area" || style.fill
      ? { color: style.fillColor || style.datasetColor, opacity: style.fillOpacity ?? 0.2 }
      : undefined,
    color: style.datasetColor || getStableColor(series.id),
    name: style.legend || series.label,
    pointRadius,
  };
}

function buildMarkLine(series, horizontal) {
  if (series.goal === null || series.goal === undefined || series.goal === "") return undefined;
  const value = Number(series.goal);
  if (!Number.isFinite(value)) return undefined;
  return {
    data: [{
      [horizontal ? "xAxis" : "yAxis"]: value,
      name: "Goal",
    }],
    label: { formatter: "Goal: {c}" },
    silent: true,
    symbol: "none",
  };
}

function getLineSeriesMedia(series, showSymbol) {
  return series.map((item) => ({
    label: { show: false },
    markLine: item.markLine ? { label: { show: false } } : undefined,
    showSymbol,
    symbolSize: showSymbol ? item.symbolSize : 0,
  }));
}

function getBarSeriesMedia(series, showLabel) {
  return series.map((item) => ({
    label: { show: showLabel },
    markLine: item.markLine ? { label: { show: false } } : undefined,
  }));
}

function buildCartesianResponsiveMedia(option, pointCount, {
  getLimitedMaxWidth,
  limitedTickCount,
  seriesMedia,
}) {
  const { geometry } = RESPONSIVE_LAYOUT;
  const seriesCount = option.series.length;
  const limitedMaxWidth = getLimitedMaxWidth(pointCount, seriesCount);
  const limitedLegend = option.legend?.show !== false;
  const limitedInterval = Math.max(0, Math.ceil(pointCount / limitedTickCount) - 1);
  const limited = {
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 8,
      top: limitedLegend ? 32 : 12,
    },
    legend: { show: limitedLegend },
    series: seriesMedia(option.series, "limited"),
    xAxis: {
      axisLabel: {
        fontSize: 10,
        hideOverlap: true,
        interval: limitedInterval,
        margin: 6,
        showMaxLabel: true,
        showMinLabel: true,
      },
      axisTick: { show: false },
    },
    yAxis: {
      axisLabel: { fontSize: 10, margin: 6 },
      axisTick: { show: false },
      splitLine: { lineStyle: { opacity: 0.28 }, show: true },
    },
  };
  const sparkline = {
    grid: { bottom: 6, containLabel: false, left: 6, right: 6, top: 6 },
    legend: { show: false },
    series: seriesMedia(option.series, "sparkline"),
    xAxis: {
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      show: false,
      splitLine: { show: false },
    },
    yAxis: {
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      show: false,
      splitLine: { show: false },
    },
  };
  const media = [{
    option: limited,
    query: {
      maxWidth: geometry.width.regularMax,
      minHeight: geometry.height.shallowMax + 1,
      minWidth: geometry.width.narrowMax + 1,
    },
  }];

  if (limitedMaxWidth > geometry.width.regularMax) {
    media.push({
      option: limited,
      query: {
        maxWidth: limitedMaxWidth,
        minHeight: geometry.height.shallowMax + 1,
        minWidth: geometry.width.regularMax + 1,
      },
    });
  }

  media.push({
    option: sparkline,
    query: { maxWidth: geometry.width.narrowMax },
  }, {
    option: sparkline,
    query: {
      maxHeight: geometry.height.shallowMax,
      minWidth: geometry.width.narrowMax + 1,
    },
  });

  return media;
}

function buildLineResponsiveMedia(option, pointCount) {
  return buildCartesianResponsiveMedia(option, pointCount, {
    getLimitedMaxWidth: getLineLimitedMaxWidth,
    limitedTickCount: RESPONSIVE_LAYOUT.presets.line.limitedTickCount,
    seriesMedia: (series) => getLineSeriesMedia(series, false),
  });
}

function buildVerticalBarResponsiveMedia(option, pointCount) {
  return buildCartesianResponsiveMedia(option, pointCount, {
    getLimitedMaxWidth: getBarLimitedMaxWidth,
    limitedTickCount: RESPONSIVE_LAYOUT.presets.bar.limitedTickCount,
    seriesMedia: (series) => getBarSeriesMedia(series, false),
  });
}

function buildCartesianOption({ preparedData, visualization, renderContext }) {
  const projection = projectPreparedSeries({
    chart: {},
    preparedData,
    runtimeContext: null,
    timezone: renderContext.timezone || preparedData.timezone,
    visualization,
  });
  const styles = buildSeriesStyleMap(preparedData, visualization);
  const dimensions = ["category", ...projection.series.map((series) => series.id)];
  const source = projection.labels.map((label, index) => [
    label,
    ...projection.series.map((series) => series.values[index] ?? null),
  ]);
  const horizontal = visualization.layers.some((layer) => layer.orientation === "horizontal");
  const option = {
    ...getBaseOption(visualization, renderContext),
    dataset: { dimensions, source },
    grid: { containLabel: true, left: 16, right: 18, top: 42, bottom: 16 },
    series: projection.series.map((series) => {
      const layer = getLayer(visualization, series.layerId);
      const style = getLayerSeriesStyle(styles, series, layer);
      const mark = series.mark === "area" ? "line" : series.mark;
      const formula = parseValueFormula(layer.encoding?.value?.formula);
      return {
        areaStyle: style.areaStyle,
        connectNulls: visualization.settings?.missingValues?.policy === "zero",
        encode: horizontal
          ? { itemName: "category", x: series.id, y: "category" }
          : { itemName: "category", x: "category", y: series.id },
        emphasis: { focus: "series" },
        id: series.id,
        itemStyle: mark === "bar"
          ? {
            borderColor: style.color,
            borderRadius: 3,
            borderWidth: 1.5,
            color: style.color,
          }
          : { color: style.color },
        label: {
          formatter: `${formula.prefix}{@${series.id}}${formula.suffix}`,
          position: mark === "bar" ? "inside" : "top",
          show: Boolean(visualization.settings?.dataLabels),
        },
        lineStyle: { color: style.color, width: 2 },
        markLine: buildMarkLine(series, horizontal),
        name: style.name,
        showSymbol: Number(style.pointRadius) > 0,
        smooth: Boolean(layer.style?.smooth),
        stack: layer.stack && layer.stack !== "none" ? `stack-${layer.stack}` : undefined,
        symbolSize: Number(style.pointRadius) > 0 ? Number(style.pointRadius) * 2 : 6,
        type: mark,
      };
    }),
    xAxis: horizontal
      ? {
        axisLabel: { fontSize: 10, hideOverlap: true, margin: 8 },
        axisTick: { show: false },
        type: visualization.settings?.isLogarithmic || visualization.settings?.logarithmic ? "log" : "value",
      }
      : {
        axisLabel: { fontSize: 10, hideOverlap: true, margin: 8 },
        axisTick: { show: false },
        type: "category",
      },
    yAxis: horizontal
      ? {
        axisLabel: { fontSize: 10, hideOverlap: true, margin: 8 },
        axisTick: { show: false },
        inverse: true,
        type: "category",
      }
      : {
        axisLabel: { fontSize: 10, margin: 8 },
        axisTick: { show: false },
        type: visualization.settings?.isLogarithmic || visualization.settings?.logarithmic ? "log" : "value",
      },
  };

  if (!horizontal) {
    if (visualization.settings?.minValue !== null
      && visualization.settings?.minValue !== undefined
      && Number.isFinite(Number(visualization.settings.minValue))) {
      option.yAxis.min = Number(visualization.settings.minValue);
    }
    if (visualization.settings?.maxValue !== null
      && visualization.settings?.maxValue !== undefined
      && Number.isFinite(Number(visualization.settings.maxValue))) {
      option.yAxis.max = Number(visualization.settings.maxValue);
    }
  }

  return option;
}

function buildPieOption({ preparedData, visualization, renderContext }, presetId) {
  const domain = new Map();
  preparedData.results.forEach((result) => {
    result.rows.forEach((row) => {
      const key = serializeTypedValue(row.category);
      if (!domain.has(key)) domain.set(key, row.category);
    });
  });
  const categoryMetadata = buildCategoryMetadata(preparedData, visualization, domain);
  const metadataById = new Map(categoryMetadata.map((category) => [category.id, category]));
  const datasets = [];
  const series = [];

  preparedData.results.forEach((result) => {
    const layer = getLayer(visualization, result.id);
    const formula = parseValueFormula(layer.encoding?.value?.formula);
    const defaultSeries = result.series[0] || { id: `series-${result.id}`, label: result.name };
    const source = result.rows.map((row) => {
      const id = createSeriesId(result.id, row.category);
      return {
        category: row.category,
        id,
        value: applyValueFormula(row.value, layer.encoding?.value?.formula),
      };
    });
    const datasetIndex = datasets.length;
    datasets.push({ dimensions: ["id", "category", "value"], source });
    series.push({
      colorBy: "data",
      datasetIndex,
      encode: {
        itemId: "id",
        itemName: "category",
        tooltip: ["category", "value"],
        value: "value",
      },
      id: defaultSeries.id,
      itemStyle: presetId === "doughnut" ? { borderRadius: 6 } : undefined,
      label: {
        formatter: visualization.settings?.dataLabelsFormat === "value"
          ? `${formula.prefix}{@value}${formula.suffix}`
          : "{d}%",
        backgroundColor: "rgba(24, 24, 27, 0.28)",
        borderRadius: 3,
        color: "#ffffff",
        fontSize: 10,
        padding: [2, 4],
        position: "inside",
        show: Boolean(visualization.settings?.dataLabels),
      },
      labelLine: { show: false },
      name: layer.name || defaultSeries.label,
      padAngle: presetId === "doughnut" ? 2 : 0,
      radius: presetId === "doughnut" ? ["46%", "70%"] : "70%",
      type: "pie",
      ...(presetId === "doughnut" ? { center: ["50%", "50%"] } : {}),
    });
  });

  const total = datasets.flatMap((dataset) => dataset.source)
    .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  const firstLayer = getLayer(visualization, preparedData.results[0]?.id);
  const totalFormula = parseValueFormula(firstLayer.encoding?.value?.formula);
  return {
    ...getBaseOption(visualization, renderContext, "item"),
    color: categoryMetadata.map((category) => metadataById.get(category.id).color),
    dataset: datasets,
    series,
    title: presetId === "doughnut" ? {
      left: "50%",
      padding: 0,
      text: `{label|Total}\n{value|${totalFormula.prefix}${total.toLocaleString(renderContext.locale)}${totalFormula.suffix}}`,
      textAlign: "center",
      textVerticalAlign: "middle",
      textStyle: {
        fontWeight: 400,
        rich: {
          label: { fontSize: 10, fontWeight: 400, lineHeight: 15 },
          value: {
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 31,
          },
          percent: {
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 16,
          },
        },
      },
      top: "50%",
    } : undefined,
  };
}

function buildRadarOption({ preparedData, visualization, renderContext }) {
  const projection = projectPreparedSeries({
    chart: {},
    preparedData,
    runtimeContext: null,
    timezone: renderContext.timezone || preparedData.timezone,
    visualization,
  });
  const styles = buildSeriesStyleMap(preparedData, visualization);
  const maxima = projection.labels.map((label, index) => {
    const values = projection.series.map((series) => Number(series.values[index]))
      .filter(Number.isFinite);
    return { max: Math.max(1, ...values), name: `${label}` };
  });
  return {
    ...getBaseOption(visualization, renderContext, "item"),
    radar: { indicator: maxima, radius: "66%" },
    series: projection.series.map((series) => {
      const layer = getLayer(visualization, series.layerId);
      const style = getLayerSeriesStyle(styles, series, layer);
      return {
        areaStyle: layer.style?.fill ? { color: style.color, opacity: layer.style?.fillOpacity ?? 0.15 } : undefined,
        data: [{ id: series.id, name: style.name, value: series.values }],
        id: series.id,
        itemStyle: { color: style.color },
        lineStyle: { color: style.color },
        name: style.name,
        type: "radar",
      };
    }),
  };
}

function buildPolarOption({ preparedData, visualization, renderContext }) {
  const projection = projectPreparedSeries({
    chart: {},
    preparedData,
    runtimeContext: null,
    timezone: renderContext.timezone || preparedData.timezone,
    visualization,
  });
  const styles = buildSeriesStyleMap(preparedData, visualization);
  return {
    ...getBaseOption(visualization, renderContext),
    angleAxis: { data: projection.labels, type: "category" },
    dataset: {
      dimensions: ["category", ...projection.series.map((series) => series.id)],
      source: projection.labels.map((label, index) => [
        label,
        ...projection.series.map((series) => series.values[index] ?? null),
      ]),
    },
    polar: { radius: "70%" },
    radiusAxis: { type: "value" },
    series: projection.series.map((series) => {
      const layer = getLayer(visualization, series.layerId);
      const style = getLayerSeriesStyle(styles, series, layer);
      return {
        coordinateSystem: "polar",
        encode: { angle: "category", radius: series.id },
        id: series.id,
        itemStyle: { color: style.color },
        name: style.name,
        roundCap: true,
        type: "bar",
      };
    }),
  };
}

function parseMatrixDate(value, timezone) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = moment.utc(value);
  if (!parsed.isValid()) return null;
  return timezone ? parsed.tz(timezone) : parsed;
}

function getMatrixDateRange(rows, visualization, timezone) {
  const dates = rows.map((row) => parseMatrixDate(row.time, timezone)).filter(Boolean);
  const configuredStart = parseMatrixDate(visualization.settings?.dateWindow?.start, timezone);
  const configuredEnd = parseMatrixDate(visualization.settings?.dateWindow?.end, timezone);
  const sorted = dates.sort((left, right) => left.valueOf() - right.valueOf());
  const start = configuredStart || sorted[0];
  const end = configuredEnd || sorted[sorted.length - 1];
  if (!start || !end) return null;
  return {
    end: moment.max(start, end).clone().endOf("day"),
    start: moment.min(start, end).clone().startOf("day"),
  };
}

function buildMatrixSource(result, layer, visualization, timezone) {
  const rows = result.rows || [];
  const valuesByDate = new Map();
  rows.forEach((row) => {
    const date = parseMatrixDate(row.time, timezone);
    if (!date) return;
    const value = Number(applyValueFormula(row.value, layer.encoding?.value?.formula));
    valuesByDate.set(date.format("YYYY-MM-DD"), Number.isFinite(value) ? value : 0);
  });
  const range = getMatrixDateRange(rows, visualization, timezone);
  if (!range) return { source: [], weekLabels: [] };

  const firstWeek = range.start.clone().startOf("isoWeek");
  const weekLabels = [];
  const source = [];
  const current = range.start.clone();
  while (current.isSameOrBefore(range.end, "day")) {
    const date = current.format("YYYY-MM-DD");
    const weekIndex = current.clone().startOf("isoWeek").diff(firstWeek, "weeks");
    if (!weekLabels[weekIndex]) {
      weekLabels[weekIndex] = current.clone().startOf("isoWeek").format("MMM DD");
    }
    source.push({
      date: current.format("MMM D, YYYY"),
      day: current.isoWeekday() - 1,
      value: valuesByDate.get(date) || 0,
      week: weekIndex,
    });
    current.add(1, "day");
  }
  return { source, weekLabels };
}

function applyColorOpacity(color, opacity) {
  const match = typeof color === "string" && color.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
  if (!match) return color;
  const hex = match[1].length === 3
    ? match[1].split("").map((character) => `${character}${character}`).join("")
    : match[1];
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${alpha}`;
}

function buildCategoricalMatrixSource(result, layer) {
  const columns = new Map();
  const rows = new Map();
  let max = 1;
  const source = (result.rows || []).map((row) => {
    const column = row.column ?? row.category ?? "Value";
    const rowValue = row.row ?? result.name ?? "Value";
    const columnKey = serializeTypedValue(column);
    const rowKey = serializeTypedValue(rowValue);
    if (!columns.has(columnKey)) columns.set(columnKey, columns.size);
    if (!rows.has(rowKey)) rows.set(rowKey, rows.size);
    const value = Number(applyValueFormula(row.value, layer.encoding?.value?.formula));
    if (Number.isFinite(value)) max = Math.max(max, value);
    return {
      column: columns.get(columnKey),
      columnLabel: column,
      row: rows.get(rowKey),
      rowLabel: rowValue,
      value: Number.isFinite(value) ? value : 0,
    };
  });
  return {
    columnLabels: [...columns.keys()].map((key) => result.rows.find((row) => {
      return serializeTypedValue(row.column ?? row.category ?? "Value") === key;
    })?.column ?? result.rows.find((row) => {
      return serializeTypedValue(row.column ?? row.category ?? "Value") === key;
    })?.category ?? "Value"),
    max,
    rowLabels: [...rows.keys()].map((key) => result.rows.find((row) => {
      return serializeTypedValue(row.row ?? result.name ?? "Value") === key;
    })?.row ?? result.name ?? "Value"),
    source,
  };
}

function buildMatrixOption({ preparedData, visualization, renderContext }) {
  const result = preparedData.results[0];
  const layer = getLayer(visualization, result.id);
  const seriesDefinition = result.series[0] || { id: `series-${result.id}`, label: result.name };
  const style = buildSeriesStyleMap(preparedData, visualization).get(seriesDefinition.id) || {};
  const isCalendar = (result.fields || []).some((field) => field.key === "time");
  const matrix = isCalendar
    ? buildMatrixSource(
      result,
      layer,
      visualization,
      renderContext.timezone || preparedData.timezone
    )
    : buildCategoricalMatrixSource(result, layer);
  const { source } = matrix;
  const values = source.map((row) => row.value);
  const max = matrix.max || (values.length > 0 ? Math.max(1, ...values) : 1);
  const color = style.datasetColor || getStableColor(seriesDefinition.id);
  const xDimension = isCalendar ? "week" : "column";
  const yDimension = isCalendar ? "day" : "row";
  const tooltipDimensions = isCalendar
    ? ["date", "value"]
    : ["columnLabel", "rowLabel", "value"];
  const columnCount = (isCalendar ? matrix.weekLabels : matrix.columnLabels)?.length || 1;
  const rowCount = isCalendar ? 7 : (matrix.rowLabels?.length || 1);
  const layout = getMatrixCellLayout(renderContext.width, renderContext.height, columnCount, rowCount);
  return {
    ...getBaseOption(visualization, renderContext, "item"),
    dataset: [{
      dimensions: isCalendar
        ? ["week", "day", "value", "date"]
        : ["column", "row", "value", "columnLabel", "rowLabel"],
      source,
    }],
    grid: layout.grid,
    legend: { show: false },
    series: [{
      datasetIndex: 0,
      emphasis: { scale: false },
      encode: {
        itemName: isCalendar ? "date" : ["columnLabel", "rowLabel"],
        tooltip: tooltipDimensions,
        value: "value",
        x: xDimension,
        y: yDimension,
      },
      id: seriesDefinition.id,
      itemStyle: { borderWidth: 0 },
      label: { show: false },
      name: result.name || seriesDefinition.label,
      symbol: "roundRect",
      symbolKeepAspect: true,
      symbolSize: layout.symbolSize,
      type: "scatter",
    }],
    visualMap: {
      dimension: 2,
      inRange: {
        color: [
          applyColorOpacity(color, 0.08),
          applyColorOpacity(color, 0.32),
          applyColorOpacity(color, 0.6),
          color,
        ],
      },
      max,
      min: 0,
      show: false,
    },
    xAxis: {
      axisLabel: { fontSize: 10, hideOverlap: true, interval: "auto", margin: 8 },
      axisLine: { show: false },
      axisTick: { show: false },
      boundaryGap: true,
      data: isCalendar ? matrix.weekLabels : matrix.columnLabels,
      splitArea: { show: false },
      splitLine: { show: false },
      type: "category",
    },
    yAxis: {
      axisLabel: { fontSize: 10, interval: 0, margin: 8 },
      axisLine: { show: false },
      axisTick: { show: false },
      boundaryGap: true,
      data: isCalendar
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : matrix.rowLabels,
      inverse: isCalendar,
      position: "right",
      splitArea: { show: false },
      splitLine: { show: false },
      type: "category",
    },
  };
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(`${value}`.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildGaugeOption({ chart, preparedData, visualization, renderContext }) {
  const result = preparedData.results[0];
  const seriesDefinition = result?.series?.[0] || { id: `series-${result?.id || "gauge"}` };
  const projection = projectPreparedSeries({
    chart: {},
    preparedData,
    runtimeContext: null,
    timezone: renderContext.timezone || preparedData.timezone,
    visualization,
  });
  const projectedValues = projection.series[0]?.values || [];
  const value = toNumber(projectedValues[projectedValues.length - 1]);
  const layer = getLayer(visualization, result?.id);
  const formula = parseValueFormula(layer.encoding?.value?.formula);
  const configuredRanges = Array.isArray(chart?.ranges) && chart.ranges.length > 0
    ? chart.ranges
    : visualization.settings?.ranges;
  const ranges = Array.isArray(configuredRanges) && configuredRanges.length > 0
    ? [...configuredRanges].sort((left, right) => Number(left.max) - Number(right.max))
    : [{ color: getStableColor(seriesDefinition.id), label: "Value", max: 100, min: 0 }];
  const min = Math.min(...ranges.map((range) => Number(range.min)));
  const max = Math.max(...ranges.map((range) => Number(range.max)));
  const rangeData = ranges.map((range) => ({
    itemStyle: {
      color: range.color || getStableColor(`${seriesDefinition.id}-${range.label}`),
    },
    name: range.label || `${range.min}-${range.max}`,
    value: Math.max(0, Number(range.max) - Number(range.min)),
  }));
  const label = seriesDefinition.label || result?.name || "Value";
  return {
    ...getBaseOption(visualization, renderContext, "item"),
    legend: { show: false },
    tooltip: { show: false },
    series: [{
      center: ["50%", "55%"],
      data: rangeData,
      endAngle: -45,
      emphasis: { label: { show: false }, scale: false },
      id: `${seriesDefinition.id}-ranges`,
      label: {
        show: false,
      },
      labelLine: { show: false },
      name: label,
      padAngle: 1,
      radius: ["70%", "90%"],
      startAngle: 225,
      tooltip: { show: true },
      type: "pie",
    }, {
      anchor: { show: false },
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      center: ["50%", "55%"],
      data: [{ id: seriesDefinition.id, name: label, value }],
      detail: {
        fontFamily: CENTRAL_VALUE_FONT,
        fontSize: 28,
        fontWeight: 700,
        formatter: `${formula.prefix}{value}${formula.suffix}`,
        offsetCenter: [0, "0%"],
      },
      endAngle: -45,
      id: seriesDefinition.id,
      max,
      min,
      name: label,
      pointer: {
        icon: "rect",
        length: "50%",
        offsetCenter: [0, "-50%"],
        showAbove: true,
        width: 5,
      },
      radius: "90%",
      splitLine: { show: false },
      startAngle: 225,
      title: { fontSize: 12, offsetCenter: [0, "22%"], show: true },
      tooltip: { show: false },
      type: "gauge",
      z: 10,
    }],
  };
}

function buildEChartsOption({ chart, preparedData, visualization, renderContext = {} }) {
  const context = createRenderContext({
    timezone: preparedData.timezone,
    ...renderContext,
  });
  const marks = [...new Set(preparedData.results.map((result) => result.mark))];
  if (marks.length !== 1) {
    throw new Error(`ECharts compiler requires one preset, received: ${marks.join(", ")}`);
  }
  const presetId = marks[0];
  let option;
  if (CARTESIAN_PRESETS.has(presetId)) {
    option = buildCartesianOption({ preparedData, visualization, renderContext: context });
  } else if (PIE_PRESETS.has(presetId)) {
    option = buildPieOption({ preparedData, visualization, renderContext: context }, presetId);
  } else if (presetId === "radar") {
    option = buildRadarOption({ preparedData, visualization, renderContext: context });
  } else if (presetId === "polar") {
    option = buildPolarOption({ preparedData, visualization, renderContext: context });
  } else if (presetId === "matrix") {
    option = buildMatrixOption({ preparedData, visualization, renderContext: context });
  } else if (presetId === "gauge") {
    option = buildGaugeOption({ chart, preparedData, visualization, renderContext: context });
  } else {
    throw new Error(`ECharts compiler is not implemented for: ${presetId}`);
  }

  const compactGaugeSeries = [{
    center: ["50%", "52%"],
    label: { show: false },
    radius: ["70%", "90%"],
  }, {
    center: ["50%", "52%"],
    detail: { fontSize: 18, offsetCenter: [0, "5%"] },
    pointer: {
      icon: "rect",
      length: "50%",
      offsetCenter: [0, "-50%"],
      showAbove: true,
      width: 4,
    },
    radius: "90%",
    title: { show: false },
  }];
  const sideGaugeSeries = [{
    center: ["72%", "52%"],
    label: { show: false },
    radius: ["72%", "92%"],
  }, {
    center: ["72%", "52%"],
    detail: { show: false },
    pointer: {
      icon: "rect",
      length: "50%",
      offsetCenter: [0, "-50%"],
      showAbove: true,
      width: 4,
    },
    radius: "92%",
    title: { show: false },
  }];
  const compactGaugeTitle = presetId === "gauge" ? {
    itemGap: 4,
    left: "10%",
    show: true,
    subtext: option.series[1].data[0].name,
    subtextStyle: { fontSize: 14, fontWeight: 400, lineHeight: 22 },
    text: `${option.series[1].detail.formatter}`.replace("{value}", option.series[1].data[0].value),
    textAlign: "left",
    textStyle: { fontFamily: CENTRAL_VALUE_FONT, fontSize: 28, fontWeight: 700 },
    top: "34%",
  } : undefined;
  const compactGrid = { containLabel: true, left: 8, right: 8, top: 12, bottom: 8 };
  if (presetId === "line") {
    option.media = buildLineResponsiveMedia(option, option.dataset.source.length);
  } else if (presetId === "bar" && option.xAxis?.type === "category") {
    option.media = buildVerticalBarResponsiveMedia(option, option.dataset.source.length);
  } else if (presetId === "gauge") {
    option.media = [{
      option: {
        grid: compactGrid,
        legend: { show: false },
        series: sideGaugeSeries,
        title: compactGaugeTitle,
      },
      query: { maxHeight: 160, minWidth: 420 },
    }, {
      option: {
        grid: compactGrid,
        legend: { show: false },
        series: compactGaugeSeries,
        title: { show: false },
      },
      query: { maxWidth: 320 },
    }];
  } else if (presetId === "doughnut") {
    const tightTitle = {
      text: `${option.title?.text || ""}`.match(/\{value\|[^}]+\}/)?.[0] || option.title?.text,
      textStyle: {
        fontWeight: 400,
        rich: {
          value: {
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 20,
          },
          percent: {
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 12,
          },
        },
      },
    };
    const tightDoughnut = {
      legend: { show: false },
      series: option.series.map(() => ({ label: { show: false } })),
      title: tightTitle,
    };
    option.media = [{
      option: tightDoughnut,
      query: { maxHeight: 220 },
    }, {
      option: tightDoughnut,
      query: { maxWidth: 320 },
    }];
  } else if (presetId !== "matrix") {
    option.media = [{
      option: {
        grid: compactGrid,
        legend: { show: false },
      },
      query: { maxHeight: 220 },
    }, {
      option: {
        grid: compactGrid,
        legend: { show: false },
      },
      query: { maxWidth: 320 },
    }];
  }

  return toJsonValue(option);
}

module.exports = {
  buildCartesianOption,
  buildEChartsOption,
  buildGaugeOption,
  buildMatrixOption,
  buildPieOption,
  buildPolarOption,
  buildRadarOption,
};
