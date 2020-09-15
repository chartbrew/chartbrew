import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Button, Icon, Header, Image, Dimmer, Dropdown,
} from "semantic-ui-react";
import {
  Doughnut, Polar, Pie, Radar
} from "react-chartjs-2";
import BarChart from "../../Chart/components/BarChart";

import ChartTypesSelector from "./ChartTypesSelector";
import lineChartImage from "../../../assets/charts/lineChart.jpg";
import barChartImage from "../../../assets/charts/barChart.jpg";
import radarChartImage from "../../../assets/charts/radarChart.jpg";
import polarChartImage from "../../../assets/charts/polarChart.jpg";
import pieChartImage from "../../../assets/charts/pieChart.jpg";
import doughnutChartImage from "../../../assets/charts/doughnutChart.jpg";
import LineChart from "../../Chart/components/LineChart";

function ChartPreview(props) {
  const [typesVisible, setTypesVisible] = useState(false);
  const {
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading,
  } = props;

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

  const _onChangeMode = (e, data) => {
    return onChange({ mode: data.value });
  };

  return (
    <>
      {chart && chart.chartData && !typesVisible && (
        <Container>
          {chart.subType.indexOf("AddTimeseries") > -1 && (
            <Dropdown
              options={chartModes}
              selection
              value={chart.mode}
              onChange={_onChangeMode}
              style={styles.modeSwitcher}
            />
          )}
          {chart.type === "line"
            && (
              <LineChart chart={chart} />
            )}
          {chart.type === "bar"
            && (
              <BarChart chart={chart} />
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
              <Header icon>
                <Icon name="database" />
                {"Let's create some datasets and fetch some data"}
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
      {typesVisible && (
        <ChartTypesSelector
          type={chart.type}
          subType={chart.subType}
          onChange={_onChangeChartType}
          onClose={() => setTypesVisible(false)}
        />
      )}

      {chart && chart.type && !typesVisible && (
        <Container textAlign="center" style={styles.topBuffer}>
          <Button
            icon
            labelPosition="left"
            onClick={() => setTypesVisible(true)}
            primary
            size="small"
          >
            <Icon name="chart line" />
            {"Chart type"}
          </Button>
          <Button.Group size="small">
            <Button
              icon
              labelPosition="left"
              onClick={onRefreshPreview}
              primary
              basic
              loading={chartLoading}
            >
              <Icon name="refresh" />
              {"Refresh style"}
            </Button>
            <Button
              icon
              labelPosition="right"
              onClick={onRefreshData}
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
