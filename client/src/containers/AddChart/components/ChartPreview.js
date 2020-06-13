import React, { useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Button, Icon, Header, Image, Dimmer,
} from "semantic-ui-react";
import {
  Line, Bar, Doughnut, Polar, Pie, Radar
} from "react-chartjs-2";

import ChartTypesSelector from "../../../components/ChartTypesSelector";
import lineChartImage from "../../../assets/lineChart.PNG";
import barChartImage from "../../../assets/barChart.PNG";
import radarChartImage from "../../../assets/radarChart.PNG";
import polarChartImage from "../../../assets/polarChart.PNG";
import pieChartImage from "../../../assets/pieChart.PNG";
import doughnutChartImage from "../../../assets/doughnutChart.PNG";

function ChartPreview(props) {
  const [typesVisible, setTypesVisible] = useState(false);
  const {
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading,
  } = props;

  const _onChangeChartType = (type) => {
    return onChange(type);
  };

  return (
    <>
      {chart && chart.chartData && !typesVisible && (
        <Container>
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
          <Button.Group fluid size="small">
            <Button
              icon
              labelPosition="right"
              onClick={() => setTypesVisible(true)}
              primary
              basic
            >
              <Icon name="chart line" />
              {"Chart type"}
            </Button>
            <Button
              icon
              labelPosition="right"
              onClick={onRefreshPreview}
              primary
              basic
              loading={chartLoading}
            >
              <Icon name="eye" />
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
              Refresh Data
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
