import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import {
  Container, Loader, Header, Message, Icon,
} from "semantic-ui-react";
import moment from "moment";

import { getEmbeddedChart as getEmbeddedChartAction } from "../actions/chart";
import LineChart from "./Chart/components/LineChart";
import BarChart from "./Chart/components/BarChart";
import TableContainer from "./Chart/components/TableView/TableContainer";
import { blackTransparent } from "../config/colors";

const pageHeight = window.innerHeight;

/*
  This container is used for embedding charts in other websites
*/
function EmbeddedChart(props) {
  const { getEmbeddedChart, match } = props;

  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // change the background color to transparent
    document.body.style.backgroundColor = "transparent";

    setLoading(true);
    setTimeout(() => {
      getEmbeddedChart(match.params.chartId)
        .then((chart) => {
          setChart(chart);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
          setChart({ error: "no chart" });
        });
    }, 1000);
  }, []);

  const _getUpdatedTime = (updatedAt) => {
    if (moment().diff(moment(updatedAt), "days") > 1) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
  };

  if (loading || !chart) {
    return (
      <Container textAlign="center" text style={styles.loaderContainer}>
        <Loader active inverted>Loading</Loader>
      </Container>
    );
  }

  if (error) {
    return (
      <Container text>
        <Message>
          <Message.Header>Error loading the Chart</Message.Header>
          <p>
            The Chart might not be public in the ChartBrew dashboard.
          </p>
        </Message>
      </Container>
    );
  }

  return (
    <div style={styles.container}>
      <Container>
        <Container fluid style={styles.header(chart.type)}>
          <Header style={{ display: "contents" }}>{chart.name}</Header>
          {chart.chartData && (
            <div>
              <p>
                <small>
                  {!loading && (
                    <i>
                      <span title="Last updated">{`${_getUpdatedTime(chart.chartDataUpdated)}`}</span>
                    </i>
                  )}
                  {loading && (
                    <>
                      <Icon name="spinner" loading />
                      <span>{" Updating..."}</span>
                    </>
                  )}
                </small>
              </p>
            </div>
          )}
        </Container>
        {chart.type === "line"
          && (
          <Container fluid>
            <LineChart chart={chart} height={pageHeight - 100} />
          </Container>
          )}
        {chart.type === "bar"
          && (
          <Container fluid>
            <BarChart chart={chart} height={pageHeight - 100} />
          </Container>
          )}
        {chart.type === "pie"
          && (
          <Container fluid>
            <Pie
              data={chart.chartData.data}
              options={chart.chartData.options}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "doughnut"
          && (
          <Container fluid>
            <Doughnut
              data={chart.chartData.data}
              options={chart.chartData.options}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "radar"
          && (
          <Container fluid>
            <Radar
              data={chart.chartData.data}
              options={chart.chartData.options}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "polar"
          && (
          <Container fluid>
            <Polar
              data={chart.chartData.data}
              options={chart.chartData.options}
              height={pageHeight - 100}
            />
          </Container>
          )}
        {chart.type === "table"
          && (
          <Container fluid>
            <TableContainer
              height={pageHeight - 100}
              tabularData={chart.chartData}
              embedded
            />
          </Container>
          )}
        <div style={{ float: "right" }}>
          <small style={{ color: blackTransparent(0.5) }}>
            {"Powered by "}
            <a href="https://chartbrew.com" target="_blank" rel="noreferrer">
              Chartbrew
            </a>
          </small>
        </div>
      </Container>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "transparent",
    padding: 10,
  },
  header: (type) => ({
    paddingRight: type === "table" ? 0 : 20,
    paddingLeft: type === "table" ? 0 : 20,
    paddingBottom: type === "table" ? 10 : 0,
  }),
  loaderContainer: {
    minHeight: 100,
    minWidth: 100,
  },
  updatedText: {
    paddingLeft: 20,
  },
};

EmbeddedChart.propTypes = {
  getEmbeddedChart: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
};

const mapStateToProps = () => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getEmbeddedChart: (id) => dispatch(getEmbeddedChartAction(id)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddedChart);
