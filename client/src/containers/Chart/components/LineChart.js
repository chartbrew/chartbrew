import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Line } from "react-chartjs-2";

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

import {
  Container, Grid, Row, Spacer, Text, Tooltip as TooltipNext,
} from "@nextui-org/react";
import { ChevronDownCircle, ChevronUpCircle } from "react-iconly";

import determineType from "../../../modules/determineType";
import KpiChartSegment from "./KpiChartSegment";
import { negative, positive } from "../../../config/colors";
import ChartErrorBoundary from "./ChartErrorBoundary";

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

  const _renderGrowth = (c) => {
    if (!c) return (<span />);
    const { status, comparison } = c;
    return (
      <div>
        <TooltipNext content={`compared to last ${chart.timeInterval}`}>
          <Container fluid>
            {status === "neutral" && (
              <Text b css={{ color: "$accents6" }}>{`${comparison}%`}</Text>
            )}
            {status === "negative" && (
              <Row align="center">
                <ChevronDownCircle size="small" primaryColor={negative} />
                <Spacer x={0.1} />
                <Text b css={{ color: "$errorLightContrast" }}>{` ${comparison}%`}</Text>
              </Row>
            )}
            {status === "positive" && (
              <Row align="center">
                <ChevronUpCircle size="small" primaryColor={positive} />
                <Text b css={{ color: "$successLightContrast" }}>{` ${comparison}%`}</Text>
              </Row>
            )}
          </Container>
        </TooltipNext>
      </div>
    );
  };

  return (
    <>
      {chart.mode === "kpi" && chart.chartData && chart.chartData.data
        && chart.chartData.data.datasets && (
          <div style={styles.kpiContainer}>
            <Grid.Container justify="center" gap={1} alignContent="center" alignItems="center">
              {chart.chartData.data.datasets.map((dataset, index) => (
                <Grid
                  xs={12}
                  sm={chart.chartSize === 1 ? 12 : 4}
                  md={chart.chartSize === 1 ? 12 : 4}
                  lg={chart.chartSize === 1 ? 6 : 2}
                  key={dataset.label}
                  alignContent="center"
                  alignItems="center"
                >
                  <Container fluid justify="center" alignContent="center" alignItems="center">
                    <Row justify="center" align="center">
                      <Text
                        b
                        size={chart.chartSize === 1 ? "2.4em" : "2.6em"}
                        key={uuid()}
                      >
                        {dataset.data && _getKpi(dataset.data)}
                      </Text>
                    </Row>

                    {chart.Datasets[index] && (
                      <Row justify="center" align="center">
                        <Text style={{ marginTop: chart.showGrowth ? -5 : 0, textAlign: "center" }}>
                          {chart.showGrowth && chart.chartData.growth && (
                            _renderGrowth(chart.chartData.growth[index])
                          )}
                          <span
                            style={
                                chart.Datasets
                                && styles.datasetLabelColor(chart.Datasets[index].datasetColor)
                              }
                            >
                            {dataset.label}
                          </span>
                        </Text>
                      </Row>
                    )}
                  </Container>
                </Grid>
              ))}
            </Grid.Container>
          </div>
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

const styles = {
  kpiContainer: {
    height: 300, display: "flex", justifyContent: "center", alignItems: "center"
  },
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
