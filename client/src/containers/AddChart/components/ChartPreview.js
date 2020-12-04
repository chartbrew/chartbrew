import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Button, Icon, Header, Image, Dimmer, Dropdown, Grid, Popup
} from "semantic-ui-react";
import {
  Doughnut, Polar, Pie, Radar
} from "react-chartjs-2";
import BarChart from "../../Chart/components/BarChart";

import lineChartImage from "../../../assets/charts/lineChart.jpg";
import barChartImage from "../../../assets/charts/barChart.jpg";
import radarChartImage from "../../../assets/charts/radarChart.jpg";
import polarChartImage from "../../../assets/charts/polarChart.jpg";
import pieChartImage from "../../../assets/charts/pieChart.jpg";
import doughnutChartImage from "../../../assets/charts/doughnutChart.jpg";
import LineChart from "../../Chart/components/LineChart";

function ChartPreview(props) {
  const {
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading,
  } = props;

  const [typesVisible, setTypesVisible] = useState(false);
  const [redraw, setRedraw] = useState(false);

  const chartModes = [{
    key: "chart",
    text: "Chart view",
    value: "chart",
    icon: "chart bar",
  }, {
    key: "kpi",
    text: "KPI View",
    value: "kpi",
    icon: "hashtag",
  }];

  const _onChangeChartType = (type) => {
    return onChange(type);
  };

  const _toggleAccumulation = () => {
    if (chart.subType.indexOf("AddTimeseries") > -1) {
      return onChange({ subType: "timeseries" });
    }

    return onChange({ subType: "AddTimeseries" });
  };

  const _onChangeMode = (e, data) => {
    if (data.value === "chart") {
      setRedraw(true);
    }

    return onChange({ mode: data.value });
  };

  const _redrawComplete = () => {
    setRedraw(false);
  };

  const _onRefreshPreview = () => {
    setRedraw(true);
    onRefreshPreview();
  };

  const _onRefreshData = () => {
    setRedraw(true);
    onRefreshData();
  };

  return (
    <>
      {chart && chart.chartData && !typesVisible && (
        <Container>
          <Grid columns={2}>
            <Grid.Column width={6}>
              {chart.type !== "pie" && (
                <Dropdown
                  options={chartModes}
                  selection
                  value={chart.mode}
                  onChange={_onChangeMode}
                  style={styles.modeSwitcher}
                />
              )}
            </Grid.Column>
            <Grid.Column width={10} textAlign="right" style={styles.modeSwitcher}>
              {(chart.type === "line" || chart.type === "bar") && (
                <Popup
                  trigger={(
                    <Button
                      color={chart.subType.indexOf("AddTimeseries") > -1 && "olive"}
                      basic={chart.subType.indexOf("AddTimeseries") < 0}
                      icon="chart line"
                      onClick={_toggleAccumulation}
                    />
                  )}
                  content={chart.subType.indexOf("AddTimeseries") > -1 ? "Turn accumulation off" : "Accumulate datasets"}
                  position="bottom center"
                />
              )}
              <Button.Group style={{ marginRight: 3.5 }}>
                <Popup
                  trigger={(
                    <Button
                      color={chart.type === "line" && "violet"}
                      icon="chart area"
                      onClick={() => _onChangeChartType({ type: "line" })}
                    />
                  )}
                  content="Display line chart"
                  position="bottom center"
                />
                <Popup
                  trigger={(
                    <Button
                      color={chart.type === "bar" && "violet"}
                      icon="chart bar"
                      onClick={() => _onChangeChartType({ type: "bar" })}
                    />
                  )}
                  content="Display bar chart"
                  position="bottom center"
                />
                <Popup
                  trigger={(
                    <Button
                      color={chart.type === "pie" && "violet"}
                      icon="chart pie"
                      onClick={() => _onChangeChartType({ type: "pie" })}
                    />
                  )}
                  content="Display pie chart"
                  position="bottom center"
                />
              </Button.Group>
            </Grid.Column>
          </Grid>
          {chart.type === "line"
            && (
              <LineChart chart={chart} redraw={redraw} redrawComplete={_redrawComplete} />
            )}
          {chart.type === "bar"
            && (
              <BarChart chart={chart} redraw={redraw} redrawComplete={_redrawComplete} />
            )}
          {chart.type === "pie"
            && (
              <div>
                <Pie
                  data={chart.chartData.data}
                  options={chart.chartData.options}
                  height={300}
                />
              </div>
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
        </Container>
      )}

      <Container textAlign="center">
        {chart && !chart.type && !typesVisible && (
          <Dimmer.Dimmable active>
            <Dimmer active inverted>
              <Header>
                Create a dataset and select your visualisation type
              </Header>
              <Button
                icon
                labelPosition="right"
                primary
                onClick={() => setTypesVisible(true)}
                basic
              >
                <Icon name="chart line" />
                Select chart type
              </Button>
            </Dimmer>
            <Image src={lineChartImage} centered size="big" />
          </Dimmer.Dimmable>
        )}

        {chart && chart.type && !chart.chartData && !typesVisible && (
          <Dimmer.Dimmable active>
            <Dimmer active inverted>
              <Header as="h2">
                {"Just a few steps away from the perfect visualisation"}
                <Header.Subheader className="large">{"Create a dataset to get started"}</Header.Subheader>
              </Header>
            </Dimmer>
            <Image
              src={
                chart.type === "line" ? lineChartImage
                  : chart.type === "bar" ? barChartImage
                    : chart.type === "polar" ? polarChartImage
                      : chart.type === "doughnut" ? doughnutChartImage
                        : chart.type === "pie" ? pieChartImage
                          : radarChartImage
              }
              centered
              size="big"
            />
          </Dimmer.Dimmable>
        )}
      </Container>

      {chart && chart.type && !typesVisible && (
        <Container textAlign="center" style={styles.topBuffer}>
          <Button.Group size="small">
            <Button
              icon
              labelPosition="left"
              onClick={_onRefreshPreview}
              primary
              basic
              loading={chartLoading}
              disabled={!chart.chartData}
            >
              <Icon name="refresh" />
              {"Refresh style"}
            </Button>
            <Button
              icon
              labelPosition="right"
              onClick={_onRefreshData}
              primary
              basic
              loading={chartLoading}
            >
              <Icon name="angle double down" />
              Get new data
            </Button>
          </Button.Group>
        </Container>
      )}
    </>
  );
}

const styles = {
  topBuffer: {
    marginTop: 20,
  },
  modeSwitcher: {
    marginBottom: 10,
  },
};

ChartPreview.propTypes = {
  chart: PropTypes.object.isRequired,
  chartLoading: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onRefreshData: PropTypes.func.isRequired,
  onRefreshPreview: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    chartLoading: state.chart.loading,
  };
};

export default connect(mapStateToProps)(ChartPreview);
