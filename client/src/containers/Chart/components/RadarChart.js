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

  return (
    <div>
      {chart.chartData.data && chart.chartData.data.labels && (
        <ChartErrorBoundary>
          <Radar
            data={chart.chartData.data}
            options={chart.chartData.options}
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
