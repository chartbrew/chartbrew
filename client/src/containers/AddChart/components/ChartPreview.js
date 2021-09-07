import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Button, Icon, Header, Image, Dimmer, Dropdown,
  Popup, Segment,
} from "semantic-ui-react";
import _ from "lodash";

import lineChartImage from "../../../assets/charts/lineChart.jpg";
import barChartImage from "../../../assets/charts/barChart.jpg";
import radarChartImage from "../../../assets/charts/radarChart.jpg";
import polarChartImage from "../../../assets/charts/polarChart.jpg";
import pieChartImage from "../../../assets/charts/pieChart.jpg";
import doughnutChartImage from "../../../assets/charts/doughnutChart.jpg";
import LineChart from "../../Chart/components/LineChart";
import BarChart from "../../Chart/components/BarChart";
import RadarChart from "../../Chart/components/RadarChart";
import DoughnutChart from "../../Chart/components/DoughnutChart";
import PolarChart from "../../Chart/components/PolarChart";
import PieChart from "../../Chart/components/PieChart";

import radarSvg from "../../../assets/chart-icons/svg/014-analytics-56.svg";
import lineSvg from "../../../assets/chart-icons/svg/line.svg";
import barSvg from "../../../assets/chart-icons/svg/042-analytics-28.svg";
import pieSvg from "../../../assets/chart-icons/svg/027-analytics-43.svg";
import accumulateSvg from "../../../assets/chart-icons/svg/004-analytics-66.svg";
import polarSvg from "../../../assets/chart-icons/svg/009-analytics-61.svg";
import doughnutSvg from "../../../assets/chart-icons/svg/011-analytics-59.svg";
import tableSvg from "../../../assets/chart-icons/svg/table.svg";
import TableContainer from "../../Chart/components/TableView/TableContainer";

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

