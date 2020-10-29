import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Bar } from "react-chartjs-2";
import { Statistic } from "semantic-ui-react";
import uuid from "uuid/v4";

function BarChart(props) {
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
    <>
      {chart.mode === "kpi"
        && (
          <div>
            {chart.chartData
              && chart.chartData.data
              && chart.chartData.data.datasets && (
                <div style={styles.kpiContainer}>
                  <Statistic.Group
                    widths={chart.chartData.data.datasets.length}
                    style={styles.kpiGroup(chart.chartSize)}
                    size={
                      (chart.chartSize > 1
                        || (chart.chartSize === 1 && chart.chartData.data.datasets.length < 3))
                      && "large"
                    }
                    horizontal={chart.chartSize === 1}
                  >
                    {chart.chartData.data.datasets.map((dataset, index) => (
                      <Statistic key={uuid()}>
                        <Statistic.Value>
                          {dataset.data && dataset.data[dataset.data.length - 1]}
                        </Statistic.Value>
                        <Statistic.Label>
                          <span
                            style={
                              chart.Datasets
                              && styles.datasetLabelColor(chart.Datasets[index].datasetColor)
                            }
                          >
                            {dataset.label}
                          </span>
                        </Statistic.Label>
                      </Statistic>
                    ))}
                  </Statistic.Group>
                </div>
            )}
          </div>
        )}
      <div className={chart.mode === "kpi" && "chart-kpi"}>
        <Bar
          data={chart.chartData.data}
          options={chart.chartData.options}
          height={height}
          redraw={redraw}
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
  kpiGroup: (size) => ({
    position: "relative",
    left: size === 1 ? "-20%" : "-50%",
    top: "-30%",
    width: "100%",
  }),
  datasetLabelColor: (color) => ({
    borderBottom: `solid 3px ${color}`,
  }),
};

BarChart.defaultProps = {
  redraw: false,
  redrawComplete: () => {},
  height: 300,
};

BarChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
};

export default BarChart;
