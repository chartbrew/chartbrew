import React from "react";
import PropTypes from "prop-types";
import {
  Grid, Row, Spacer, Text, Tooltip, Container,
} from "@nextui-org/react";

import { ChevronDownCircle, ChevronUpCircle } from "react-iconly";
import { negative, positive } from "../../../config/colors";

function KpiChartSegment(props) {
  const { chart, editMode } = props;

  return (
    <Grid.Container>
      {chart.chartData.growth.map((c, index) => {
        if (chart.chartSize === 1 && index > 1) return (<span key={c.label} />);
        else if (editMode && index > 3) return (<span key={c.label} />);
        else if (chart.chartSize === 2 && index > 3) return (<span key={c.label} />);
        else if (chart.chartSize === 3 && index > 5) return (<span key={c.label} />);
        else if (chart.chartSize > 3 && index > 7) return (<span key={c.label} />);

        return (
          <Grid
            xs={6}
            sm={4}
            md={3}
            key={c.label}
            css={{ mr: 20 - (chart.chartData.growth.length * 2) }}
          >
            <Container fluid css={{ p: 0, pb: 10 }}>
              <Row align="center">
                <Text h4={chart.chartSize === 1} h3={chart.chartSize > 1}>
                  {`${c.value} `}
                </Text>
                <Spacer x={0.2} />
                {chart.showGrowth && (
                  <Tooltip content={`compared to last ${chart.timeInterval}`}>
                    {c.status === "neutral" && (
                      <Text size={"0.8em"}>{`${c.comparison}%`}</Text>
                    )}
                    {c.status === "negative" && (
                      <Row align="center">
                        <ChevronDownCircle size="small" primaryColor={negative} />
                        <Spacer x={0.1} />
                        <Text b size={"0.8em"} css={{ color: "$errorLightContrast" }}>{` ${c.comparison}%`}</Text>
                      </Row>
                    )}
                    {c.status === "positive" && (
                      <Row align="center">
                        <ChevronUpCircle size="small" primaryColor={positive} />
                        {/* <Spacer x={0.1} /> */}
                        <Text b size={"0.8em"} css={{ color: "$successLightContrast" }}>{` ${c.comparison}%`}</Text>
                      </Row>
                    )}
                  </Tooltip>
                )}
              </Row>
              <Row>
                <Text h6={chart.chartSize === 1} h5={chart.chartSize > 1} css={{ fontWeight: "normal" }}>
                  <span
                    style={
                      chart.Datasets
                      && chart.Datasets[index]
                      && styles.datasetLabelColor(chart.Datasets[index].datasetColor)
                    }
                  >
                    {c.label}
                  </span>
                </Text>
              </Row>
            </Container>
          </Grid>
        );
      })}
    </Grid.Container>
  );
}

const styles = {
  growthContainer: {
    boxShadow: "none", border: "none", marginTop: 0, marginBottom: 10
  },
  datasetLabelColor: (color) => ({
    borderBottom: `solid 3px ${color}`,
  }),
};

KpiChartSegment.propTypes = {
  chart: PropTypes.object.isRequired,
  editMode: PropTypes.bool.isRequired,
};

export default KpiChartSegment;