function ChartPreview(props) {
  const {
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading,
  } = props;

  const [redraw, setRedraw] = useState(false);

  useEffect(() => {
    _onRefreshPreview();
  }, [chart.type]);

  const _onChangeChartType = (data) => {
    const newType = data;
    if (data.type === "polar" || data.type === "pie" || data.type === "doughnut" || data.type === "radar" || data.type === "table") {
      newType.subType = "timeseries";
      newType.mode = "chart";
    }
    return onChange(newType);
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

  const _getDropdownOptions = (datasetId, condition) => {
    const { conditionsOptions } = chart;
    const datasetConditions = _.find(conditionsOptions, { dataset_id: datasetId });
    const conditionOpt = _.find(datasetConditions.conditions, { field: condition.field });

    if (!conditionOpt) return [];

    return conditionOpt.values.map((v) => {
      return {
        key: v,
        value: v,
        text: v,
      };
    });
  };

  return (
    <>
      {chart && chart.chartData && chart.Datasets && (
        <>
          {chart.Datasets.filter((d) => d.conditions && d.conditions.length).map((dataset) => {
            return dataset.conditions.filter((c) => c.exposed).map((condition) => {
              const filterOptions = _getDropdownOptions(dataset.id, condition);
              return (
                <Dropdown
                  selection
                  options={filterOptions}
                  text={`${condition.field.replace("root[].", "")} ${condition.operator}`}
                />
              );
            });
          })}
          <Segment>
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
                  <PieChart
                    chart={chart}
                    height={300}
                  />
                </div>
              )}
            {chart.type === "doughnut"
              && (
                <DoughnutChart
                  chart={chart}
                  height={300}
                />
              )}
            {chart.type === "radar"
              && (
                <RadarChart
                  chart={chart}
                  height={300}
                />
              )}
            {chart.type === "polar"
              && (
                <PolarChart
                  chart={chart}
                  height={300}
                />
              )}
            {chart.type === "table"
              && (
                <div>
                  <TableContainer
                    tabularData={chart.chartData}
                    height={400}
                  />
                </div>
              )}
          </Segment>
          <Container textAlign="center">
            <Popup
              trigger={(
                <Button
                  basic
                  secondary={chart.subType.indexOf("AddTimeseries") > -1}
                  onClick={_toggleAccumulation}
                  disabled={chart.type !== "line" && chart.type !== "bar"}
                >
                  <Image centered src={accumulateSvg} style={styles.chartCard} />
                </Button>
              )}
              content={chart.subType.indexOf("AddTimeseries") > -1 ? "Turn accumulation off" : "Accumulate datasets"}
              position="bottom center"
            />
            <Popup
              trigger={(
                <Button
                  basic
                  primary={chart.type === "table"}
                  onClick={() => _onChangeChartType({ type: "table" })}
                  icon
                >
                  <Image centered src={tableSvg} style={styles.chartCard} />
                </Button>
              )}
              content="Display data in a table view"
              position="bottom center"
            />
            <Button.Group style={{ marginRight: 4 }}>
              <Popup
                trigger={(
                  <Button
                    basic
                    primary={chart.type === "line"}
                    onClick={() => _onChangeChartType({ type: "line" })}
                  >
                    <Image centered src={lineSvg} style={styles.chartCard} />
                  </Button>
                )}
                content="Display as line chart"
                position="bottom center"
              />
              <Popup
                trigger={(
                  <Button
                    basic
                    primary={chart.type === "bar"}
                    onClick={() => _onChangeChartType({ type: "bar" })}
                  >
                    <Image centered src={barSvg} style={styles.chartCard} />
                  </Button>
                )}
                content="Display as bar chart"
                position="bottom center"
              />
            </Button.Group>
            <Button.Group>
              <Popup
                trigger={(
                  <Button
                    basic
                    primary={chart.type === "pie"}
                    onClick={() => _onChangeChartType({ type: "pie" })}
                  >
                    <Image centered src={pieSvg} style={styles.chartCard} />
                  </Button>
                )}
                content="Display as pie chart"
                position="bottom center"
              />
              <Popup
                trigger={(
                  <Button
                    basic
                    primary={chart.type === "radar"}
                    onClick={() => _onChangeChartType({ type: "radar" })}
                  >
                    <Image centered src={radarSvg} style={styles.chartCard} />
                  </Button>
                )}
                content="Display as radar chart"
                position="bottom center"
              />
              <Popup
                trigger={(
                  <Button
                    basic
                    primary={chart.type === "doughnut"}
                    onClick={() => _onChangeChartType({ type: "doughnut" })}
                  >
                    <Image centered src={doughnutSvg} style={styles.chartCard} />
                  </Button>
                )}
                content="Display as doughnut chart"
                position="bottom center"
              />
              <Popup
                trigger={(
                  <Button
                    basic
                    primary={chart.type === "polar"}
                    onClick={() => _onChangeChartType({ type: "polar" })}
                  >
                    <Image centered src={polarSvg} style={styles.chartCard} />
                  </Button>
                )}
                content="Display as polar chart"
                position="bottom center"
              />
            </Button.Group>
          </Container>
        </>
      )}

      <Container textAlign="center">
        {chart && chart.type && !chart.chartData && (
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

      {chart && chart.type && chart.Datasets && chart.Datasets.length > 0 && (
        <Container textAlign="center" style={styles.topBuffer}>
          <Dropdown
            options={chartModes}
            selection
            value={chart.mode}
            onChange={_onChangeMode}
            style={styles.modeSwitcher}
            disabled={chart.type !== "line" && chart.type !== "bar"}
          />
          <Button.Group>
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
    marginRight: 10,
  },
  chartCard: {
    height: 25,
  },
  chartCardContainer: {
    background: "white",
    padding: 5,
    border: "1px solid rgba(34,36,38,.15)",
    boxShadow: "0 1px 2px 0 rgb(34 36 38 / 15%)",
    borderRadius: 4,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  chartCardContainerSeparator: {
    background: "white",
    padding: 5,
    border: "1px solid rgba(34,36,38,.15)",
    marginRight: 10,
    marginLeft: -1,
    boxShadow: "0 1px 2px 0 rgb(34 36 38 / 15%)",
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  segmentContainer: {
    border: "none",
    boxShadow: "none",
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
