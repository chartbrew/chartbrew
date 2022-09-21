import React from "react";
import PropTypes from "prop-types";
import {
  Container, Row, Spacer, Text, Tooltip,
} from "@nextui-org/react";
import { ChevronDownCircle, ChevronUpCircle } from "react-iconly";

import determineType from "../../../modules/determineType";
import { negative, positive } from "../../../config/colors";

function KpiMode(props) {
  const { chart } = props;

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
        <Tooltip content={`compared to last ${chart.timeInterval}`}>
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
        </Tooltip>
      </div>
    );
  };

  return (
    <Container
      css={{
        height: 300,
        pl: 0,
        pr: 0,
      }}
      justify="center"
      alignContent="center"
      alignItems="center"
    >
      <Row wrap="wrap" justify="space-around" align="center" css={{ height: "100%" }}>
        {chart.chartData.data.datasets.map((dataset, index) => (
          <div key={dataset.label} style={{ padding: 10 }}>
            <Row justify="center" align="center">
              <Text
                b
                size={chart.chartSize === 1 ? "2.4em" : "2.6em"}
                key={dataset.label}
              >
                {dataset.data && _getKpi(dataset.data)?.toLocaleString()}
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
          </div>
        ))}
      </Row>
    </Container>
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

KpiMode.propTypes = {
  chart: PropTypes.object.isRequired,
};

export default KpiMode;
