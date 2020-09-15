import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Bar } from "react-chartjs-2";
import { Statistic } from "semantic-ui-react";
import uuid from "uuid/v4";

function BarChart(props) {
  const { chart } = props;

  const [redraw, setRedraw] = useState(false);

  useEffect(() => {
    // force chartjs to update since it doesn't all the time
    setRedraw(true);

    setTimeout(() => {
      setRedraw(false);
    });
  }, [chart]);

  return (
    <>
      {chart.subType && chart.subType.indexOf("AddTimeseries") > -1 && chart.mode === "kpi"
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
        <Bar
          data={chart.chartData.data}
          options={chart.chartData.options}
          height={300}
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
};

BarChart.propTypes = {
  chart: PropTypes.object.isRequired,
};

export default BarChart;
