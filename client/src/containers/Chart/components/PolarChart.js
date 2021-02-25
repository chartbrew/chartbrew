import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Polar } from "react-chartjs-2";

function PolarChart(props) {
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
      <Polar
        data={chart.chartData.data}
        options={chart.chartData.options}
        height={height}
        redraw={redraw}
      />
    </div>
  );
}

PolarChart.defaultProps = {
  redraw: false,
  redrawComplete: () => { },
  height: 300,
};

PolarChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
};

export default PolarChart;
