import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Container, Button, Icon, Header, Image, Dimmer, Dropdown,
  Popup, Segment, Checkbox, Loader,
} from "semantic-ui-react";

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
import TableContainer from "../../Chart/components/TableView/TableContainer";

import radarSvg from "../../../assets/chart-icons/svg/014-analytics-56.svg";
import lineSvg from "../../../assets/chart-icons/svg/line.svg";
import barSvg from "../../../assets/chart-icons/svg/042-analytics-28.svg";
import pieSvg from "../../../assets/chart-icons/svg/027-analytics-43.svg";
import accumulateSvg from "../../../assets/chart-icons/svg/004-analytics-66.svg";
import polarSvg from "../../../assets/chart-icons/svg/009-analytics-61.svg";
import doughnutSvg from "../../../assets/chart-icons/svg/011-analytics-59.svg";
import tableSvg from "../../../assets/chart-icons/svg/table.svg";
import avgSvg from "../../../assets/chart-icons/svg/average_kpi.svg";
import { primaryTransparent } from "../../../config/colors";

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
}, {
  key: "kpichart",
  text: "KPI with chart",
  value: "kpichart",
  icon: "plus square outline",
}];

function ChartPreview(props) {
  const {
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading,
  } = props;

  const [redraw, setRedraw] = useState(false);
  const [useCache, setUseCache] = useState(false);

  useEffect(() => {
    setUseCache(!!window.localStorage.getItem("_cb_use_cache"));
  }, []);

  useEffect(() => {
    _onRefreshPreview();
  }, [chart.type]);

  const _onChangeChartType = (data) => {
    const newType = data;
    if (data.type === "polar" || data.type === "pie" || data.type === "doughnut" || data.type === "radar" || data.type === "table") {
      newType.subType = "timeseries";
      newType.mode = "chart";
    }

    if (data.type === "avg") {
      newType.subType = "timeseries";
      newType.mode = "kpi";
    }

    return onChange(newType);
  };

  const _toggleAccumulation = () => {
    if (chart.subType.indexOf("AddTimeseries") > -1) {
      return onChange({ subType: "timeseries" });
    }

    const updateData = { subType: "AddTimeseries" };
    if (chart.type === "avg") updateData.type = "line";

    return onChange(updateData);
  };

  const _onChangeMode = (e, data) => {
    if (data.value === "chart" || data.value === "kpichart") {
      setRedraw(true);
    }

    return onChange({ mode: data.value });
  };

  const _onChangeGrowth = () => {
    setRedraw(true);

    return onChange({ showGrowth: !chart.showGrowth });
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
    setUseCache(!!window.localStorage.getItem("_cb_use_cache"));
    onRefreshData(!!window.localStorage.getItem("_cb_use_cache"));
  };

  const _onChangeUseCache = () => {
    if (window.localStorage.getItem("_cb_use_cache")) {
      window.localStorage.removeItem("_cb_use_cache");
      setUseCache(false);
    } else {
      window.localStorage.setItem("_cb_use_cache", true);
      setUseCache(true);
    }
  };

  return (
    <>
      {chart && chart.chartData && chart.Datasets && (
        <>
          <Segment style={{ minHeight: 350 }}>
            {chart.type === "line"
              && (
                <LineChart
                  editMode
                  chart={chart}
                  redraw={redraw}
                  redrawComplete={_redrawComplete}
                />
              )}
            {chart.type === "bar"
              && (
                <BarChart
                  editMode
                  chart={chart}
                  redraw={redraw}
                  redrawComplete={_redrawComplete}
                />
              )}
            {chart.type === "pie"
              && (
                <div>
                  <PieChart
                    chart={chart}
                    height={300}
                    editMode
                  />
                </div>
              )}
            {chart.type === "doughnut"
              && (
                <DoughnutChart
                  chart={chart}
                  height={300}
                  editMode
                />
              )}
            {chart.type === "radar"
              && (
                <RadarChart
                  chart={chart}
                  height={300}
                  editMode
                />
              )}
            {chart.type === "polar"
              && (
                <PolarChart
                  chart={chart}
                  height={300}
                  editMode
                />
              )}
            {chart.type === "table"
              && (
                <div>
                  <TableContainer
                    tabularData={chart.chartData}
                    height={400}
                    editMode
                  />
                </div>
              )}
            {chart.type === "avg"
              && (
                <LineChart
                  chart={chart}
                  redraw={redraw}
                  redrawComplete={_redrawComplete}
                  editMode
                />
              )}
          </Segment>
          <Container textAlign="center">
            <Popup
              trigger={(
                <Button
                  basic
                  secondary={chart.type === "avg"}
                  onClick={() => _onChangeChartType({ type: "avg" })}
                  icon
                >
                  <Image centered src={avgSvg} style={styles.chartCard} />
                </Button>
              )}
              content={"Get the average value of all the points on the chart"}
              position="bottom center"
            />
            <Popup
              trigger={(
                <Button
                  basic
                  secondary={chart.subType.indexOf("AddTimeseries") > -1}
                  onClick={_toggleAccumulation}
                  disabled={chart.type !== "line" && chart.type !== "bar" && chart.type !== "avg"}
                  icon
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
                    icon
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
                    icon
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
                    icon
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
                    icon
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
                    icon
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
                    icon
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
              {chartLoading && <Loader active size="large">Creating your chart...</Loader>}
              {!chartLoading && (
                <Header as="h2">
                  {"Just a few steps away from the perfect visualisation"}
                  <Header.Subheader className="large">{"Create a dataset to get started"}</Header.Subheader>
                </Header>
              )}
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
          <div>
            <Dropdown
              options={chartModes}
              selection
              value={chart.mode}
              onChange={_onChangeMode}
              style={styles.modeSwitcher}
              disabled={chart.type !== "line" && chart.type !== "bar"}
            />
            <Checkbox
              toggle
              label="Show growth"
              checked={chart.showGrowth}
              onChange={_onChangeGrowth}
              disabled={chart.mode === "chart"}
            />
          </div>
          <div style={styles.topBuffer}>
            <Button
              onClick={_onRefreshPreview}
              primary
              basic
              loading={chartLoading}
              size="small"
            >
              Refresh preview
            </Button>
            <Button
              onClick={_onRefreshData}
              primary
              basic
              loading={chartLoading}
              size="small"
            >
              Re-process data
            </Button>
            {" "}
            <Checkbox
              label="Use cache"
              checked={!!useCache}
              onChange={_onChangeUseCache}
            />
            {" "}
            <Popup
              trigger={<Icon name="question circle outline" style={{ color: primaryTransparent(0.7) }} />}
              content="If checked, Chartbrew will use cached data instead of making requests to your data source whenever possible."
              inverted
            />
          </div>
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
