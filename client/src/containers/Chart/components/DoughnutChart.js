import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Doughnut } from "react-chartjs-2";

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

ChartJS.register(
  CategoryScale, LinearScale, PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

const dataLabelsPlugin = {
  // borderColor: "white",
  // borderRadius: 25,
  // borderWidth: 2,
  // color: "black",
  font: {
    weight: "bold",
  },
  padding: 3,
  formatter: Math.round
};

function DoughnutChart(props) {
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
        <Doughnut
          data={chart.chartData.data}
          options={{
            ...chart.chartData.options,
            plugins: {
              ...chart.chartData.options.plugins,
              datalabels: dataLabelsPlugin,
            },
          }}
          height={height}
          redraw={redraw}
          plugins={[ChartDataLabels]}
        />
      )}
    </div>
  );
}

DoughnutChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
  height: 300,
};

DoughnutChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
};

export default DoughnutChart;
