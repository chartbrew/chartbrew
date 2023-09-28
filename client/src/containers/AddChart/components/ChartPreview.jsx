import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, CircularProgress, Divider, Select, SelectItem, Spacer, Tooltip,
} from "@nextui-org/react";
import {
  TbChartBar, TbChartDonut4, TbChartLine, TbChartPie2, TbChartRadar, TbMathAvg,
} from "react-icons/tb";
import { TiChartPie } from "react-icons/ti";
import { FaChartLine } from "react-icons/fa";
import { BsTable } from "react-icons/bs";
import { LuInfo, LuRefreshCw } from "react-icons/lu";

import LineChart from "../../Chart/components/LineChart";
import BarChart from "../../Chart/components/BarChart";
import RadarChart from "../../Chart/components/RadarChart";
import DoughnutChart from "../../Chart/components/DoughnutChart";
import PolarChart from "../../Chart/components/PolarChart";
import PieChart from "../../Chart/components/PieChart";
import TableContainer from "../../Chart/components/TableView/TableContainer";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

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
    invalidateCache, changeCache,
  } = props;

  const [redraw, setRedraw] = useState(false);

  useEffect(() => {
    _onRefreshPreview();
  }, [chart.type]);

  useEffect(() => {
    setRedraw(true);
  }, [chart.dataLabels]);

  const _onChangeChartType = (data) => {
    const newType = data;
    if (data.type === "polar" || data.type === "pie" || data.type === "doughnut" || data.type === "radar" || data.type === "table") {
      newType.subType = "timeseries";
      newType.mode = "chart";
    }

    if (data.type === "avg" && chart.type !== "avg") {
      newType.subType = "timeseries";
      newType.mode = "kpi";
    } else if (data.type === "avg" && chart.type === "avg") {
      newType.subType = "timeseries";
      newType.mode = "chart";
      newType.type = "line";
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
    onRefreshData(!!window.localStorage.getItem("_cb_use_cache"));
  };

  return (
    <div className={"bg-content1 rounded-lg mx-auto p-4 w-full"}>
      {chart && chart.chartData && chart.Datasets && (
        <>
          <div className={"min-h-[350px] w-full"}>
            <Row justify="flex-start" align="center">
              <Button
                onClick={_onRefreshData}
                isLoading={chartLoading}
                size="sm"
                endContent={<LuRefreshCw size={18} />}
                variant="bordered"
              >
                {"Refresh chart"}
              </Button>
              <Spacer x={2} />
              <Checkbox
                isSelected={!invalidateCache}
                onChange={changeCache}
                size="sm"
              >
                {"Use cached data"}
              </Checkbox>
              <Spacer x={0.5} />
              <Tooltip
                content="Chartbrew will use cached data for extra editing speed ⚡️"
              >
                <div><LuInfo /></div>
              </Tooltip>
            </Row>
            <Spacer y={2} />
            <Row>
              <Divider />
            </Row>
            <Spacer y={2} />
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
          </div>
          <Spacer y={2} />
          <div className="border-solid border-1 border-content3 px-3 py-2 rounded-lg">
            <Row align="center" wrap="wrap" className={"gap-4 justify-around"}>
              <Row className={"gap-1"}>
                <Tooltip
                  content={"Get the average value of all the points on the chart"}
                >
                  <Button
                    variant={chart.type !== "avg" ? "bordered" : "solid"}
                    color={chart.type === "avg" ? "secondary" : "default"}
                    onClick={() => _onChangeChartType({ type: "avg" })}
                    isIconOnly
                  >
                    <TbMathAvg size={24} />
                  </Button>
                </Tooltip>
                <Tooltip
                  content={chart.subType.indexOf("AddTimeseries") > -1 ? "Turn accumulation off" : "Accumulate datasets"}
                >
                  <Button
                    variant={chart.subType.indexOf("AddTimeseries") === -1 ? "bordered" : "solid"}
                    color={chart.subType.indexOf("AddTimeseries") > -1 ? "secondary" : "default"}
                    onClick={_toggleAccumulation}
                    disabled={chart.type !== "line" && chart.type !== "bar" && chart.type !== "avg"}
                    isIconOnly
                  >
                    <FaChartLine size={20} />
                  </Button>
                </Tooltip>
              </Row>

              <Row className={"gap-1"}>
                <Tooltip content="Display data in a table view">
                  <Button
                    variant={chart.type !== "table" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "table" })}
                    color={chart.type === "table" ? "primary" : "default"}
                    isIconOnly
                  >
                    <BsTable size={20} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as line chart">
                  <Button
                    variant={chart.type !== "line" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "line" })}
                    color={chart.type === "line" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartLine size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as bar chart">
                  <Button
                    variant={chart.type !== "bar" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "bar" })}
                    color={chart.type === "bar" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartBar size={24} />
                  </Button>
                </Tooltip>
              </Row>

              <Row className={"gap-1"}>
                <Tooltip content="Display as pie chart">
                  <Button
                    variant={chart.type !== "pie" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "pie" })}
                    color={chart.type === "pie" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartPie2 size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as doughnut chart">
                  <Button
                    variant={chart.type !== "doughnut" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "doughnut" })}
                    color={chart.type === "doughnut" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartDonut4 size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as radar chart">
                  <Button
                    variant={chart.type !== "radar" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "radar" })}
                    color={chart.type === "radar" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartRadar size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as polar chart">
                  <Button
                    variant={chart.type !== "polar" ? "bordered" : "solid"}
                    onClick={() => _onChangeChartType({ type: "polar" })}
                    color={chart.type === "polar" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TiChartPie size={24} />
                  </Button>
                </Tooltip>
              </Row>
            </Row>
          </div>
        </>
      )}

      <div>
        {chart && chart.type && !chart.chartData && (
          <>
            {chartLoading && (
              <>
                <Row>
                  <CircularProgress size="lg" />
                </Row>
                <Row>
                  <Text b>Loading chart data...</Text>
                </Row>
                <Spacer y={2} />
              </>
            )}
            {!chartLoading && (
              <>
                <Row justify="center">
                  <Text size="h3">{"Create a dataset to get started"}</Text>
                </Row>
                <Spacer y={0.5} />
              </>
            )}
          </>
        )}
      </div>

      {chart && chart.type && chart.Datasets && chart.Datasets.length > 0 && (
        <div style={styles.topBuffer}>
          <Row align="center" justify="space-between" className={"gap-4"}>
            <Select
              isDisabled={chart.type !== "line" && chart.type !== "bar"}
              selectionMode="single"
              onSelectionChange={(keys) => _onChangeMode(keys.currentKey)}
              selectedKeys={[chart.mode]}
              variant="bordered"
              renderValue={() => (
                <Text>{chart.mode && chartModes.find((mode) => mode.value === chart.mode).text}</Text>
              )}
              label="Chart mode"
              size="sm"
            >
              {chartModes.map((mode) => (
                <SelectItem key={mode.value}>
                  {mode.text}
                </SelectItem>
              ))}
            </Select>
            <Checkbox
              isSelected={chart.showGrowth}
              onChange={_onChangeGrowth}
              isDisabled={chart.mode === "chart"}
              size="sm"
              className="min-w-[150px]"
            >
              Show growth
            </Checkbox>
          </Row>
          <Spacer y={2} />
        </div>
      )}
    </div>
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
  invalidateCache: PropTypes.bool.isRequired,
  changeCache: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    chartLoading: state.chart.loading,
  };
};

export default connect(mapStateToProps)(ChartPreview);
