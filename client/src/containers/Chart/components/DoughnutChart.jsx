import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Doughnut } from "react-chartjs-2";
import { semanticColors } from "../../../lib/themeTokens";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { cloneDeep } from "lodash";

import ChartErrorBoundary from "./ChartErrorBoundary";
import { useTheme } from "../../../modules/ThemeContext";
import {
  formatValueWithFormula,
  getTooltipFormulas,
  tooltipPlugin,
} from "./ChartTooltip";
import { chartColors } from "../../../config/colors";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

function toFiniteNumber(value) {
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatChartNumber(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 20 });
}

function getVisibleDatasetTotal(chartInstance, dataset) {
  return dataset.data.reduce((total, value, index) => {
    if (!chartInstance.getDataVisibility(index)) return total;
    return total + (toFiniteNumber(value) || 0);
  }, 0);
}

function getVisibleChartTotal(chartInstance) {
  return chartInstance.data.datasets.reduce((total, dataset, datasetIndex) => {
    if (!chartInstance.isDatasetVisible(datasetIndex)) return total;
    return total + getVisibleDatasetTotal(chartInstance, dataset);
  }, 0);
}

function getDataLabelsPlugin(format, formulas) {
  return {
    color: "#fff",
    font: {
      size: 10,
      family: "Inter",
    },
    padding: 4,
    formatter: (value, context) => {
      const formattedValue = toFiniteNumber(value);
      if (formattedValue === null) return "";

      if (format === "value") {
        return formatValueWithFormula(
          formatChartNumber(formattedValue),
          formulas[context.datasetIndex]
        );
      }

      const total = getVisibleDatasetTotal(context.chart, context.dataset);
      if (total === 0) return "0%";
      return `${((formattedValue / total) * 100).toFixed(2)}%`;
    },
    display(context) {
      const { dataset } = context;
      const count = dataset.data.length;
      const value = toFiniteNumber(dataset.data[context.dataIndex]);
      return value !== null && value > count * 1.5;
    },
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 4,
  };
}

const doughnutCenterTotalPlugin = {
  id: "doughnutCenterTotal",
  afterDatasetsDraw(chartInstance, _args, options) {
    const meta = chartInstance.data.datasets
      .map((_, index) => chartInstance.getDatasetMeta(index))
      .find((datasetMeta) => datasetMeta.data.length > 0);
    const firstArc = meta?.data?.[0];
    if (!firstArc?.innerRadius) return;

    const total = getVisibleChartTotal(chartInstance);
    const value = formatValueWithFormula(formatChartNumber(total), options.formula);
    const { ctx } = chartInstance;
    const { x, y, innerRadius } = firstArc;
    const maxTextWidth = innerRadius * 1.65;
    const preferredFontSize = Math.min(28, Math.max(12, innerRadius * 0.34));
    let fontSize = preferredFontSize;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${fontSize}px Inter`;
    while (fontSize > 10 && ctx.measureText(value).width > maxTextWidth) {
      fontSize -= 1;
      ctx.font = `600 ${fontSize}px Inter`;
    }

    const showLabel = innerRadius >= 28;
    ctx.fillStyle = options.color;
    ctx.fillText(value, x, showLabel ? y + (fontSize * 0.25) : y, maxTextWidth);

    if (showLabel) {
      ctx.fillStyle = options.labelColor;
      ctx.font = `500 ${Math.min(11, Math.max(9, innerRadius * 0.14))}px Inter`;
      ctx.fillText("Total", x, y - (fontSize * 0.65), maxTextWidth);
    }
    ctx.restore();
  },
};

function getChartSurfaceColor(context, fallback) {
  let element = context?.chart?.canvas;
  while (element) {
    const color = globalThis.getComputedStyle?.(element).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
    element = element.parentElement;
  }
  return fallback;
}

function DoughnutChart(props) {
  const {
    chart, redraw, redrawComplete,
  } = props;

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";

  const _getChartOptions = () => {
    // add any dynamic changes to the chartJS options here
    if (chart.chartData?.options) {
      const newOptions = cloneDeep(chart.chartData.options);
      if (newOptions.plugins?.legend?.labels) {
        newOptions.plugins.legend.labels.color = semanticColors[theme].foreground.DEFAULT;
      }

      // Add tooltip configuration
      const tooltipFormulas = getTooltipFormulas(chart);
      const formulas = Object.values(tooltipFormulas);
      const centerFormula = formulas.length > 0
        && formulas[0]
        && formulas.every((formula) => formula === formulas[0])
        ? formulas[0]
        : null;
      newOptions.plugins = {
        ...newOptions.plugins,
        tooltip: {
          ...tooltipPlugin,
          formulas: tooltipFormulas,
          isCategoryChart: true,
        },
        doughnutCenterTotal: {
          color: semanticColors[theme].foreground.DEFAULT,
          labelColor: semanticColors[theme].foreground[500],
          formula: centerFormula,
        },
      };

      // Add datalabels plugin
      const dataLabelsFormat = chart.visualization?.settings?.dataLabelsFormat || "percentage";
      newOptions.plugins.datalabels = chart?.dataLabels
        ? getDataLabelsPlugin(dataLabelsFormat, tooltipFormulas)
        : { formatter: () => "" };

      return newOptions;
    }

    return chart.chartData?.options;
  };

  // Add cleanup effect
  useEffect(() => {
    return () => {
      const tooltipEl = document.getElementById("chartjs-tooltip");
      if (tooltipEl) {
        tooltipEl.remove();
      }
    };
  }, []);

  const _getChartData = () => {
    const data = cloneDeep(chart.chartData.data);
    if (!data) return null;

    // Get number of segments
    const numSegments = data.labels?.length || 0;
    if (numSegments === 0) return data;

    // Ensure backgroundColor array exists and has enough colors
    data.datasets = data.datasets.map(dataset => {
      const surfaceFallback = semanticColors[theme].content1.DEFAULT;
      dataset.borderColor = (context) => getChartSurfaceColor(context, surfaceFallback);
      dataset.borderWidth = 2;
      dataset.hoverBorderColor = dataset.borderColor;
      dataset.hoverBorderWidth = 2;
      dataset.spacing = 0;

      // If dataset already has backgroundColor array, use it
      if (dataset.backgroundColor && Array.isArray(dataset.backgroundColor)) {
        return dataset;
      }

      const colors = Object.values(chartColors).map(c => c.hex);
      dataset.backgroundColor = Array(numSegments).fill().map((_, i) => {
        // If fillColor exists and is not transparent/null for this index, use it
        const existingColor = dataset.fillColor?.[i];
        if (existingColor && existingColor !== "transparent" && existingColor !== null) {
          return existingColor;
        }
        // Otherwise use chartColors in order
        return colors[i % colors.length];
      });

      return dataset;
    });

    return data;
  };

  return (
    <div className="h-full">
      {chart.chartData.data && chart.chartData.data.labels && (
        <ChartErrorBoundary>
          <Doughnut
            data={_getChartData()}
            options={_getChartOptions()}
            redraw={redraw}
            plugins={[ChartDataLabels, doughnutCenterTotalPlugin]}
          />
        </ChartErrorBoundary>
      )}
    </div>
  );
}

DoughnutChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
};

DoughnutChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default DoughnutChart;
