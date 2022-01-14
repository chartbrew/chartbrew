import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Pie } from "react-chartjs-2";

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

ChartJS.register(
  CategoryScale, LinearScale, PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

function PieChart(props) {
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
        <Pie
          data={chart.chartData.data}
          options={chart.chartData.options}
          height={height}
          redraw={redraw}
        />
      )}
    </div>
  );
}

PieChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
  height: 300,
};

PieChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
};

export default PieChart;
