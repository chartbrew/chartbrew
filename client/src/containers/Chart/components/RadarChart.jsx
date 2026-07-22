import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  RadialLinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { semanticColors } from "../../../lib/themeTokens";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { cloneDeep } from "lodash";
import { tooltipPlugin } from "./ChartTooltip";

import ChartErrorBoundary from "./ChartErrorBoundary";
import { useTheme } from "../../../modules/ThemeContext";

const getDataLabelAngle = (context) => {
  const labelCount = context.chart.data.labels?.length || 1;
  return -90 + ((context.dataIndex * 360) / labelCount);
};

ChartJS.register(
  CategoryScale, RadialLinearScale, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

function RadarChart(props) {
  const {
    chart, redraw, redrawComplete,
  } = props;

  const { isDark } = useTheme();
  const theme = isDark ? "dark" : "light";

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
              color: semanticColors[theme].content3.DEFAULT,
            },
            angleLines: {
              color: semanticColors[theme].content3.DEFAULT,
            },
            pointLabels: {
              color: semanticColors[theme].foreground.DEFAULT,
            },
            ticks: {
              backdropColor: "transparent",
              display: false,
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
        datalabels: chart.dataLabels ? {
          color: semanticColors[theme].foreground.DEFAULT,
          display: "auto",
          font: {
            family: "Inter",
            size: 10,
          },
          formatter: Math.round,
          padding: 2,
          anchor: "center",
          align: getDataLabelAngle,
          offset: 0,
        } : { display: false },
        tooltip: {
          ...tooltipPlugin,
          isCategoryChart: true,
        },
      };

      return newOptions;
    }

    return chart.chartData?.options;
  };

  const _getChartData = () => {
    const data = cloneDeep(chart.chartData.data);
    if (!data?.datasets) return data;

    data.datasets = data.datasets.map((dataset) => ({
      ...dataset,
      datalabels: chart.dataLabels ? {
        ...(dataset.datalabels || {}),
        color: semanticColors[theme].foreground.DEFAULT,
        display: "auto",
        anchor: "center",
        align: getDataLabelAngle,
        offset: 4,
      } : { display: false },
    }));
    return data;
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

  return (
    <div className="h-full">
      {chart.chartData.data && chart.chartData.data.labels && (
        <ChartErrorBoundary>
          <Radar
            data={_getChartData()}
            options={_getChartOptions()}
            redraw={redraw}
            plugins={chart.dataLabels ? [ChartDataLabels] : []}
          />
        </ChartErrorBoundary>
      )}
    </div>
  );
}

RadarChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
};

RadarChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default RadarChart;
