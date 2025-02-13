import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Doughnut } from "react-chartjs-2";
import { semanticColors } from "@heroui/react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from "chart.js";
import { cloneDeep } from "lodash";

import ChartErrorBoundary from "./ChartErrorBoundary";
import { useTheme } from "../../../modules/ThemeContext";
import { tooltipPlugin } from "./ChartTooltip";
import { chartColors } from "../../../config/colors";

ChartJS.register(ArcElement, Tooltip);

function GaugeChart({ chart, redraw, redrawComplete }) {
  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  const _prepareData = () => {
    if (!chart.chartData?.data?.datasets?.[0]?.data) return null;

    const value = chart.chartData.data.datasets[0].data[chart.chartData.data.datasets[0].data.length - 1];
    const ranges = chart.ranges || [{ min: 0, max: 100 }];
    const maxValue = Math.max(...ranges.map(r => r.max));
    
    // Calculate the percentage for each range
    const rangeData = ranges.map(range => {
      const rangeSize = range.max - range.min;
      return (rangeSize / maxValue) * 100;
    });

    // Get colors from ChartDatasetConfig if available
    const config = chart.ChartDatasetConfigs?.[0];
    const useMultiFillColors = config?.multiFill && Array.isArray(config?.fillColor);

    // Get default colors array
    const defaultColors = Object.values(chartColors).map(c => c.hex);

    // Calculate rotation to point to current value
    const valuePercentage = (value / maxValue) * 180; // 180 degrees total rotation
    
    return {
      datasets: [{
        data: rangeData,
        backgroundColor: ranges.map((range, index) => 
          range.color || 
          (useMultiFillColors && config.fillColor[index]) ||
          chart.ChartDatasetConfigs?.[index]?.datasetColor || 
          defaultColors[index % defaultColors.length]
        ),
        borderWidth: 0,
        circumference: 180,
        rotation: -90,
      }, {
        // This dataset creates the pointer
        data: [6, 98], // Small segment for the pointer
        backgroundColor: [
          semanticColors[theme].foreground.DEFAULT,
          "transparent"
        ],
        borderWidth: 0,
        circumference: 90,
        rotation: -90 + valuePercentage,
      }],
      labels: ranges.map(range => range.label || `${range.min}-${range.max}`),
    };
  };

  const _getChartOptions = () => {
    const baseOptions = cloneDeep(chart.chartData?.options || {});
    return {
      ...baseOptions,
      responsive: true,
      plugins: {
        tooltip: {
          ...tooltipPlugin,
          isCategoryChart: true,
          enabled: false,
          external: function(context) {
            // Don't show tooltip if hovering over the indicator dataset
            if (context.tooltip?.dataPoints?.[0]?.datasetIndex === 1) {
              return;
            }
            tooltipPlugin.external(context);
          },
          callbacks: {
            title: () => "",
            label: (context) => {
              // Only show tooltip for the first dataset (the ranges)
              if (context.datasetIndex === 0) {
                const range = chart.ranges[context.dataIndex];
                if (range) {
                  return `${range.label || ""}: ${range.min} - ${range.max}`;
                }
              }
              return "";
            },
          },
        },
        legend: {
          display: !!chart.displayLegend,
          position: "bottom",
        },
      },
      layout: {
      },
      cutout: "55%",
      events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"], // ensure all events are captured
    };
  };

  // Cleanup tooltip
  useEffect(() => {
    return () => {
      const tooltipEl = document.getElementById("chartjs-tooltip");
      if (tooltipEl) {
        tooltipEl.remove();
      }
    };
  }, []);

  const gaugeData = _prepareData();
  if (!gaugeData) return null;

  const value = chart.chartData.data.datasets[0].data[chart.chartData.data.datasets[0].data.length - 1];

  return (
    <div className="h-full w-full relative flex flex-col items-center justify-center">
      <div className="w-full max-w-[600px] mx-auto">
        <ChartErrorBoundary>
          <Doughnut
            data={gaugeData}
            options={_getChartOptions()}
            redraw={redraw}
          />
          <div className="absolute top-1/2 left-0 right-0 text-center">
            <div className="text-3xl font-bold text-default-800">
              {value.toLocaleString()}
            </div>
            <div className="text-sm text-default-500">
              {chart.chartData.data.datasets[0].label}
            </div>
          </div>
        </ChartErrorBoundary>
      </div>
    </div>
  );
}

GaugeChart.defaultProps = {
  redraw: false,
  redrawComplete: () => {},
};

GaugeChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default GaugeChart;
