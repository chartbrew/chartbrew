import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Doughnut } from "react-chartjs-2";
import { semanticColors } from "@heroui/react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from "chart.js";
import { cloneDeep } from "lodash";
import ChartDataLabels from "chartjs-plugin-datalabels";

import ChartErrorBoundary from "./ChartErrorBoundary";
import { useTheme } from "../../../modules/ThemeContext";
import { tooltipPlugin } from "./ChartTooltip";
import { chartColors } from "../../../config/colors";

ChartJS.register(ArcElement, Tooltip, ChartDataLabels);

function GaugeChart({ chart, redraw, redrawComplete }) {
  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";
  const containerRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setIsCompact(containerRef.current.offsetHeight < 200);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const _prepareData = () => {
    if (!chart.chartData?.data?.datasets?.[0]?.data) return null;

    const value = chart.chartData.data.datasets[0].data[chart.chartData.data.datasets[0].data.length - 1];
    const ranges = chart.ranges || [{ min: 0, max: 100, label: "Total" }];
    const maxValue = Math.max(...ranges.map(r => r.max));
    const minValue = Math.min(...ranges.map(r => r.min));
    
    // Calculate the percentage for each range
    const rangeData = ranges.map(range => {
      const rangeSize = range.max - range.min;
      return (rangeSize / maxValue) * 100;
    });

    // Get default colors array for initial setup
    const defaultColors = Object.values(chartColors).map(c => c.hex);

    // Calculate rotation to point to current value
    const clampedValue = Math.min(Math.max(value, minValue), maxValue);
    const valuePercentage = ((clampedValue - minValue) / (maxValue - minValue)) * 270 - 135;
    
    return {
      datasets: [{
        data: rangeData,
        backgroundColor: ranges.map((range, index) => 
          range.color || defaultColors[index % defaultColors.length]
        ),
        borderWidth: 0,
        circumference: 270,
        rotation: -135,
      }, {
        // This dataset creates the pointer
        data: [6, 98], // Small segment for the pointer
        backgroundColor: [
          semanticColors[theme].foreground.DEFAULT,
          "transparent"
        ],
        borderWidth: 0,
        circumference: 90,
        rotation: valuePercentage,
      }],
      labels: ranges.map(range => range.label || `${range.min}-${range.max}`),
    };
  };

  const _getChartOptions = () => {
    const baseOptions = cloneDeep(chart.chartData?.options || {});
    return {
      ...baseOptions,
      responsive: true,
      maintainAspectRatio: isCompact,
      animation: {
        onComplete: function(animation) {
          // Only run once by checking if animation is the first one
          if (animation.initial) {
            // Force a dataset update to recalculate label rotations
            this.update();
          }
        }
      },
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
                const range = chart.ranges?.[context.dataIndex];
                if (range) {
                  return `${range.label || ""}: ${range.min} - ${range.max}`;
                }
              }
              return "";
            },
          },
        },
        legend: {
          display: isCompact ? false : !!chart.displayLegend,
          position: "top",
        },
        datalabels: {
          display: (context) => {
            return chart.dataLabels && !isCompact && context.datasetIndex === 0;
          },
          color: "#fff",
          font: {
            weight: "bold",
            size: 10,
            family: "Inter",
          },
          formatter: (value, context) => {
            if (context.datasetIndex === 0 && chart.ranges) {
              const range = chart.ranges?.[context.dataIndex];
              return `${range?.label || `${range?.min}-${range?.max}`}`;
            }
            return "";
          },
          anchor: "center",
          align: "center",
          offset: 0,
          padding: 4,
          backgroundColor: "rgba(0, 0, 0, 0.2)",
          borderRadius: 4,
          rotation: (context) => {
            // Calculate angle based on the segment's midpoint
            const chart = context.chart;
            const meta = chart.getDatasetMeta(context.datasetIndex);
            if (meta.data) {
              const arc = meta.data?.[context.dataIndex];
              const startAngle = arc.startAngle + Math.PI / 2; // Add PI/2 to account for chart rotation
              const endAngle = arc.endAngle + Math.PI / 2;
              const angle = (startAngle + endAngle) / 2;
              
              // Convert radians to degrees and adjust to keep text readable
              const degrees = (angle * 180) / Math.PI;
              return degrees > 90 && degrees < 270 ? degrees - 180 : degrees;
            }
            return 0;
          }
        },
      },
      scales: {}, // Add empty scales object to disable all axes
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

  const value = chart?.chartData?.data?.datasets?.[0]?.data?.[chart?.chartData?.data?.datasets?.[0]?.data?.length - 1];
  const label = chart?.chartData?.data?.datasets?.[0]?.label || "";

  return (
    <div ref={containerRef} className="h-full relative w-full flex flex-col items-center justify-center">
      {!isCompact && (
        <div className="w-full max-w-[600px] mx-auto h-full">
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
                {label}
              </div>
            </div>
          </ChartErrorBoundary>
        </div>
      )}

      {isCompact && (
        <div className="w-full h-full flex flex-row items-center justify-center mx-auto gap-4">
          <div className="flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-default-800">
              {value.toLocaleString()}
            </div>
            <div className="text-sm text-default-500">
              {label}
            </div>
          </div>

          <div className="h-full max-w-[200px] justify-center items-center">
            <ChartErrorBoundary>
              <Doughnut data={gaugeData} options={_getChartOptions()} redraw={redraw} />
            </ChartErrorBoundary>
          </div>
        </div>
      )}
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
