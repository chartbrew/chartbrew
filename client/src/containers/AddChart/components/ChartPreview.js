import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Container, Dropdown, Image, Input, Loading,
  Row, Spacer, Text, Tooltip,
} from "@nextui-org/react";
import { ChevronDown, InfoCircle } from "react-iconly";

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
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading, datasets,
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

  const _onChangeMode = (key) => {
    if (key === "chart" || key === "kpichart") {
      setRedraw(true);
    }

    return onChange({ mode: key });
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
    <Container
      css={{
        backgroundColor: "$backgroundContrast",
        br: "$md",
        "@xs": {
          p: 20,
        },
        "@sm": {
          p: 20,
        },
        "@md": {
          p: 20,
        },
      }}
    >
      {chart && chart.chartData && chart.Datasets && (
        <>
          <Container style={{ minHeight: 350 }}>
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
                    datasets={datasets}
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
          </Container>
          <Spacer y={1} />
          <Container textAlign="center">
            <Row align="center" wrap="wrap" gap={1} justify="center">
              <Tooltip
                content={"Get the average value of all the points on the chart"}
              >
                <Button
                  bordered={chart.type !== "avg"}
                  color={chart.type === "avg" ? "secondary" : "primary"}
                  onClick={() => _onChangeChartType({ type: "avg" })}
                  auto
                  size="sm"
                >
                  <Image src={avgSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.1} />
              <Tooltip
                content={chart.subType.indexOf("AddTimeseries") > -1 ? "Turn accumulation off" : "Accumulate datasets"}
              >
                <Button
                  bordered={chart.subType.indexOf("AddTimeseries") === -1}
                  color={chart.subType.indexOf("AddTimeseries") > -1 ? "secondary" : "primary"}
                  onClick={_toggleAccumulation}
                  disabled={chart.type !== "line" && chart.type !== "bar" && chart.type !== "avg"}
                  auto
                  size="sm"
                >
                  <Image src={accumulateSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.5} />

              <Tooltip content="Display data in a table view">
                <Button
                  bordered={chart.type !== "table"}
                  onClick={() => _onChangeChartType({ type: "table" })}
                  auto
                  size="sm"
                >
                  <Image src={tableSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.5} />

              <Tooltip content="Display as line chart">
                <Button
                  bordered={chart.type !== "line"}
                  onClick={() => _onChangeChartType({ type: "line" })}
                  auto
                  size="sm"
                >
                  <Image src={lineSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.1} />
              <Tooltip content="Display as bar chart">
                <Button
                  bordered={chart.type !== "bar"}
                  onClick={() => _onChangeChartType({ type: "bar" })}
                  auto
                  size="sm"
                >
                  <Image src={barSvg} width={25} height={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.5} />

              <Tooltip content="Display as pie chart">
                <Button
                  bordered={chart.type !== "pie"}
                  onClick={() => _onChangeChartType({ type: "pie" })}
                  auto
                  size="sm"
                >
                  <Image src={pieSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.1} />
              <Tooltip content="Display as radar chart">
                <Button
                  bordered={chart.type !== "radar"}
                  onClick={() => _onChangeChartType({ type: "radar" })}
                  auto
                  size="sm"
                >
                  <Image src={radarSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.1} />
              <Tooltip content="Display as doughnut chart">
                <Button
                  bordered={chart.type !== "doughnut"}
                  onClick={() => _onChangeChartType({ type: "doughnut" })}
                  auto
                  size="sm"
                >
                  <Image src={doughnutSvg} height={25} width={25} />
                </Button>
              </Tooltip>
              <Spacer x={0.1} />
              <Tooltip content="Display as polar chart">
                <Button
                  bordered={chart.type !== "polar"}
                  onClick={() => _onChangeChartType({ type: "polar" })}
                  auto
                  size="sm"
                >
                  <Image src={polarSvg} height={25} width={25} />
                </Button>
              </Tooltip>
            </Row>
          </Container>
        </>
      )}

      <Container textAlign="center">
        {chart && chart.type && !chart.chartData && (
          <>
            {chartLoading && (
              <>
                <Row>
                  <Loading type="spinner" size="lg" />
                </Row>
                <Row>
                  <Text b>Loading chart data...</Text>
                </Row>
                <Spacer y={1} />
              </>
            )}
            {!chartLoading && (
              <>
                <Row justify="center">
                  <Text h3>{"Create a dataset to get started"}</Text>
                </Row>
                <Spacer y={0.2} />
              </>
            )}
          </>
        )}
      </Container>

      {chart && chart.type && chart.Datasets && chart.Datasets.length > 0 && (
        <Container style={styles.topBuffer}>
          <Row align="center" justify="center">
            <Dropdown isDisabled={chart.type !== "line" && chart.type !== "bar"}>
              <Dropdown.Trigger>
                <Input
                  value={chart.mode && chartModes.find((mode) => mode.value === chart.mode).text}
                  bordered
                  contentRight={<ChevronDown />}
                  disabled={chart.type !== "line" && chart.type !== "bar"}
                />
              </Dropdown.Trigger>
              <Dropdown.Menu
                onAction={(key) => _onChangeMode(key)}
                selectedKeys={[chart.mode]}
                selectionMode="single"
              >
                {chartModes.map((mode) => (
                  <Dropdown.Item key={mode.value}>
                    {mode.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Spacer x={0.5} />
            <Checkbox
              isSelected={chart.showGrowth}
              onChange={_onChangeGrowth}
              isDisabled={chart.mode === "chart"}
              size="sm"
            >
              Show growth
            </Checkbox>
          </Row>
          <Spacer y={1} />
          <Row justify="center" align="center">
            <Button
              onClick={_onRefreshPreview}
              bordered
              disabled={chartLoading}
              size="sm"
              auto
            >
              {chartLoading ? <Loading type="points" /> : "Refresh preview"}
            </Button>
            <Spacer x={0.2} />
            <Button
              onClick={_onRefreshData}
              bordered
              disabled={chartLoading}
              size="sm"
            >
              {chartLoading ? <Loading type="points" /> : "Re-process data"}
            </Button>
            <Spacer x={1} />
            <Checkbox
              isChecked={!!useCache}
              onChange={_onChangeUseCache}
              size="sm"
            >
              Use cache
            </Checkbox>
            <Spacer x={0.2} />
            <Tooltip
              content="If checked, Chartbrew will use cached data instead of making requests to your data source whenever possible."

            >
              <InfoCircle size="small" />
            </Tooltip>
          </Row>
        </Container>
      )}
    </Container>
  );
}

const styles = {
  topBuffer: {
    marginTop: 20,
  },
  modeSwitcher: {
    marginRight: 10,
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
  datasets: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    chartLoading: state.chart.loading,
  };
};

export default connect(mapStateToProps)(ChartPreview);
