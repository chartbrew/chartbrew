import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Radar } from "react-chartjs-2";

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
      <Radar
        data={chart.chartData.data}
        options={chart.chartData.options}
        height={height}
        redraw={redraw}
      />
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
