import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Line, Bar, Pie, Doughnut, Radar, Polar
} from "react-chartjs-2";
import {
  Container, Loader, Header, Image, Message,
} from "semantic-ui-react";
import moment from "moment";

import "../embedded.css";
import logo from "../assets/cb_logo_4_small.png";

import { getEmbeddedChart as getEmbeddedChartAction } from "../actions/chart";

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
          <Container fluid style={styles.header}>
            <a href="https://chartbrew.com" target="_parent" title="Powered by ChartBrew">
              <Image src={logo} size="mini" style={styles.logo} />
            </a>
            <Header>{chart.name}</Header>
          </Container>
          {chart.type === "line"
          && (
          <Line
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
          )}
          {chart.type === "bar"
          && (
          <Bar
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
          )}
          {chart.type === "pie"
          && (
          <Pie
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
          )}
          {chart.type === "doughnut"
          && (
          <Doughnut
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
          )}
          {chart.type === "radar"
          && (
          <Radar
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
          )}
          {chart.type === "polar"
          && (
          <Polar
            data={chart.chartData.data}
            options={chart.chartData.options}
            height={300}
          />
          )}
          <p style={styles.updatedText}>
            <small>
              <i>{`Last Updated ${moment(chart.chartDataUpdated).calendar()}`}</i>
            </small>
          </p>
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
  header: {
    paddingRight: 20,
    paddingLeft: 20,
  },
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
