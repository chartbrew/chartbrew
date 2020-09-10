import React from "react";
import PropTypes from "prop-types";
import { Line } from "react-chartjs-2";
import { Statistic } from "semantic-ui-react";
import uuid from "uuid/v4";

function LineChart(props) {
  const { chart } = props;

  return (
    <>
      {chart.subType && chart.subType.indexOf("AddTimeseries") > -1 && chart.mode === "kpi"
        && (
          <div style={styles.kpiArea}>
            {chart.chartData
              && chart.chartData.data
              && chart.chartData.data.datasets && (
                <div style={styles.kpiContainer}>
                  <Statistic.Group
                    widths={chart.chartData.data.datasets.length}
                    style={styles.kpiGroup}
                  >
                    {chart.chartData.data.datasets.map((dataset) => (
                      <Statistic key={uuid()}>
                        <Statistic.Value>
                          {dataset.data[dataset.data.length - 1]}
                        </Statistic.Value>
                        <Statistic.Label>{dataset.label}</Statistic.Label>
                      </Statistic>
                    ))}
                  </Statistic.Group>
                </div>
            )}
          </div>
        )}
      <div className={
        (chart.subType.indexOf("AddTimeseries") > -1 && chart.mode === "kpi")
        && "chart-kpi"
      }>
        <Line
          data={chart.chartData.data}
          options={chart.chartData.options}
          height={300}
        />
      </div>
    </>
  );
}

const styles = {
  kpiContainer: {
    position: "absolute",
    left: "50%",
    top: "30%",
    width: "100%",
  },
  kpiGroup: {
    position: "relative",
    left: "-50%",
    top: "-30%",
    width: "100%",
  },
};

LineChart.propTypes = {
  chart: PropTypes.object.isRequired,
};

export default LineChart;
