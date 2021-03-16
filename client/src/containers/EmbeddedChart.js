import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import {
  Container, Loader, Header, Image, Message,
} from "semantic-ui-react";

import logo from "../assets/logo_blue.png";

import { getEmbeddedChart as getEmbeddedChartAction } from "../actions/chart";
import LineChart from "./Chart/components/LineChart";
import BarChart from "./Chart/components/BarChart";
import TableContainer from "./Chart/components/TableView/TableContainer";

const pageHeight = window.innerHeight;

/*
  This container is used for embedding charts in other websites
*/
class EmbeddedChart extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      chart: null,
    };
  }

  componentDidMount() {
    // change the background color to transparent
    document.body.style.backgroundColor = "transparent";

    const { getEmbeddedChart, match } = this.props;

    this.setState({ loading: true });
    setTimeout(() => {
      getEmbeddedChart(match.params.chartId)
        .then((chart) => {
          this.setState({
            chart,
            loading: false,
          });
        })
        .catch(() => {
          this.setState({
            error: true,
            loading: false,
            chart: { error: "no chart" },
          });
        });
    }, 1000);
  }

  render() {
    const { loading, error, chart } = this.state;

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
            <a href="https://chartbrew.com" target="_parent" title="Powered by Chartbrew">
              <Image src={logo} size="mini" style={styles.logo} />
            </a>
            <Header>{chart.name}</Header>
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
        </Container>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "transparent",
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
  logo: {
    float: "right",
    opacity: 0.5,
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
