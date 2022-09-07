import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Line } from "react-chartjs-2";
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

import KpiChartSegment from "./KpiChartSegment";
import ChartErrorBoundary from "./ChartErrorBoundary";
import KpiMode from "./KpiMode";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

function LineChart(props) {
  const {
    chart, redraw, redrawComplete, height, editMode,
  } = props;

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  return (
    <>
      {chart.mode === "kpi"
        && chart.chartData
        && chart.chartData.data
        && chart.chartData.data.datasets
        && (
          <KpiMode chart={chart} />
        )}

      {chart.mode !== "kpi" && chart.chartData && chart.chartData.data && (
        <div className={chart.mode === "kpi" && "chart-kpi"}>
          {chart.chartData.growth && chart.mode === "kpichart" && (
            <KpiChartSegment chart={chart} editMode={editMode} />
          )}
          {chart.chartData.data && chart.chartData.data.labels && (
            <div>
              <ChartErrorBoundary>
                <Line
                  data={chart.chartData.data}
                  options={chart.chartData.options}
                  height={
                    height - (
                      (chart.mode === "kpichart" && chart.chartSize > 1 && 80)
                      || (chart.mode === "kpichart" && chart.chartSize === 1 && 70)
                      || 0
                    )
                  }
                  redraw={redraw}
                />
              </ChartErrorBoundary>
            </div>
          )}
        </div>
      )}
    </>
  );
}

LineChart.defaultProps = {
  redraw: false,
  redrawComplete: () => {},
  height: 300,
  editMode: false,
};

LineChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
  editMode: PropTypes.bool,
};

export default LineChart;
