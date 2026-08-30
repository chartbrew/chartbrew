const moment = require("moment-timezone");

const { toJsonValue } = require("../preparedData");
const { createRenderContext } = require("../renderContext");
const {
  RESPONSIVE_LAYOUT,
  getBarLimitedMaxWidth,
  getLineLimitedMaxWidth,
  resolveCategoryComposition,
  resolveMatrixComposition,
} = require("../responsiveLayout");
const { createSeriesId, serializeTypedValue } = require("../seriesIdentity");
const { projectPreparedSeries } = require("../seriesProjection");
const { applyValueFormula, parseValueFormula } = require("../valueFormula");
const { buildCategoryMetadata } = require("../renderMetadata");
const {
  buildSeriesStyleMap,
  getStableColor,
} = require("../seriesStyles");

const CARTESIAN_PRESETS = new Set(["bar", "horizontalBar", "line"]);
const PIE_PRESETS = new Set(["doughnut", "pie"]);
const CENTRAL_VALUE_FONT = "Inter Tight, sans-serif";
const DASHED_LAST_SERIES_SUFFIX = "--dashed-last";
const LATEST_POINT_SERIES_SUFFIX = "--latest-point";
const BAR_APPEARANCE = Object.freeze({
  horizontal: { borderRadius: 3, categoryGap: 38, maxWidth: 28 },
  vertical: { borderRadius: 3, categoryGap: 20, maxWidth: 48 },
});
const MATRIX_GRID_INSETS = Object.freeze({
  bounded: { bottom: 22, left: 6, right: 36, top: 10 },
  dense: { bottom: 6, left: 6, right: 6, top: 6 },
  labeled: { bottom: 24, left: 8, right: 40, top: 12 },
});

function getMatrixCellLayout(width, height, columnCount, rowCount, composition) {
  const columns = Math.max(1, columnCount);
  const rows = Math.max(1, rowCount);
  const inset = MATRIX_GRID_INSETS[composition];
  const availableWidth = Math.max(1, Number(width) - inset.left - inset.right);
  const availableHeight = Math.max(1, Number(height) - inset.top - inset.bottom);
  const cellSize = Math.max(1, Math.floor(Math.min(availableWidth / columns, availableHeight / rows)));
  const cellGap = Math.min(3, Math.max(1, Math.floor(cellSize * 0.12)));
  const gridWidth = cellSize * columns;
  const gridHeight = cellSize * rows;
  return {
    cellSize,
    gap: cellGap,
    grid: {
      containLabel: false,
      height: gridHeight,
      left: inset.left + Math.floor(Math.max(0, availableWidth - gridWidth) / 2),
      top: inset.top + Math.floor(Math.max(0, availableHeight - gridHeight) / 2),
      width: gridWidth,
    },
    symbolSize: Math.max(1, cellSize - cellGap),
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
    areaStyle: style.fill
      ? { color: style.fillColor || style.color, opacity: style.fillOpacity ?? 0.2 }
      : undefined,
    color: style.color || getStableColor(series.id),
    fill: ["bar", "horizontalBar"].includes(layer.mark)
      ? layer.style?.fill !== false
      : style.fill,
    fillOpacity: style.fillOpacity,
    name: style.label || series.label,
    pointRadius,
  };
}

function getHorizontalBarRadius(stacked, stackIndex, stackCount, radius) {
  if (!stacked || stackCount <= 1) return radius;
  const start = stackIndex === 0 ? radius : 0;
  const end = stackIndex === stackCount - 1 ? radius : 0;
  return [start, end, end, start];
}

function getXAxisLabelInterval(value, pointCount) {
  if (!value || value === "default") return undefined;
  if (value === "showAll") return 0;
  if (value === "half") return 1;
  if (value === "third") return 2;
  if (value === "fourth") return 3;
  const labelCount = Number.parseInt(value, 10);
  if (!Number.isInteger(labelCount) || labelCount < 1) return undefined;
  return Math.max(0, Math.ceil(pointCount / labelCount) - 1);
}

