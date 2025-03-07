import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { PolarArea } from "react-chartjs-2";
import { semanticColors } from "@heroui/react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { cloneDeep } from "lodash";
import ChartDataLabels from "chartjs-plugin-datalabels";

import { tooltipPlugin } from "./ChartTooltip";
import ChartErrorBoundary from "./ChartErrorBoundary";
import { useTheme } from "../../../modules/ThemeContext";
import { chartColors } from "../../../config/colors";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

const dataLabelsPlugin = {
  color: "#fff",
  font: {
    weight: "bold",
    size: 10,
    family: "Inter",
  },
  padding: 2,
  formatter: (value, context) => {
    let formattedValue = value;
    try {
      formattedValue = parseFloat(value);
    } catch (e) {
      // do nothing
    }

    const hiddens = context.chart._hiddenIndices;
    let total = 0;
    const datapoints = context.dataset.data;
    datapoints.forEach((val, i) => {
      let formattedVal = val;
      try {
        formattedVal = parseFloat(val);
      } catch (e) {
        // do nothing
      }
      if (hiddens[i] !== undefined) {
        if (!hiddens[i]) {
          total += formattedVal;
        }
      } else {
        total += formattedVal;
      }
    });

    const percentage = `${((formattedValue / total) * 100).toFixed(2)}%`;
    const out = percentage;
    return out;
  },
  display(context) {
    const { dataset } = context;
    const count = dataset.data.length;
    const value = dataset.data[context.dataIndex];
    return value > count * 1.5;
  },
  backgroundColor: "rgba(0, 0, 0, 0.2)",
  borderRadius: 4,
};

function PolarChart(props) {
  const {
    chart, redraw, redrawComplete,
  } = props;

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";

  // Add cleanup effect
  useEffect(() => {
    return () => {
      const tooltipEl = document.getElementById("chartjs-tooltip");
      if (tooltipEl) {
        tooltipEl.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  const _getChartOptions = () => {
    // add any dynamic changes to the chartJS options here
    if (chart.chartData?.options) {
      const newOptions = cloneDeep(chart.chartData.options);

      if (newOptions.scales) {
        newOptions.scales = {
          r: {
            grid: {
              color: semanticColors[theme].content4.DEFAULT,
            },
            angleLines: {
              color: semanticColors[theme].content4.DEFAULT,
            },
            pointLabels: {
              color: semanticColors[theme].foreground.DEFAULT,
            },
          }
        };
      }
      if (newOptions.plugins?.legend?.labels) {
        newOptions.plugins.legend.labels.color = semanticColors[theme].foreground.DEFAULT;
      }

      // Add tooltip configuration
      newOptions.plugins = {
        ...newOptions.plugins,
        tooltip: {
          ...tooltipPlugin,
          isCategoryChart: true,
        },
      };

      // Add datalabels plugin
      newOptions.plugins.datalabels = chart?.dataLabels ? dataLabelsPlugin : { formatter: () => "" };

      return newOptions;
    }

    return chart.chartData?.options;
  };

  const _getChartData = () => {
    const data = cloneDeep(chart.chartData.data);
    if (!data) return null;

    // Get number of segments
    const numSegments = data.labels?.length || 0;
    if (numSegments === 0) return data;

    // Ensure backgroundColor array exists and has enough colors
    data.datasets = data.datasets.map(dataset => {
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
          <PolarArea
            data={_getChartData()}
            options={_getChartOptions()}
            redraw={redraw}
            plugins={[ChartDataLabels]}
          />
        </ChartErrorBoundary>
      )}
    </div>
  );
}

PolarChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
};

PolarChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default PolarChart;
