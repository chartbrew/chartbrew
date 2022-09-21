import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Radar } from "react-chartjs-2";
import { useTheme } from "@nextui-org/react";

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
import ChartErrorBoundary from "./ChartErrorBoundary";

ChartJS.register(
  CategoryScale, RadialLinearScale, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

function RadarChart(props) {
  const {
    chart, redraw, redrawComplete, height
  } = props;

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  const { theme } = useTheme();

  const _getChartOptions = () => {
    // add any dynamic changes to the chartJS options here
    if (chart.chartData?.options) {
      const newOptions = { ...chart.chartData.options };

      if (newOptions.scales) {
        newOptions.scales = {
          r: {
            grid: {
              color: theme.colors.accents5.value,
            },
            angleLines: {
              color: theme.colors.accents5.value,
            },
            pointLabels: {
              color: theme.colors.accents9.value,
            },
          }
        };
      }
      if (newOptions.plugins?.legend?.labels) {
        newOptions.plugins.legend.labels.color = theme.colors.accents9.value;
      }

      return newOptions;
    }

    return chart.chartData?.options;
  };

  return (
    <div>
      {chart.chartData.data && chart.chartData.data.labels && (
        <ChartErrorBoundary>
          <Radar
            data={chart.chartData.data}
            options={_getChartOptions()}
            height={height - 10}
            redraw={redraw}
          />
        </ChartErrorBoundary>
      )}
    </div>
  );
}

RadarChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
  height: 300,
};

RadarChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
};

export default RadarChart;