function buildMarkLine(series, horizontal, formula = {}, locale = "en") {
  if (series.goal === null || series.goal === undefined || series.goal === "") return undefined;
  const value = Number(series.goal);
  if (!Number.isFinite(value)) return undefined;
  const formatted = `${formula.prefix || ""}${value.toLocaleString(locale)}${formula.suffix || ""}`;
  const label = {
    backgroundColor: "rgba(24, 24, 27, 0.82)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 4,
    borderWidth: 1,
    color: "#fafafa",
    fontSize: 10,
    fontWeight: 700,
    formatter: formatted,
    padding: [2, 5],
    position: "insideEndTop",
  };
  return {
    data: [{
      [horizontal ? "xAxis" : "yAxis"]: value,
      label,
    }],
    label,
    silent: true,
    symbol: "none",
  };
}

function getLineSeriesMedia(series, showSymbol, hideGoalLabel = true) {
  return series.map((item) => {
    const latestPoint = item.id.endsWith(LATEST_POINT_SERIES_SUFFIX);
    let symbolSize = 0;
    if (latestPoint) symbolSize = Math.max(1, item.symbolSize || 0);
    else if (showSymbol) symbolSize = item.symbolSize;
    return {
      itemStyle: latestPoint ? { ...item.itemStyle, opacity: showSymbol ? 1 : 0 } : undefined,
      label: { show: false },
      ...(hideGoalLabel && item.markLine ? { markLine: { label: { show: false } } } : {}),
      showSymbol: latestPoint ? undefined : showSymbol,
      symbolSize,
    };
  });
}

