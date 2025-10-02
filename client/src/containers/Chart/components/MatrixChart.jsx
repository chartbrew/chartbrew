import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, TimeScale, Title, Tooltip, Legend,
} from "chart.js";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import "chartjs-adapter-date-fns";
import { semanticColors } from "@heroui/react";
import { cloneDeep } from "lodash";

import ChartErrorBoundary from "./ChartErrorBoundary";
import { useTheme } from "../../../modules/ThemeContext";
import { tooltipPlugin } from "./ChartTooltip";

ChartJS.register(CategoryScale, LinearScale, TimeScale, Title, Tooltip, Legend, MatrixController, MatrixElement);

function MatrixChart(props) {
  const { chart, redraw, redrawComplete } = props;

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";
  const chartRef = useRef(null);

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  useEffect(() => {
    return () => {
      const tooltipEl = document.getElementById("chartjs-tooltip");
      if (tooltipEl) {
        tooltipEl.remove();
      }
    };
  }, []);

  const _getChartOptions = () => {
    if (!chart?.chartData?.options) return chart?.chartData?.options;

    const newOptions = cloneDeep(chart.chartData.options);

    newOptions.plugins = newOptions.plugins || {};

    if (newOptions.scales?.x?.grid) {
      newOptions.scales.x.grid.color = semanticColors[theme].content3.DEFAULT;
    }
    if (newOptions.scales?.y?.grid) {
      newOptions.scales.y.grid.color = semanticColors[theme].content3.DEFAULT;
    }
    if (newOptions.scales?.x?.ticks) {
      newOptions.scales.x.ticks.color = semanticColors[theme].foreground.DEFAULT;
    }
    if (newOptions.scales?.y?.ticks) {
      newOptions.scales.y.ticks.color = semanticColors[theme].foreground.DEFAULT;
    }
    if (newOptions.plugins?.legend?.labels) {
      newOptions.plugins.legend.labels.color = semanticColors[theme].foreground.DEFAULT;
    }

    newOptions.plugins = {
      ...newOptions.plugins,
      tooltip: {
        ...tooltipPlugin,
        displayColors: false,
        callbacks: {
          title(context) {
            // Show the date as the title
            if (context && context[0]) {
              const point = context[0].raw || context[0].dataset.data[context[0].dataIndex];
              return point?.d || "";
            }
            return "";
          },
          label(context) {
            const point = context.raw || context.dataset.data[context.dataIndex];
            if (!point) return "";
            
            // Return in the format "label: value" that ChartTooltip expects
            const value = typeof point.v === "number" ? point.v : parseFloat(point.v) || 0;
            return `${context.dataset.label}: ${value}`;
          }
        }
      },
      // Globally registered ChartDataLabels (from other charts) was drawing
      // "x: n, y: n, v: n" boxes on each cell. Disable it for matrix.
      datalabels: {
        display: false,
      },
    };

    return newOptions;
  };

  const _getChartData = () => {
    if (!chart?.chartData?.data) return null;
    
    const data = cloneDeep(chart.chartData.data);
    
    // Apply scriptable functions to matrix datasets
    if (data.datasets && data.datasets.length > 0) {
      data.datasets.forEach((dataset) => {
        if (dataset.type === "matrix" && dataset._meta) {
          const { datasetColor, domainMin, domainMax, xCount, yCount } = dataset._meta;
          
          // Helper to normalize a value
          const normalize = (value, min, max) => {
            if (min === max) return 0;
            if (value === undefined || value === null || Number.isNaN(Number(value))) return 0;
            const v = Number(value);
            return Math.max(0, Math.min(1, (v - min) / (max - min)));
          };
          
          // Helper to convert hex to RGB
          const hexToRgb = (hex) => {
            const h = hex.replace("#", "");
            const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
            return {
              r: (bigint >> 16) & 255,
              g: (bigint >> 8) & 255,
              b: bigint & 255,
            };
          };
          
          // Apply backgroundColor
          dataset.backgroundColor = (ctx) => {
            const v = ctx?.raw?.v;
            if (v === 0 || v === null || v === undefined) {
              // Very light color for empty cells - use a tint of the primary color
              try {
                const rgb = hexToRgb(datasetColor || "#3b82f6");
                return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
              } catch (e) {
                return "rgba(59, 130, 246, 0.08)";
              }
            }
            const t = normalize(v, domainMin, domainMax);
            const alpha = 0.2 + (t * 0.7); // Range from 0.2 to 0.9
            try {
              const rgb = hexToRgb(datasetColor || "#3b82f6");
              return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            } catch (e) {
              return `rgba(59, 130, 246, ${alpha})`;
            }
          };
          
          // Apply borderColor
          dataset.borderColor = (ctx) => {
            const v = ctx?.raw?.v;
            if (v === 0 || v === null || v === undefined) {
              // Light border for empty cells
              try {
                const rgb = hexToRgb(datasetColor || "#3b82f6");
                return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
              } catch (e) {
                return "rgba(59, 130, 246, 0.15)";
              }
            }
            const t = normalize(v, domainMin, domainMax);
            const alpha = 0.3 + (t * 0.6); // Range from 0.3 to 0.9
            try {
              const rgb = hexToRgb(datasetColor || "#3b82f6");
              return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            } catch (e) {
              return `rgba(59, 130, 246, ${alpha})`;
            }
          };
          
          // Apply width with padding between cells
          dataset.width = (ctx) => {
            const a = ctx.chart.chartArea || {};
            const cellPadding = 2; // Padding between cells
            return (a.right - a.left) / xCount - cellPadding;
          };
          
          // Apply height with padding between cells
          dataset.height = (ctx) => {
            const a = ctx.chart.chartArea || {};
            const cellPadding = 2; // Padding between cells
            return (a.bottom - a.top) / yCount - cellPadding;
          };
          
          // Apply hover colors
          dataset.hoverBackgroundColor = "#64CFF5";
          dataset.hoverBorderColor = "#048BDE";
          
          // Clean up metadata
          delete dataset._meta;
        }
      });
    }
    
    return data;
  };

  return (
    <>
      {chart.chartData && chart.chartData.data && (
        <div className="h-full" ref={chartRef}>
          <div className={"h-full"}>
            <ChartErrorBoundary>
              <Chart type="matrix" data={_getChartData()} options={_getChartOptions()} redraw={redraw} />
            </ChartErrorBoundary>
          </div>
        </div>
      )}
    </>
  );
}

MatrixChart.defaultProps = {
  redraw: false,
  redrawComplete: () => {},
};

MatrixChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default MatrixChart;

