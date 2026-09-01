import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import * as echarts from "echarts/core";
import {
  BarChart, GaugeChart, LineChart, PieChart, RadarChart, ScatterChart,
} from "echarts/charts";
import {
  AriaComponent, DatasetComponent, GridComponent, LegendComponent, MarkLineComponent,
  PolarComponent, RadarComponent, TitleComponent, TooltipComponent, VisualMapComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

import { semanticColors } from "../../../lib/themeTokens";
import { useTheme } from "../../../modules/ThemeContext";
import {
  getResponsiveGeometry,
  resolveCategoryComposition,
  resolveGaugeComposition,
  resolveHorizontalBarComposition,
  resolveMatrixComposition,
} from "../../../visualization/responsiveLayout";
import {
  compactEChartsAxes,
  scaleEChartsDetails,
} from "../../../visualization/scaleEChartsDetails";
import {
  buildDoughnutHoverTitle,
  buildDoughnutValueTitle,
  getCategoryBreakdownItems,
  getDoughnutSliceFromChart,
  getEChartsTooltipOption,
  isCategoryPieChart,
  isDoughnutChart,
} from "./echartsTooltip";

echarts.use([
  AriaComponent,
  BarChart,
  CanvasRenderer,
  DatasetComponent,
  GaugeChart,
  GridComponent,
  LabelLayout,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  PieChart,
  PolarComponent,
  RadarChart,
  RadarComponent,
  ScatterChart,
  SVGRenderer,
  TitleComponent,
  TooltipComponent,
  UniversalTransition,
  VisualMapComponent,
]);

function buildTheme(mode) {
  const colors = semanticColors[mode];
  return {
    backgroundColor: "transparent",
    categoryAxis: {
      axisLabel: { color: colors.foreground.DEFAULT },
      axisLine: { lineStyle: { color: colors.content3.DEFAULT } },
      splitLine: { lineStyle: { color: colors.content3.DEFAULT } },
    },
    gauge: {
      detail: { color: colors.foreground.DEFAULT },
      itemStyle: { color: colors.foreground.DEFAULT },
      title: { color: colors.foreground[500] },
    },
    legend: { textStyle: { color: colors.foreground.DEFAULT } },
    title: { textStyle: { color: colors.foreground.DEFAULT } },
    textStyle: { color: colors.foreground.DEFAULT, fontFamily: "Inter, sans-serif" },
    timeAxis: {
      axisLabel: { color: colors.foreground.DEFAULT },
      axisLine: { lineStyle: { color: colors.content3.DEFAULT } },
      splitLine: { lineStyle: { color: colors.content3.DEFAULT } },
    },
    valueAxis: {
      axisLabel: { color: colors.foreground.DEFAULT },
      axisLine: { lineStyle: { color: colors.content3.DEFAULT } },
      splitLine: { lineStyle: { color: colors.content3.DEFAULT } },
    },
  };
}

echarts.registerTheme("chartbrew-light", buildTheme("light"));
echarts.registerTheme("chartbrew-dark", buildTheme("dark"));

const MATRIX_GRID_INSETS = {
  bounded: { bottom: 22, left: 6, right: 36, top: 10 },
  dense: { bottom: 6, left: 6, right: 6, top: 6 },
  labeled: { bottom: 24, left: 8, right: 40, top: 12 },
};

function getMatrixCellLayout(width, height, columnCount, rowCount, composition) {
  const columns = Math.max(1, columnCount);
  const rows = Math.max(1, rowCount);
  const inset = MATRIX_GRID_INSETS[composition];
  const availableWidth = Math.max(1, width - inset.left - inset.right);
  const availableHeight = Math.max(1, height - inset.top - inset.bottom);
  const cellSize = Math.max(1, Math.floor(Math.min(availableWidth / columns, availableHeight / rows)));
  const cellGap = Math.min(3, Math.max(1, Math.floor(cellSize * 0.12)));
  const gridWidth = cellSize * columns;
  const gridHeight = cellSize * rows;
  return {
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

function isMatrixSeries(series) {
  return series?.type === "heatmap"
    || (series?.type === "scatter" && series?.symbol === "roundRect");
}

function isGaugeChart(option) {
  return option?.series?.some((series) => series?.type === "gauge") || false;
}

function isHorizontalBarChart(option) {
  const xAxis = Array.isArray(option?.xAxis) ? option.xAxis[0] : option?.xAxis;
  const yAxis = Array.isArray(option?.yAxis) ? option.yAxis[0] : option?.yAxis;
  return option?.series?.some((series) => series?.type === "bar")
    && ["value", "log"].includes(xAxis?.type)
    && yAxis?.type === "category";
}

function isCompactTooltipLayout(width, height) {
  const geometry = getResponsiveGeometry(width, height);
  return geometry.width === "narrow" || geometry.height === "shallow";
}

function getTooltipColors(themeMode) {
  const colors = semanticColors[themeMode];
  return {
    background: colors.content1.DEFAULT,
    border: colors.content3.DEFAULT,
    muted: colors.foreground[500],
    shadow: themeMode === "dark"
      ? "0 6px 18px rgba(0,0,0,0.28)"
      : "0 6px 18px rgba(17,24,39,0.12)",
    text: colors.foreground.DEFAULT,
  };
}

function applyMatrixLayout(option, width, height) {
  const series = option?.series?.[0];
  if (!isMatrixSeries(series)) return option;
  const columns = option.xAxis?.data?.length || 1;
  const rows = option.yAxis?.data?.length || 1;
  const composition = resolveMatrixComposition({
    columnCount: columns,
    height,
    rowCount: rows,
    width,
  });
  const dense = composition === "dense";
  const layout = getMatrixCellLayout(width, height, columns, rows, composition);
  return {
    ...option,
    grid: layout.grid,
    series: option.series.map((item, index) => (index === 0 ? {
      ...item,
      emphasis: { ...item.emphasis, scale: false },
      itemStyle: { ...item.itemStyle, borderWidth: 0 },
      symbol: "roundRect",
      symbolKeepAspect: true,
      symbolSize: layout.symbolSize,
      type: "scatter",
    } : item)),
    xAxis: {
      ...option.xAxis,
      axisLabel: { ...option.xAxis?.axisLabel, show: !dense },
      show: !dense,
    },
    yAxis: {
      ...option.yAxis,
      axisLabel: { ...option.yAxis?.axisLabel, show: !dense },
      show: !dense,
    },
  };
}

const CATEGORY_FADE_DELAY_MS = 220;

function getCategoryRadius(item, composition, width, height) {
  const doughnut = Array.isArray(item.radius);
  let outerRadius;
  if (composition === "side-summary") {
    outerRadius = Math.max(8, Math.min(height * 0.45, width * 0.23));
  } else if (composition === "side-breakdown") {
    outerRadius = Math.max(8, Math.min(height * 0.44, width * 0.22));
  } else if (composition === "stacked-summary") {
    outerRadius = Math.max(8, Math.min(width * 0.43, height * 0.28));
  } else if (composition === "stacked-breakdown") {
    outerRadius = Math.max(8, Math.min(width * 0.42, height * 0.21));
  } else {
    outerRadius = Math.max(8, Math.min(width * 0.46, height * 0.46));
  }
  return doughnut ? [Math.round(outerRadius * 0.58), Math.round(outerRadius)] : Math.round(outerRadius);
}

function applyCategoryLayout(option, width, height, themeColors) {
  if (!isCategoryPieChart(option) || width < 10 || height < 10) return option;
  const composition = resolveCategoryComposition({ height, width });
  const doughnut = isDoughnutChart(option);
  const centered = composition === "centered";
  const micro = composition === "micro";
  const breakdown = composition === "side-breakdown" || composition === "stacked-breakdown";
  const summary = composition === "side-summary" || composition === "stacked-summary";
  const legendVisible = centered && option.legend?.show !== false;
  const legendHeight = legendVisible
    ? Math.min(36, Math.max(0, Math.round(height * 0.12)))
    : 0;
  let centerX = Math.round(width / 2);
  let centerY = Math.round(legendHeight + Math.max(1, height - legendHeight) / 2);
  let titleLeft = centerX;
  let titleTop = centerY;
  let titleAlign = "center";
  let titleVerticalAlign = "middle";
  if (composition === "side-summary") {
    centerX = Math.round(width * 0.73);
    centerY = Math.round(height / 2);
    titleLeft = Math.round(width * 0.08);
    titleTop = centerY;
    titleAlign = "left";
  } else if (composition === "side-breakdown") {
    centerX = Math.round(width * 0.75);
    centerY = Math.round(height / 2);
    titleLeft = centerX;
    titleTop = centerY;
  } else if (composition === "stacked-summary") {
    centerX = Math.round(width / 2);
    centerY = Math.round(height * 0.69);
    titleLeft = centerX;
    titleTop = Math.max(8, Math.round(height * 0.08));
    titleVerticalAlign = "top";
  } else if (composition === "stacked-breakdown") {
    centerX = Math.round(width / 2);
    centerY = Math.round(height * 0.27);
    titleLeft = centerX;
    titleTop = centerY;
  }
  const rest = { ...option };
  delete rest.media;
  delete rest.graphic;
  return {
    ...rest,
    legend: centered ? option.legend : { ...option.legend, show: false },
    tooltip: {
      ...option.tooltip,
      show: summary || breakdown ? false : option.tooltip?.show,
    },
    series: option.series.map((item) => (
      item.type === "pie" ? {
        ...item,
        center: [centerX, centerY],
        ...(centered ? {} : {
          radius: getCategoryRadius(item, composition, width, height),
          ...((micro || summary) ? {
            label: { ...item.label, show: false },
            labelLine: { ...item.labelLine, show: false },
          } : {}),
          ...(breakdown ? {
            blur: { ...item.blur, itemStyle: { ...item.blur?.itemStyle, opacity: 0.18 } },
            emphasis: { ...item.emphasis, focus: "self", scale: true },
            stateAnimation: { duration: 280 },
          } : {}),
        }),
      } : item
    )),
    title: option.title ? {
      ...option.title,
      left: titleLeft,
      show: !micro && (doughnut || summary),
      textAlign: titleAlign,
      textVerticalAlign: titleVerticalAlign,
      top: titleTop,
      textStyle: {
        ...option.title.textStyle,
        rich: {
          ...option.title.textStyle?.rich,
          marker: {
            color: option.title.textStyle?.color,
            fontSize: 10,
            fontWeight: 400,
            lineHeight: 15,
          },
          label: {
            ...option.title.textStyle?.rich?.label,
            color: themeColors?.muted,
            fontWeight: 400,
          },
          value: {
            ...option.title.textStyle?.rich?.value,
            color: themeColors?.text,
            fontFamily: "Inter Tight, sans-serif",
            fontWeight: 700,
            ...(centered ? {} : composition === "stacked-breakdown"
              ? { fontSize: 16, lineHeight: 20 }
              : { fontSize: 22, lineHeight: 27 }),
          },
          percent: {
            ...option.title.textStyle?.rich?.percent,
            color: themeColors?.muted,
            fontFamily: "Inter Tight, sans-serif",
            fontWeight: 400,
            ...(centered ? {} : composition === "stacked-breakdown"
              ? { fontSize: 9, lineHeight: 13 }
              : { fontSize: 10, lineHeight: 15 }),
          },
        },
      },
    } : option.title,
  };
}

function getGaugeRadius(composition, width, height) {
  if (composition === "side-summary") {
    return Math.max(8, Math.min(height * 0.46, width * 0.2));
  }
  if (composition === "compact") {
    return Math.max(8, Math.min(width * 0.42, height * 0.28));
  }
  return Math.max(8, Math.min(width * 0.44, height * 0.44));
}

function getGaugeTitleValue(option) {
  const match = `${option?.title?.text || ""}`.match(/\{value\|([^}]+)\}/);
  return match ? match[1] : "";
}

function getGaugeOverlayFonts(composition, outerRadius, valueText) {
  const valueDefault = composition === "large" ? 42 : 32;
  const labelDefault = composition === "large" ? 15 : 13;
  const hole = outerRadius * 1.56;
  const chars = Math.max(1, `${valueText}`.length);
  const maxValue = Math.floor((hole - 20) / (chars * 0.62));
  const value = Math.max(24, Math.min(valueDefault, maxValue));
  const label = Math.min(labelDefault, Math.max(10, Math.round(value * 0.38)));
  return { label, value };
}

function applyGaugeLayout(option, width, height, themeColors) {
  if (!isGaugeChart(option) || width < 10 || height < 10) return option;
  const composition = resolveGaugeComposition({ height, width });
  const side = composition === "side-summary";
  const compact = composition === "compact";
  const micro = composition === "micro";
  const centerX = Math.round(width * (side ? 0.72 : 0.5));
  const centerY = Math.round(height * (side ? 0.5 : compact ? 0.7 : 0.55));
  const titleX = Math.round(width * (side ? 0.08 : 0.5));
  const titleY = compact ? Math.max(8, Math.round(height * 0.08)) : centerY;
  const outerRadius = Math.round(getGaugeRadius(composition, width, height));
  const overlayFonts = side || compact
    ? null
    : getGaugeOverlayFonts(composition, outerRadius, getGaugeTitleValue(option));
  const valueFontSize = overlayFonts?.value
    ?? (side ? 28 : 22);
  const labelFontSize = overlayFonts?.label
    ?? (compact ? 10 : 13);
  const rest = { ...option };
  delete rest.media;
  return {
    ...rest,
    series: option.series.map((series) => {
      if (series.type === "pie" && `${series.id || ""}`.endsWith("-ranges")) {
        return {
          ...series,
          center: [centerX, centerY],
          label: { ...series.label, show: false },
          radius: [Math.round(outerRadius * 0.78), outerRadius],
        };
      }
      if (series.type !== "gauge") return series;
      return {
        ...series,
        center: [centerX, centerY],
        detail: { ...series.detail, show: false },
        pointer: { ...series.pointer, width: composition === "large" ? 5 : 4 },
        radius: outerRadius,
        title: { ...series.title, show: false },
      };
    }),
    title: option.title ? {
      ...option.title,
      left: titleX,
      show: !micro,
      textAlign: side ? "left" : "center",
      textVerticalAlign: compact ? "top" : "middle",
      top: titleY,
      textStyle: {
        ...option.title.textStyle,
        rich: {
          ...option.title.textStyle?.rich,
          label: {
            ...option.title.textStyle?.rich?.label,
            color: themeColors?.muted,
            fontSize: labelFontSize,
            lineHeight: labelFontSize + 8,
          },
          marker: {
            ...option.title.textStyle?.rich?.marker,
            fontSize: Math.max(8, Math.round(valueFontSize * 0.28)),
            lineHeight: valueFontSize + 6,
            padding: [0, 0, 0, 8],
          },
          value: {
            ...option.title.textStyle?.rich?.value,
            color: themeColors?.text,
            fontSize: valueFontSize,
            lineHeight: valueFontSize + 6,
          },
        },
      },
    } : option.title,
  };
}

function applyHorizontalBarLayout(option, width, height, themeColors) {
  if (!isHorizontalBarChart(option) || width < 10 || height < 10) return option;
  const compact = resolveHorizontalBarComposition({ height, width }) === "compact";
  const muted = themeColors?.muted;
  const axisLine = themeColors?.border;
  const labelWidth = compact ? 68 : Math.min(112, Math.max(72, Math.round(width * 0.2)));
  const legendShow = option.legend?.show !== false && !compact;
  return {
    ...option,
    grid: {
      bottom: 4,
      containLabel: true,
      left: 2,
      right: compact ? 10 : 16,
      top: legendShow ? 28 : compact ? 18 : 20,
    },
    legend: {
      ...option.legend,
      left: 0,
      padding: [0, 0, 0, 0],
      show: legendShow,
    },
    xAxis: {
      ...option.xAxis,
      axisLabel: {
        ...option.xAxis?.axisLabel,
        color: muted,
        fontSize: compact ? 9 : 10,
        margin: 6,
      },
      axisLine: {
        show: true,
        lineStyle: { color: axisLine, width: 1 },
      },
      splitLine: { show: false },
    },
    yAxis: {
      ...option.yAxis,
      axisLabel: {
        ...option.yAxis?.axisLabel,
        align: "left",
        color: muted,
        fontSize: compact ? 9 : 11,
        margin: labelWidth + 8,
        overflow: "truncate",
        width: labelWidth,
      },
      axisLine: {
        show: true,
        lineStyle: { color: axisLine, width: 1 },
      },
    },
  };
}

function applyChartLayout(option, width, height, themeColors) {
  return applyHorizontalBarLayout(
    applyGaugeLayout(
      applyCategoryLayout(
        applyMatrixLayout(option, width, height),
        width,
        height,
        themeColors
      ),
      width,
      height,
      themeColors
    ),
    width,
    height,
    themeColors
  );
}

function isCategoryBreakdown(composition) {
  return composition === "side-breakdown" || composition === "stacked-breakdown";
}

function getCategoryEventKey(params) {
  const dataIndex = Number.isInteger(params?.dataIndex)
    ? params.dataIndex
    : params?.batch?.find((item) => Number.isInteger(item.dataIndex))?.dataIndex;
  const seriesIndex = Number.isInteger(params?.seriesIndex)
    ? params.seriesIndex
    : params?.batch?.find((item) => Number.isInteger(item.seriesIndex))?.seriesIndex || 0;
  if (!Number.isInteger(dataIndex)) return null;
  return `${seriesIndex}:${dataIndex}`;
}

function CategoryBreakdown({ activeKey, composition, items, onActivate, onDeactivate }) {
  const side = composition === "side-breakdown";
  return (
    <div
      className={side
        ? "absolute bottom-[6%] left-[5%] top-[6%] z-10 flex w-[42%] items-center"
        : "absolute bottom-[4%] left-[8%] right-[8%] top-[50%] z-10"}
      onMouseLeave={onDeactivate}
    >
      <div className="max-h-full w-full overflow-y-auto overscroll-contain py-1">
        {items.map((item) => {
          const active = !activeKey || activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-label={`${item.name}: ${item.formattedValue}, ${item.formattedPercent}`}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-md px-1.5 py-1 text-left text-xs font-normal text-foreground outline-none transition-opacity duration-150 focus-visible:bg-surface-secondary"
              style={{ opacity: active ? 1 : 0.24 }}
              onBlur={onDeactivate}
              onFocus={() => onActivate(item)}
              onMouseEnter={() => onActivate(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate" title={item.name}>{item.name}</span>
              </span>
              <span className="whitespace-nowrap font-mono text-foreground">
                {item.formattedValue}
              </span>
              <span className="min-w-12 whitespace-nowrap text-right font-mono text-foreground-500">
                {item.formattedPercent}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

CategoryBreakdown.propTypes = {
  activeKey: PropTypes.string,
  composition: PropTypes.oneOf(["side-breakdown", "stacked-breakdown"]).isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    color: PropTypes.string.isRequired,
    dataIndex: PropTypes.number.isRequired,
    formattedPercent: PropTypes.string.isRequired,
    formattedValue: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    seriesIndex: PropTypes.number.isRequired,
  })).isRequired,
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
};

CategoryBreakdown.defaultProps = {
  activeKey: null,
};

function EChartsRenderer({
  ariaLabel = "Chart",
  compactAxes = false,
  detailScale = 1,
  onChartEvent = null,
  option,
  redraw = false,
  redrawComplete = () => {},
  renderer = "canvas",
  theme = null,
}) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const compactTooltipRef = useRef(false);
  const categoryCompositionRef = useRef(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState(null);
  const [categoryComposition, setCategoryComposition] = useState(null);
  const categoryFadeRef = useRef(null);
  const restoreCategoryRef = useRef(() => {});
  const [renderError, setRenderError] = useState(null);
  const { isDark } = useTheme();
  const themeMode = theme || (isDark ? "dark" : "light");
  const themeName = `chartbrew-${themeMode}`;
  const reducedMotion = useMemo(() => {
    return typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const effectiveOption = useMemo(() => {
    const colors = semanticColors[themeMode];
    return {
      ...option,
      ...(renderer === "svg" || reducedMotion ? { animation: false } : {}),
      series: option.series?.map((series) => series.type === "gauge" ? {
        ...series,
        detail: {
          ...series.detail,
          color: colors.foreground.DEFAULT,
          fontFamily: "Inter Tight, sans-serif",
          fontWeight: 700,
        },
        itemStyle: { ...series.itemStyle, color: colors.foreground.DEFAULT },
        title: { ...series.title, color: colors.foreground[500] },
      } : series),
      tooltip: getEChartsTooltipOption(option, getTooltipColors(themeMode)),
    };
  }, [option, reducedMotion, renderer, themeMode]);
  const optionRef = useRef(effectiveOption);
  optionRef.current = effectiveOption;
  const categoryItems = useMemo(() => {
    return getCategoryBreakdownItems(effectiveOption);
  }, [effectiveOption]);

  const applyOption = (instance, nextOption, { clear = false } = {}) => {
    const container = containerRef.current;
    if (!instance || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const compact = isCompactTooltipLayout(width, height);
    compactTooltipRef.current = compact;
    const nextCategoryComposition = isCategoryPieChart(nextOption)
      ? resolveCategoryComposition({ height, width })
      : null;
    if (categoryCompositionRef.current !== nextCategoryComposition) {
      categoryCompositionRef.current = nextCategoryComposition;
      setCategoryComposition(nextCategoryComposition);
      setActiveCategoryKey(null);
    }
    const themeColors = getTooltipColors(themeMode);
    const laidOut = applyChartLayout({
      ...nextOption,
      tooltip: getEChartsTooltipOption(nextOption, themeColors, { compact }),
    }, width, height, themeColors);
    const finalOption = compactAxes ? compactEChartsAxes(laidOut) : laidOut;
    if (clear) instance.clear();
    instance.setOption(
      scaleEChartsDetails(finalOption, detailScale),
      { lazyUpdate: false, notMerge: true }
    );
    instance.resize();
  };

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let resizeObserver;
    try {
      const instance = echarts.init(containerRef.current, themeName, { renderer });
      instanceRef.current = instance;
      resizeObserver = new ResizeObserver(() => {
        const current = optionRef.current;
        const container = containerRef.current;
        const compact = container
          ? isCompactTooltipLayout(container.clientWidth, container.clientHeight)
          : false;
        if (
          isMatrixSeries(current?.series?.[0])
          || isCategoryPieChart(current)
          || isGaugeChart(current)
          || isHorizontalBarChart(current)
          || compact !== compactTooltipRef.current
        ) {
          applyOption(instance, current);
        } else {
          instance.resize();
        }
      });
      resizeObserver.observe(containerRef.current);
    } catch (error) {
      setRenderError(error);
    }

    return () => {
      if (categoryFadeRef.current) {
        clearTimeout(categoryFadeRef.current);
        categoryFadeRef.current = null;
      }
      resizeObserver?.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [renderer, themeName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    try {
      applyOption(instance, effectiveOption, { clear: redraw });
      redrawComplete();
    } catch (error) {
      setRenderError(error);
    }
  }, [compactAxes, detailScale, effectiveOption, redraw, redrawComplete, themeName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !onChartEvent) return undefined;
    instance.on("click", onChartEvent);
    return () => {
      if (!instance.isDisposed()) instance.off("click", onChartEvent);
    };
  }, [onChartEvent, themeName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !isHorizontalBarChart(effectiveOption)) return undefined;

    const highlightRow = (params) => {
      if (instance.isDisposed() || params?.seriesType !== "bar"
        || !Number.isInteger(params?.dataIndex)) return;
      const batch = effectiveOption.series.reduce((items, series, seriesIndex) => {
        if (series.type === "bar") items.push({ dataIndex: params.dataIndex, seriesIndex });
        return items;
      }, []);
      instance.dispatchAction({ batch, type: "highlight" });
    };
    const clearRow = () => {
      if (!instance.isDisposed()) instance.dispatchAction({ type: "downplay" });
    };

    instance.on("mouseover", highlightRow);
    instance.on("mouseout", clearRow);
    instance.on("globalout", clearRow);
    return () => {
      if (instance.isDisposed()) return;
      instance.off("mouseover", highlightRow);
      instance.off("mouseout", clearRow);
      instance.off("globalout", clearRow);
    };
  }, [effectiveOption, themeName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !isCategoryPieChart(effectiveOption)) return undefined;

    const clearCategoryFade = () => {
      if (categoryFadeRef.current) {
        clearTimeout(categoryFadeRef.current);
        categoryFadeRef.current = null;
      }
    };
    const restoreTitleNow = () => {
      if (instance.isDisposed()) return;
      setActiveCategoryKey(null);
      instance.dispatchAction({ type: "downplay" });
      const container = containerRef.current;
      if (!container) return;
      const laidOut = applyChartLayout(
        optionRef.current,
        container.clientWidth,
        container.clientHeight,
        getTooltipColors(themeMode)
      );
      instance.setOption({ title: laidOut.title });
    };
    const restoreTitle = () => {
      clearCategoryFade();
      if (reducedMotion) {
        restoreTitleNow();
        return;
      }
      categoryFadeRef.current = setTimeout(restoreTitleNow, CATEGORY_FADE_DELAY_MS);
    };
    restoreCategoryRef.current = restoreTitle;

    const showSlice = (params) => {
      clearCategoryFade();
      if (instance.isDisposed()) return;
      const slice = getDoughnutSliceFromChart(instance, params);
      if (!slice) return;
      setActiveCategoryKey(getCategoryEventKey(params));
      const container = containerRef.current;
      if (!container) return;
      const laidOut = applyChartLayout(
        optionRef.current,
        container.clientWidth,
        container.clientHeight,
        getTooltipColors(themeMode)
      );
      const composition = resolveCategoryComposition({
        height: container.clientHeight,
        width: container.clientWidth,
      });
      if (composition === "micro"
        || (composition === "centered" && !isDoughnutChart(optionRef.current))) return;
      if (isCategoryBreakdown(composition) && !isDoughnutChart(optionRef.current)) return;
      instance.setOption({
        title: {
          ...laidOut.title,
          show: true,
          text: isCategoryBreakdown(composition)
            ? buildDoughnutValueTitle(slice.formattedValue || slice.value)
            : buildDoughnutHoverTitle(slice),
          textStyle: {
            ...laidOut.title?.textStyle,
            rich: {
              ...laidOut.title?.textStyle?.rich,
              marker: {
                ...laidOut.title?.textStyle?.rich?.marker,
                color: slice.color,
              },
            },
          },
        },
      });
    };

    instance.on("mouseover", showSlice);
    instance.on("mouseout", restoreTitle);
    instance.on("highlight", showSlice);
    instance.on("globalout", restoreTitle);
    return () => {
      clearCategoryFade();
      if (instance.isDisposed()) return;
      instance.off("mouseover", showSlice);
      instance.off("mouseout", restoreTitle);
      instance.off("highlight", showSlice);
      instance.off("globalout", restoreTitle);
    };
  }, [effectiveOption, reducedMotion, themeName]);

  const activateCategory = (item) => {
    const instance = instanceRef.current;
    if (!instance || instance.isDisposed()) return;
    if (categoryFadeRef.current) {
      clearTimeout(categoryFadeRef.current);
      categoryFadeRef.current = null;
    }
    setActiveCategoryKey(item.key);
    instance.dispatchAction({ type: "downplay" });
    instance.dispatchAction({
      dataIndex: item.dataIndex,
      seriesIndex: item.seriesIndex,
      type: "highlight",
    });
  };

  const deactivateCategory = () => {
    restoreCategoryRef.current();
  };

  if (renderError) throw renderError;

  return (
    <div className="relative h-full min-h-0 w-full" data-echarts-renderer={renderer}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        role="img"
        aria-label={ariaLabel}
      />
      {isCategoryBreakdown(categoryComposition) && categoryItems.length > 0 && (
        <CategoryBreakdown
          activeKey={activeCategoryKey}
          composition={categoryComposition}
          items={categoryItems}
          onActivate={activateCategory}
          onDeactivate={deactivateCategory}
        />
      )}
    </div>
  );
}

EChartsRenderer.propTypes = {
  ariaLabel: PropTypes.string,
  compactAxes: PropTypes.bool,
  detailScale: PropTypes.number,
  onChartEvent: PropTypes.func,
  option: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  renderer: PropTypes.oneOf(["canvas", "svg"]),
  theme: PropTypes.oneOf(["light", "dark"]),
};

export default EChartsRenderer;