function getBarSeriesMedia(series, showLabel, hideGoalLabel = true) {
  return series.map((item) => ({
    label: { show: showLabel },
    ...(hideGoalLabel && item.markLine ? { markLine: { label: { show: false } } } : {}),
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
  const configuredInterval = option.xAxis?.axisLabel?.interval;
  const limitedInterval = configuredInterval
    ?? Math.max(0, Math.ceil(pointCount / limitedTickCount) - 1);
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
    seriesMedia: (series, composition) => getLineSeriesMedia(series, false, composition === "sparkline"),
  });
}

function buildVerticalBarResponsiveMedia(option, pointCount) {
  return buildCartesianResponsiveMedia(option, pointCount, {
    getLimitedMaxWidth: getBarLimitedMaxWidth,
    limitedTickCount: RESPONSIVE_LAYOUT.presets.bar.limitedTickCount,
    seriesMedia: (series, composition) => getBarSeriesMedia(series, false, composition === "sparkline"),
  });
}

function buildHorizontalBarResponsiveMedia(option) {
  const { geometry } = RESPONSIVE_LAYOUT;
  const compact = {
    grid: {
      bottom: 4,
      containLabel: true,
      left: 2,
      right: 10,
      top: 18,
    },
    legend: { show: false },
    series: getBarSeriesMedia(option.series, false),
    xAxis: {
      axisLabel: { fontSize: 9, margin: 5, showMaxLabel: true, showMinLabel: true },
      axisTick: { show: false },
      position: "top",
      splitLine: { show: false },
    },
    yAxis: {
      axisLabel: { align: "left", fontSize: 9, margin: 76, overflow: "truncate", width: 68 },
      axisTick: { show: false },
    },
  };
  return [{
    option: compact,
    query: { maxWidth: geometry.width.narrowMax },
  }, {
    option: compact,
    query: {
      maxHeight: geometry.height.shallowMax,
      minWidth: geometry.width.narrowMax + 1,
    },
  }];
}

function getRadarSeriesMedia(series, compact) {
  return series.map(() => ({
    label: { show: false },
    symbol: compact ? "none" : "circle",
    symbolSize: compact ? 0 : 3,
  }));
}

function buildRadarResponsiveMedia(option) {
  const { geometry } = RESPONSIVE_LAYOUT;
  const compact = {
    legend: { show: false },
    radar: { axisName: { show: false }, radius: "80%", splitNumber: 3 },
    series: getRadarSeriesMedia(option.series, true),
  };
  const limited = {
    legend: { show: option.legend?.show !== false },
    radar: { axisName: { fontSize: 10 }, radius: "62%", splitNumber: 4 },
    series: getRadarSeriesMedia(option.series, false),
  };
  return [{
    option: limited,
    query: {
      maxHeight: geometry.height.regularMax,
      maxWidth: geometry.width.regularMax,
      minHeight: geometry.height.shallowMax + 1,
      minWidth: geometry.width.narrowMax + 1,
    },
  }, {
    option: compact,
    query: { maxWidth: geometry.width.narrowMax },
  }, {
    option: compact,
    query: {
      maxHeight: geometry.height.shallowMax,
      minWidth: geometry.width.narrowMax + 1,
    },
  }];
}

function getPolarSeriesMedia(series, showLabels) {
  return series.map(() => ({ label: { show: showLabels } }));
}

function buildPolarResponsiveMedia(option) {
  const { geometry } = RESPONSIVE_LAYOUT;
  const compact = {
    angleAxis: {
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    legend: { show: false },
    polar: { radius: "86%" },
    radiusAxis: {
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: getPolarSeriesMedia(option.series, false),
  };
  const limited = {
    angleAxis: { axisLabel: { fontSize: 10, hideOverlap: true } },
    legend: { show: option.legend?.show !== false },
    polar: { radius: "66%" },
    radiusAxis: { axisLabel: { fontSize: 9 } },
    series: getPolarSeriesMedia(option.series, false),
  };
  return [{
    option: limited,
    query: {
      maxHeight: geometry.height.regularMax,
      maxWidth: geometry.width.regularMax,
      minHeight: geometry.height.shallowMax + 1,
      minWidth: geometry.width.narrowMax + 1,
    },
  }, {
    option: compact,
    query: { maxWidth: geometry.width.narrowMax },
  }, {
    option: compact,
    query: {
      maxHeight: geometry.height.shallowMax,
      minWidth: geometry.width.narrowMax + 1,
    },
  }];
}

function getCategorySeriesMedia(series, composition) {
  const hideLabels = ["micro", "side-summary", "stacked-summary"].includes(composition);
  return series.map((item) => {
    const doughnut = Array.isArray(item.radius);
    let center = ["50%", "50%"];
    let radius = doughnut ? ["52%", "90%"] : "90%";
    if (composition === "side-summary") {
      center = ["73%", "50%"];
      radius = doughnut ? ["49%", "84%"] : "84%";
    } else if (composition === "side-breakdown") {
      center = ["75%", "50%"];
      radius = doughnut ? ["51%", "88%"] : "88%";
    } else if (composition === "stacked-summary") {
      center = ["50%", "69%"];
      radius = doughnut ? ["42%", "70%"] : "70%";
    } else if (composition === "stacked-breakdown") {
      center = ["50%", "27%"];
      radius = doughnut ? ["49%", "84%"] : "84%";
    }
    return {
      center,
      ...(hideLabels ? {
        label: { show: false },
        labelLine: { show: false },
      } : {}),
      radius,
    };
  });
}

function buildCategoryResponsiveMedia(option) {
  const { geometry } = RESPONSIVE_LAYOUT;
  const summaryTitle = {
    show: true,
    textStyle: {
      rich: {
        value: { fontSize: 22, lineHeight: 27 },
        percent: { fontSize: 10, lineHeight: 15 },
      },
    },
  };
  const doughnut = option.series.some((series) => Array.isArray(series.radius));
  return [{
    option: {
      legend: { show: false },
      series: getCategorySeriesMedia(option.series, "micro"),
      title: { show: false },
    },
    query: {
      maxHeight: geometry.height.shallowMax,
      maxWidth: geometry.width.narrowMax,
    },
  }, {
    option: {
      legend: { show: false },
      series: getCategorySeriesMedia(option.series, "side-summary"),
      title: {
        ...summaryTitle,
        left: "8%",
        textAlign: "left",
        textVerticalAlign: "middle",
        top: "50%",
      },
    },
    query: {
      maxHeight: geometry.height.shallowMax,
      minWidth: geometry.width.narrowMax + 1,
    },
  }, {
    option: {
      legend: { show: false },
      series: getCategorySeriesMedia(option.series, "stacked-summary"),
      title: {
        ...summaryTitle,
        left: "50%",
        textAlign: "center",
        textVerticalAlign: "top",
        top: "8%",
      },
    },
    query: {
      maxHeight: geometry.height.regularMax,
      maxWidth: geometry.width.narrowMax,
      minHeight: geometry.height.shallowMax + 1,
    },
  }, {
    option: {
      legend: { show: false },
      series: getCategorySeriesMedia(option.series, "side-breakdown"),
      title: {
        left: "75%",
        show: doughnut,
        textAlign: "center",
        textVerticalAlign: "middle",
        top: "50%",
      },
    },
    query: {
      minHeight: geometry.height.shallowMax + 1,
      minWidth: geometry.width.regularMax + 1,
    },
  }, {
    option: {
      legend: { show: false },
      series: getCategorySeriesMedia(option.series, "stacked-breakdown"),
      title: {
        left: "50%",
        show: doughnut,
        textAlign: "center",
        textVerticalAlign: "middle",
        textStyle: {
          rich: {
            value: { fontSize: 16, lineHeight: 20 },
            percent: { fontSize: 9, lineHeight: 13 },
          },
        },
        top: "27%",
      },
    },
    query: {
      maxWidth: geometry.width.regularMax,
      minHeight: geometry.height.regularMax + 1,
    },
  }];
}

function buildCategoryBreakdownGraphic(datasets, colors, renderContext, composition) {
  if (!["side-breakdown", "stacked-breakdown"].includes(composition)) return [];
  const width = Number(renderContext.width) || 0;
  const height = Number(renderContext.height) || 0;
  if (width < 10 || height < 10) return [];
  const rows = datasets.flatMap((dataset) => dataset.source).map((row, index) => ({
    color: colors[index % Math.max(1, colors.length)] || "#a1a1aa",
    name: `${row.category ?? ""}`,
    percent: row.formattedPercent,
    value: row.formattedValue,
  }));
  const side = composition === "side-breakdown";
  const rowHeight = 22;
  const listWidth = Math.round(width * (side ? 0.42 : 0.84));
  const availableHeight = Math.round(height * (side ? 0.88 : 0.46));
  const capacity = Math.max(1, Math.floor(availableHeight / rowHeight));
  const visibleRows = rows.slice(0, capacity);
  const overflow = rows.length - visibleRows.length;
  if (overflow > 0) {
    visibleRows[visibleRows.length - 1] = {
      color: "#a1a1aa",
      name: `+${overflow + 1} more`,
      percent: "",
      value: "",
    };
  }
  const listHeight = visibleRows.length * rowHeight;
  const dark = renderContext.theme === "dark";
  const textColor = dark ? "#f4f4f5" : "#27272a";
  const mutedColor = dark ? "#a1a1aa" : "#71717a";
  const children = visibleRows.flatMap((row, index) => {
    const y = index * rowHeight + rowHeight / 2;
    return [{
      shape: { cx: 4, cy: y, r: 4 },
      silent: true,
      style: { fill: row.color },
      type: "circle",
    }, {
      silent: true,
      style: {
        fill: textColor,
        font: "11px Inter, sans-serif",
        overflow: "truncate",
        text: row.name,
        textVerticalAlign: "middle",
        width: Math.max(20, listWidth - 150),
        x: 16,
        y,
      },
      type: "text",
    }, {
      silent: true,
      style: {
        fill: textColor,
        font: "11px ui-monospace, SFMono-Regular, Menlo, monospace",
        text: row.value,
        textAlign: "right",
        textVerticalAlign: "middle",
        x: listWidth - 58,
        y,
      },
      type: "text",
    }, {
      silent: true,
      style: {
        fill: mutedColor,
        font: "11px ui-monospace, SFMono-Regular, Menlo, monospace",
        text: row.percent,
        textAlign: "right",
        textVerticalAlign: "middle",
        x: listWidth,
        y,
      },
      type: "text",
    }];
  });
  return [{
    children,
    left: Math.round(width * (side ? 0.05 : 0.08)),
    silent: true,
    top: side ? Math.round((height - listHeight) / 2) : Math.round(height * 0.5),
    type: "group",
    z: 20,
  }];
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
  const horizontal = preparedData.results[0]?.mark === "horizontalBar";
  const barAppearance = horizontal ? BAR_APPEARANCE.horizontal : BAR_APPEARANCE.vertical;
  const dark = renderContext.theme === "dark";
  const axisColor = dark ? "#71717a" : "#a1a1aa";
  const stackGroups = new Map();
  projection.series.forEach((series, index) => {
    const layer = getLayer(visualization, series.layerId);
    if (!layer.stack || layer.stack === "none") return;
    const key = `stack-${layer.stack}`;
    if (!stackGroups.has(key)) stackGroups.set(key, []);
    stackGroups.get(key).push(index);
  });
  const option = {
    ...getBaseOption(visualization, renderContext),
    dataset: { dimensions, source },
    grid: { containLabel: true, left: 16, right: 18, top: 42, bottom: 16 },
    series: projection.series.flatMap((series, seriesIndex) => {
      const layer = getLayer(visualization, series.layerId);
      const style = getLayerSeriesStyle(styles, series, layer);
      let mark = series.mark;
      if (series.mark === "horizontalBar") mark = "bar";
      const formula = parseValueFormula(layer.encoding?.value?.formula);
      const stacked = Boolean(layer.stack && layer.stack !== "none");
      const stackMembers = stacked ? stackGroups.get(`stack-${layer.stack}`) || [] : [];
      const stackIndex = stackMembers.indexOf(seriesIndex);
      let labelPosition = "top";
      if (mark === "bar") labelPosition = horizontal && !stacked ? "right" : "inside";
      const baseSeries = {
        areaStyle: style.areaStyle,
        connectNulls: visualization.settings?.missingValues?.policy === "zero",
        encode: horizontal
          ? { itemName: "category", x: series.id, y: "category" }
          : { itemName: "category", x: "category", y: series.id },
        blur: horizontal ? { itemStyle: { opacity: 0.24 } } : undefined,
        emphasis: {
          focus: horizontal ? "self" : "series",
          itemStyle: horizontal ? { opacity: 1 } : undefined,
        },
        id: series.id,
        itemStyle: mark === "bar"
          ? {
            borderColor: style.color,
            borderRadius: horizontal
              ? getHorizontalBarRadius(
                stacked,
                stackIndex,
                stackMembers.length,
                barAppearance.borderRadius
              )
              : barAppearance.borderRadius,
            borderWidth: horizontal && stacked ? 0 : 1.5,
            color: style.fill === false ? "transparent" : style.color,
            opacity: style.fill === false ? 1 : style.fillOpacity ?? 1,
          }
          : { color: style.color },
        label: {
          formatter: `${formula.prefix}{@${series.id}}${formula.suffix}`,
          position: labelPosition,
          show: Boolean(visualization.settings?.dataLabels),
        },
        lineStyle: { color: style.color, width: 2 },
        markLine: buildMarkLine(series, horizontal, formula, renderContext.locale),
        name: style.name,
        barCategoryGap: `${barAppearance.categoryGap}%`,
        barMaxWidth: barAppearance.maxWidth,
        showSymbol: Number(style.pointRadius) > 0,
        smooth: layer.style?.smooth ? 0.25 : false,
        stack: stacked ? `stack-${layer.stack}` : undefined,
        symbolSize: Number(style.pointRadius) > 0 ? Number(style.pointRadius) * 2 : 6,
        type: mark,
      };
      const lastIndex = series.values.length - 1;
      const dashedLastPoint = mark === "line"
        && visualization.settings?.dashedLastPoint
        && lastIndex > 0
        && series.values[lastIndex - 1] !== null
        && series.values[lastIndex - 1] !== undefined
        && series.values[lastIndex] !== null
        && series.values[lastIndex] !== undefined;
      if (!dashedLastPoint) return [baseSeries];

      const baseData = series.values.map((value, index) => index === lastIndex ? null : value);
      const dashedData = series.values.map((value, index) => index >= lastIndex - 1 ? value : null);
      const latestPointData = series.values.map((value, index) => index === lastIndex ? value : null);
      const showLatestPoint = Number(style.pointRadius) > 0;
      return [{
        ...baseSeries,
        data: baseData,
        encode: undefined,
        label: {
          ...baseSeries.label,
          formatter: `${formula.prefix}{c}${formula.suffix}`,
        },
      }, {
        ...baseSeries,
        areaStyle: style.areaStyle,
        data: dashedData,
        encode: undefined,
        id: `${series.id}${DASHED_LAST_SERIES_SUFFIX}`,
        label: { show: false },
        lineStyle: { ...baseSeries.lineStyle, type: [5, 10] },
        markLine: undefined,
        showSymbol: false,
        silent: true,
        stack: undefined,
        symbol: "none",
        tooltip: { show: false },
        z: 3,
      }, {
        data: latestPointData,
        id: `${series.id}${LATEST_POINT_SERIES_SUFFIX}`,
        itemStyle: {
          color: style.color,
          opacity: showLatestPoint ? 1 : 0,
        },
        label: {
          formatter: `${formula.prefix}{c}${formula.suffix}`,
          position: "top",
          show: Boolean(visualization.settings?.dataLabels),
        },
        name: style.name,
        symbolSize: showLatestPoint ? Number(style.pointRadius) * 2 : 1,
        type: "scatter",
        z: 4,
      }];
    }),
    xAxis: horizontal
      ? {
        axisLabel: { color: axisColor, fontSize: 10, hideOverlap: true, margin: 6 },
        axisLine: { lineStyle: { color: axisColor, width: 1 }, show: true },
        axisTick: { show: false },
        position: "top",
        splitLine: { show: false },
        type: visualization.settings?.isLogarithmic || visualization.settings?.logarithmic ? "log" : "value",
      }
      : {
        axisLabel: {
          fontSize: 10,
          hideOverlap: true,
          interval: getXAxisLabelInterval(
            visualization.settings?.xLabelTicks,
            projection.labels.length
          ),
          margin: 8,
        },
        axisTick: { show: false },
        data: visualization.settings?.dashedLastPoint ? projection.labels : undefined,
        type: "category",
      },
    yAxis: horizontal
      ? {
        axisLabel: {
          align: "left",
          color: axisColor,
          fontSize: 11,
          hideOverlap: true,
          margin: 96,
          overflow: "truncate",
          width: 88,
        },
        axisLine: { lineStyle: { color: axisColor, width: 1 }, show: true },
        axisTick: { show: false },
        inverse: true,
        splitLine: { show: false },
        type: "category",
      }
      : {
        axisLabel: { fontSize: 10, margin: 8 },
        axisTick: { show: false },
        type: visualization.settings?.isLogarithmic || visualization.settings?.logarithmic ? "log" : "value",
      },
  };

  if (horizontal) {
    option.legend = {
      ...option.legend,
      left: 0,
      padding: 0,
    };
    option.grid = {
      bottom: 4,
      containLabel: true,
      left: 2,
      right: 16,
      top: option.legend.show ? 28 : 20,
    };
    option.tooltip.axisPointer = {
      shadowStyle: { color: dark ? "rgba(255, 255, 255, 0.06)" : "rgba(24, 24, 27, 0.05)" },
      type: "shadow",
    };
  }

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
  } else {
    if (visualization.settings?.minValue !== null
      && visualization.settings?.minValue !== undefined
      && Number.isFinite(Number(visualization.settings.minValue))) {
      option.xAxis.min = Number(visualization.settings.minValue);
    }
    if (visualization.settings?.maxValue !== null
      && visualization.settings?.maxValue !== undefined
      && Number.isFinite(Number(visualization.settings.maxValue))) {
      option.xAxis.max = Number(visualization.settings.maxValue);
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
  const categoryMetadata = buildCategoryMetadata(preparedData, visualization);
  const metadataById = new Map(categoryMetadata.map((category) => [category.id, category]));
  const datasets = [];
  const series = [];

  preparedData.results.forEach((result) => {
    const layer = getLayer(visualization, result.id);
    const formula = parseValueFormula(layer.encoding?.value?.formula);
    const defaultSeries = result.series[0] || { id: `series-${result.id}`, label: result.name };
    const sourceValues = result.rows.map((row) => {
      const id = createSeriesId(result.id, row.category);
      const value = preparedData.__valuesFinal
        ? row.value
        : applyValueFormula(row.value, layer.encoding?.value?.formula);
      return {
        category: row.category,
        formattedValue: `${formula.prefix}${Number(value).toLocaleString(renderContext.locale)}${formula.suffix}`,
        id,
        value,
      };
    });
    const sourceTotal = sourceValues.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    const source = sourceValues.map((row) => ({
      ...row,
      formattedPercent: `${(sourceTotal > 0 ? (Number(row.value) / sourceTotal) * 100 : 0)
        .toLocaleString(renderContext.locale, { maximumFractionDigits: 2 })}%`,
    }));
    const datasetIndex = datasets.length;
    datasets.push({
      dimensions: ["id", "category", "value", "formattedValue", "formattedPercent"],
      source,
    });
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
      avoidLabelOverlap: false,
      label: {
        formatter: visualization.settings?.dataLabelsFormat === "value"
          ? `${formula.prefix}{@value}${formula.suffix}`
          : "{d}%",
        fontSize: 10,
        fontWeight: 700,
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
  const dark = renderContext.theme === "dark";
  const colors = categoryMetadata.map((category) => metadataById.get(category.id).color);
  const composition = resolveCategoryComposition({
    height: renderContext.height,
    width: renderContext.width,
  });
  const graphic = buildCategoryBreakdownGraphic(
    datasets,
    colors,
    renderContext,
    composition
  );
  return {
    ...getBaseOption(visualization, renderContext, "item"),
    color: colors,
    dataset: datasets,
    ...(graphic.length > 0 ? { graphic } : {}),
    series,
    title: {
      left: "50%",
      padding: 0,
      show: presetId === "doughnut",
      text: `{label|Total}\n{value|${totalFormula.prefix}${total.toLocaleString(renderContext.locale)}${totalFormula.suffix}}`,
      textAlign: "center",
      textVerticalAlign: "middle",
      textStyle: {
        fontWeight: 400,
        rich: {
          label: {
            color: dark ? "#a1a1aa" : "#71717a",
            fontSize: 10,
            fontWeight: 400,
            lineHeight: 15,
          },
          value: {
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 31,
          },
          percent: {
            color: dark ? "#a1a1aa" : "#71717a",
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 16,
          },
        },
      },
      top: "50%",
    },
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
      const formula = parseValueFormula(layer.encoding?.value?.formula);
      return {
        coordinateSystem: "polar",
        encode: { angle: "category", radius: series.id },
        id: series.id,
        itemStyle: { color: style.color },
        label: {
          formatter: `${formula.prefix}{@${series.id}}${formula.suffix}`,
          fontSize: 10,
          position: "middle",
          show: Boolean(visualization.settings?.dataLabels),
        },
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

function buildMatrixSource(result, layer, visualization, timezone, valuesAreFinal = false) {
  const rows = result.rows || [];
  const valuesByDate = new Map();
  rows.forEach((row) => {
    const date = parseMatrixDate(row.time, timezone);
    if (!date) return;
    const value = Number(valuesAreFinal
      ? row.value
      : applyValueFormula(row.value, layer.encoding?.value?.formula));
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

function buildCategoricalMatrixSource(result, layer, valuesAreFinal = false) {
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
    const value = Number(valuesAreFinal
      ? row.value
      : applyValueFormula(row.value, layer.encoding?.value?.formula));
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
      renderContext.timezone || preparedData.timezone,
      preparedData.__valuesFinal
    )
    : buildCategoricalMatrixSource(result, layer, preparedData.__valuesFinal);
  const { source } = matrix;
  const values = source.map((row) => row.value);
  const max = matrix.max || (values.length > 0 ? Math.max(1, ...values) : 1);
  const color = style.color || getStableColor(seriesDefinition.id);
  const xDimension = isCalendar ? "week" : "column";
  const yDimension = isCalendar ? "day" : "row";
  const tooltipDimensions = isCalendar
    ? ["date", "value"]
    : ["columnLabel", "rowLabel", "value"];
  const columnCount = (isCalendar ? matrix.weekLabels : matrix.columnLabels)?.length || 1;
  const rowCount = isCalendar ? 7 : (matrix.rowLabels?.length || 1);
  const composition = resolveMatrixComposition({
    columnCount,
    height: renderContext.height,
    rowCount,
    width: renderContext.width,
  });
  const dense = composition === "dense";
  const layout = getMatrixCellLayout(
    renderContext.width,
    renderContext.height,
    columnCount,
    rowCount,
    composition
  );
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
      axisLabel: {
        fontSize: 10,
        hideOverlap: true,
        interval: "auto",
        margin: 8,
        show: !dense,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      boundaryGap: true,
      data: isCalendar ? matrix.weekLabels : matrix.columnLabels,
      splitArea: { show: false },
      splitLine: { show: false },
      show: !dense,
      type: "category",
    },
    yAxis: {
      axisLabel: { fontSize: 10, interval: 0, margin: 8, show: !dense },
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
      show: !dense,
      type: "category",
    },
  };
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(`${value}`.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getGaugeActiveRangeIndex(ranges, value) {
  const matchingIndex = ranges.findIndex((range, index) => {
    const isLast = index === ranges.length - 1;
    return value >= Number(range.min)
      && (isLast ? value <= Number(range.max) : value < Number(range.max));
  });
  if (matchingIndex >= 0) return matchingIndex;
  return value < Number(ranges[0]?.min) ? 0 : Math.max(0, ranges.length - 1);
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
  const activeRange = rangeData[getGaugeActiveRangeIndex(ranges, value)];
  const formattedValue = `${formula.prefix}${value.toLocaleString(renderContext.locale)}${formula.suffix}`;
  const mutedColor = renderContext.theme === "dark" ? "#a1a1aa" : "#71717a";
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
        show: false,
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
      title: { fontSize: 12, offsetCenter: [0, "22%"], show: false },
      tooltip: { show: false },
      type: "gauge",
      z: 10,
    }],
    title: {
      left: "50%",
      padding: 0,
      show: true,
      text: `{value|${formattedValue}} {marker|●}\n{label|${label}}`,
      textAlign: "center",
      textVerticalAlign: "middle",
      textStyle: {
        fontWeight: 400,
        rich: {
          label: { color: mutedColor, fontSize: 15, fontWeight: 400, lineHeight: 23 },
          marker: {
            color: activeRange?.itemStyle?.color,
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 48,
            padding: [0, 0, 0, 8],
          },
          value: {
            fontFamily: CENTRAL_VALUE_FONT,
            fontSize: 42,
            fontWeight: 700,
            lineHeight: 48,
          },
        },
      },
      top: "55%",
    },
  };
}

function buildGaugeResponsiveMedia() {
  const { geometry, presets } = RESPONSIVE_LAYOUT;
  const compactSeries = [{
    center: ["50%", "70%"],
    label: { show: false },
    radius: ["52%", "70%"],
  }, {
    center: ["50%", "70%"],
    detail: { show: false },
    pointer: { width: 4 },
    radius: "70%",
    title: { show: false },
  }];
  const sideSeries = [{
    center: ["72%", "50%"],
    label: { show: false },
    radius: ["72%", "92%"],
  }, {
    center: ["72%", "50%"],
    detail: { show: false },
    pointer: { width: 4 },
    radius: "92%",
    title: { show: false },
  }];
  const microSeries = [{
    center: ["50%", "55%"],
    label: { show: false },
    radius: ["70%", "90%"],
  }, {
    center: ["50%", "55%"],
    detail: { show: false },
    pointer: { width: 4 },
    radius: "90%",
    title: { show: false },
  }];
  return [{
    option: {
      series: microSeries,
      title: { show: false },
    },
    query: {
      maxHeight: geometry.height.shallowMax,
      maxWidth: geometry.width.narrowMax,
    },
  }, {
    option: {
      series: sideSeries,
      title: {
        left: "8%",
        textAlign: "left",
        textStyle: {
          rich: {
            label: { fontSize: 13, lineHeight: 20 },
            marker: { fontSize: 10, lineHeight: 34, padding: [0, 0, 0, 8] },
            value: { fontSize: 28, lineHeight: 34 },
          },
        },
        top: "50%",
      },
    },
    query: {
      maxHeight: presets.gauge.sideSummaryMaxHeight,
      minWidth: geometry.width.narrowMax + 1,
    },
  }, {
    option: {
      series: compactSeries,
      title: {
        left: "50%",
        textAlign: "center",
        textStyle: {
          rich: {
            label: { fontSize: 10, lineHeight: 15 },
            marker: { fontSize: 8, lineHeight: 27, padding: [0, 0, 0, 8] },
            value: { fontSize: 22, lineHeight: 27 },
          },
        },
        textVerticalAlign: "top",
        top: "8%",
      },
    },
    query: {
      maxWidth: geometry.width.narrowMax,
      minHeight: geometry.height.shallowMax + 1,
    },
  }, {
    option: {
      title: {
        textStyle: {
          rich: {
            label: { fontSize: 13, lineHeight: 20 },
            marker: { fontSize: 10, lineHeight: 38, padding: [0, 0, 0, 8] },
            value: { fontSize: 32, lineHeight: 38 },
          },
        },
      },
    },
    query: {
      maxHeight: geometry.height.regularMax,
      maxWidth: geometry.width.regularMax,
      minHeight: presets.gauge.sideSummaryMaxHeight + 1,
      minWidth: geometry.width.narrowMax + 1,
    },
  }];
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

  if (presetId === "line") {
    option.media = buildLineResponsiveMedia(option, option.dataset.source.length);
  } else if (presetId === "bar" && option.xAxis?.type === "category") {
    option.media = buildVerticalBarResponsiveMedia(option, option.dataset.source.length);
  } else if (presetId === "horizontalBar") {
    option.media = buildHorizontalBarResponsiveMedia(option);
  } else if (presetId === "gauge") {
    option.media = buildGaugeResponsiveMedia();
  } else if (PIE_PRESETS.has(presetId)) {
    option.media = buildCategoryResponsiveMedia(option);
  } else if (presetId === "radar") {
    option.media = buildRadarResponsiveMedia(option);
  } else if (presetId === "polar") {
    option.media = buildPolarResponsiveMedia(option);
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
