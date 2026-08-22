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
import { CanvasRenderer } from "echarts/renderers";

import { semanticColors } from "../../../lib/themeTokens";
import { useTheme } from "../../../modules/ThemeContext";
import { getResponsiveGeometry } from "../../../visualization/responsiveLayout";
import {
  buildDoughnutHoverTitle,
  buildDoughnutValueTitle,
  getDoughnutSliceFromChart,
  getEChartsTooltipOption,
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

const MATRIX_CELL_GAP = 3;
const MATRIX_GRID_INSET = {
  bottom: 24,
  left: 8,
  right: 40,
  top: 12,
};

function getMatrixCellLayout(width, height, columnCount, rowCount) {
  const columns = Math.max(1, columnCount);
  const rows = Math.max(1, rowCount);
  const availableWidth = Math.max(1, width - MATRIX_GRID_INSET.left - MATRIX_GRID_INSET.right);
  const availableHeight = Math.max(1, height - MATRIX_GRID_INSET.top - MATRIX_GRID_INSET.bottom);
  const cellSize = Math.max(1, Math.floor(Math.min(availableWidth / columns, availableHeight / rows)));
  const gridWidth = cellSize * columns;
  const gridHeight = cellSize * rows;
  return {
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

function isMatrixSeries(series) {
  return series?.type === "heatmap"
    || (series?.type === "scatter" && series?.symbol === "roundRect");
}

const TIGHT_MAX_HEIGHT = 220;
const TIGHT_MAX_WIDTH = 320;

function isTightContainer(width, height) {
  return height <= TIGHT_MAX_HEIGHT || width <= TIGHT_MAX_WIDTH;
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

function getDoughnutValueText(title) {
  return `${title?.text || ""}`.match(/\{value\|[^}]+\}/)?.[0] || title?.text;
}

function applyMatrixLayout(option, width, height) {
  const series = option?.series?.[0];
  if (!isMatrixSeries(series)) return option;
  const columns = option.xAxis?.data?.length || 1;
  const rows = option.yAxis?.data?.length || 1;
  const layout = getMatrixCellLayout(width, height, columns, rows);
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
  };
}

function applyDoughnutLayout(option, width, height) {
  if (!isDoughnutChart(option) || width < 10 || height < 10) return option;
  const tight = isTightContainer(width, height);
  const legendVisible = !tight && option.legend?.show !== false;
  const legendHeight = legendVisible
    ? Math.min(36, Math.max(0, Math.round(height * 0.12)))
    : 0;
  const centerX = Math.round(width / 2);
  const centerY = Math.round(legendHeight + Math.max(1, height - legendHeight) / 2);
  const rest = { ...option };
  delete rest.media;
  return {
    ...rest,
    legend: tight ? { ...option.legend, show: false } : option.legend,
    tooltip: { ...option.tooltip, show: tight },
    series: option.series.map((item) => (
      item.type === "pie" ? {
        ...item,
        center: [centerX, centerY],
        ...(tight ? { label: { ...item.label, show: false } } : {}),
      } : item
    )),
    title: option.title ? {
      ...option.title,
      left: centerX,
      textAlign: "center",
      textVerticalAlign: "middle",
      top: centerY,
      ...(tight ? { text: getDoughnutValueText(option.title) } : {}),
      textStyle: {
        ...option.title.textStyle,
        rich: {
          ...option.title.textStyle?.rich,
          value: {
            ...option.title.textStyle?.rich?.value,
            fontFamily: "Inter Tight, sans-serif",
            fontWeight: 700,
            ...(tight ? { fontSize: 16, lineHeight: 20 } : {}),
          },
          percent: {
            ...option.title.textStyle?.rich?.percent,
            fontFamily: "Inter Tight, sans-serif",
            fontWeight: 700,
            ...(tight ? { fontSize: 9, lineHeight: 12 } : {}),
          },
        },
      },
    } : option.title,
  };
}

function applyChartLayout(option, width, height) {
  return applyDoughnutLayout(applyMatrixLayout(option, width, height), width, height);
}

function EChartsRenderer({
  ariaLabel,
  onChartEvent,
  option,
  redraw,
  redrawComplete,
}) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const compactTooltipRef = useRef(false);
  const [renderError, setRenderError] = useState(null);
  const { isDark } = useTheme();
  const themeMode = isDark ? "dark" : "light";
  const themeName = `chartbrew-${themeMode}`;
  const reducedMotion = useMemo(() => {
    return typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const effectiveOption = useMemo(() => {
    const colors = semanticColors[themeMode];
    return {
      ...option,
      ...(reducedMotion ? { animation: false } : {}),
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
  }, [option, reducedMotion, themeMode]);
  const optionRef = useRef(effectiveOption);
  optionRef.current = effectiveOption;

  const applyOption = (instance, nextOption, { clear = false } = {}) => {
    const container = containerRef.current;
    if (!instance || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const compact = isCompactTooltipLayout(width, height);
    compactTooltipRef.current = compact;
    const laidOut = applyChartLayout({
      ...nextOption,
      tooltip: getEChartsTooltipOption(nextOption, getTooltipColors(themeMode), { compact }),
    }, width, height);
    if (clear) instance.clear();
    instance.setOption(laidOut, { lazyUpdate: false, notMerge: true });
    instance.resize();
  };

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let resizeObserver;
    try {
      const instance = echarts.init(containerRef.current, themeName, { renderer: "canvas" });
      instanceRef.current = instance;
      resizeObserver = new ResizeObserver(() => {
        const current = optionRef.current;
        const container = containerRef.current;
        const compact = container
          ? isCompactTooltipLayout(container.clientWidth, container.clientHeight)
          : false;
        if (
          isMatrixSeries(current?.series?.[0])
          || isDoughnutChart(current)
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
      resizeObserver?.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [themeName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    try {
      applyOption(instance, effectiveOption, { clear: redraw });
      redrawComplete();
    } catch (error) {
      setRenderError(error);
    }
  }, [effectiveOption, redraw, redrawComplete, themeName]);

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
    if (!instance || !isDoughnutChart(effectiveOption)) return undefined;

    const restoreTitle = () => {
      if (instance.isDisposed()) return;
      const container = containerRef.current;
      if (!container) return;
      const laidOut = applyChartLayout(
        optionRef.current,
        container.clientWidth,
        container.clientHeight
      );
      instance.setOption({ title: laidOut.title });
    };

    const showSlice = (params) => {
      if (instance.isDisposed()) return;
      const slice = getDoughnutSliceFromChart(instance, params);
      if (!slice) return;
      const container = containerRef.current;
      if (!container) return;
      const laidOut = applyChartLayout(
        optionRef.current,
        container.clientWidth,
        container.clientHeight
      );
      const tight = isTightContainer(container.clientWidth, container.clientHeight);
      instance.setOption({
        title: {
          ...laidOut.title,
          text: tight
            ? buildDoughnutValueTitle(slice.value)
            : buildDoughnutHoverTitle(slice),
        },
      });
    };

    instance.on("mouseover", showSlice);
    instance.on("highlight", showSlice);
    instance.on("globalout", restoreTitle);
    return () => {
      if (instance.isDisposed()) return;
      instance.off("mouseover", showSlice);
      instance.off("highlight", showSlice);
      instance.off("globalout", restoreTitle);
    };
  }, [effectiveOption, themeName]);

  if (renderError) throw renderError;

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 w-full"
      role="img"
      aria-label={ariaLabel}
    />
  );
}

EChartsRenderer.defaultProps = {
  ariaLabel: "Chart",
  onChartEvent: null,
  redraw: false,
  redrawComplete: () => {},
};

EChartsRenderer.propTypes = {
  ariaLabel: PropTypes.string,
  onChartEvent: PropTypes.func,
  option: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default EChartsRenderer;
