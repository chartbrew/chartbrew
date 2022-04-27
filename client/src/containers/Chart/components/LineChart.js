import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Line } from "react-chartjs-2";
import { Header } from "semantic-ui-react";

import uuid from "uuid/v4";
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

import determineType from "../../../modules/determineType";
import KpiChartSegment from "./KpiChartSegment";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

function LineChart(props) {
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

  const _getKpi = (data) => {
    if (data && Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i]
          && (determineType(data[i]) === "string"
          || determineType(data[i]) === "number"
          || determineType(data[i]) === "boolean")
        ) {
          return data[i];
        }
      }

      return `${data[data.length - 1]}`;
    }

    return `${data}`;
  };

  return (
    <>
      {chart.mode === "kpi"
        && (
          <div>
            {chart.chartData
              && chart.chartData.data
              && chart.chartData.data.datasets && (
                <div style={styles.kpiContainer(chart.chartSize)}>
                  {chart.chartData.data.datasets.map((dataset, index) => (
                    <Header
                      as="h1"
                      size="massive"
                      style={styles.kpiItem(
                        chart.chartSize,
                        chart.chartData.data.datasets.length,
                        index
                      )}
                      key={uuid()}
                    >
                      {dataset.data && _getKpi(dataset.data)}
                      {chart.Datasets[index] && (
                        <Header.Subheader style={{ color: "black" }}>
                          <span
                            style={
                              chart.Datasets
                              && styles.datasetLabelColor(chart.Datasets[index].datasetColor)
                            }
                          >
                            {dataset.label}
                          </span>
                        </Header.Subheader>
                      )}
                    </Header>
                  ))}
                </div>
            )}
          </div>
        )}
      <div className={chart.mode === "kpi" && "chart-kpi"}>
        {chart.chartData.growth && chart.mode === "kpichart" && (
          <KpiChartSegment chart={chart} />
        )}
        {chart.chartData.data && chart.chartData.data.labels && (
          <div>
            <Line
              data={chart.chartData.data}
              options={chart.chartData.options}
              height={height - ((chart.mode === "kpichart" && 80) || 0)}
              redraw={redraw}
            />
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  kpiContainer: (size) => ({
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: size === 1 ? "column" : "row",
  }),
  kpiItem: (size, items, index) => ({
    fontSize: size === 1 ? "2.5em" : "4em",
    textAlign: "center",
    margin: 0,
    marginBottom: size === 1 && index < items - 1 ? (50 - items * 10) : 0,
    marginRight: index < items - 1 && size > 1 ? (40 * size) - (items * 8) : 0,
  }),
  datasetLabelColor: (color) => ({
    borderBottom: `solid 3px ${color}`,
  }),
};

LineChart.defaultProps = {
  redraw: false,
  redrawComplete: () => {},
  height: 300,
};

LineChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
};

export default LineChart;
