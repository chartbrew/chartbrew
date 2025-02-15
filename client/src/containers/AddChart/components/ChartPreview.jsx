import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Chip, CircularProgress, Divider, Input, Link, Popover, PopoverContent, PopoverTrigger, Skeleton, Spacer, Tooltip,
} from "@heroui/react";
import {
  TbChartBar, TbChartDonut4, TbChartLine, TbChartPie2, TbChartRadar, TbHash, TbMathAvg,
} from "react-icons/tb";
import { TiChartPie } from "react-icons/ti";
import { FaChartLine } from "react-icons/fa";
import { BsTable } from "react-icons/bs";
import { LuGauge, LuX, LuPlus } from "react-icons/lu";
import { LuInfo, LuListFilter, LuRefreshCw, LuCircleX } from "react-icons/lu";
import { findIndex, isEqual } from "lodash";
import { TwitterPicker } from "react-color";
import { chartColors } from "../../../config/colors";

import LineChart from "../../Chart/components/LineChart";
import BarChart from "../../Chart/components/BarChart";
import RadarChart from "../../Chart/components/RadarChart";
import DoughnutChart from "../../Chart/components/DoughnutChart";
import PolarChart from "../../Chart/components/PolarChart";
import PieChart from "../../Chart/components/PieChart";
import TableContainer from "../../Chart/components/TableView/TableContainer";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import KpiMode from "../../Chart/components/KpiMode";
import ChartFilters from "../../Chart/components/ChartFilters";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import GaugeChart from "../../Chart/components/GaugeChart";

function ChartPreview(props) {
  const {
    chart, onChange, onRefreshData, onRefreshPreview, chartLoading, changeCache, useCache,
  } = props;

  const [redraw, setRedraw] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [rangeErrors, setRangeErrors] = useState(null);

  useEffect(() => {
    _onRefreshPreview();
  }, [chart.type]);

  useEffect(() => {
    setRedraw(true);
  }, [chart.dataLabels]);

  useEffect(() => {
    setRanges(chart.ranges || [{ 
      min: 0, 
      max: 100, 
      label: "Total",
      color: Object.values(chartColors)[0].hex,
    }]);
  }, [chart.ranges]);

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.ChartDatasetConfigs.forEach((d) => {
      if (Array.isArray(d.Dataset?.conditions)) {
        filterCount += d.Dataset.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount > 0;
  };

  const _onAddFilter = (condition) => {
    let found = false;
    const newConditions = conditions.map((c) => {
      let newCondition = c;
      if (c.id === condition.id) {
        newCondition = condition;
        found = true;
      }
      return newCondition;
    });
    if (!found) newConditions.push(condition);
    setConditions(newConditions);

    onRefreshData(newConditions);
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);

    onRefreshData(newConditions);
  };

  const _onChangeChartType = (data) => {
    const newType = data;
    if (data.type === "polar" || data.type === "pie" || data.type === "doughnut" || data.type === "radar" || data.type === "table") {
      newType.subType = "timeseries";
      newType.mode = "chart";
    }

    if (data.type === "avg" && chart.type !== "avg") {
      newType.subType = "timeseries";
    } else if (data.type === "avg" && chart.type === "avg") {
      newType.subType = "timeseries";
      newType.mode = "chart";
      newType.type = "line";
    }

    return onChange(newType);
  };

  const _toggleAccumulation = () => {
    if (chart.subType?.indexOf("AddTimeseries") > -1) {
      return onChange({ subType: "timeseries" });
    }

    const updateData = { subType: "AddTimeseries" };
    if (chart.type === "avg") updateData.type = "line";

    return onChange(updateData);
  };

  const _onChangeMode = () => {
    setRedraw(true);

    return onChange({ mode: chart.mode === "chart" ? "kpichart" : "chart" });
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
    onRefreshData(useCache);
  };

  const _onChangeRange = (value, index, key) => {
    const newRanges = ranges.map((range, i) => {
      if (i === index) {
        const newRange = { ...range };
        newRange[key] = value;
        return newRange;
      }
      return range;
    });
    setRanges(newRanges);
  };

  const _onAddRange = () => {
    const previousRange = ranges[ranges.length - 1] || { 
      min: 0, 
      max: 100, 
      label: "Total",
      color: Object.values(chartColors)[0].hex,
    };
    
    // Get next available color
    const colorIndex = ranges.length % Object.values(chartColors).length;
    
    setRanges([
      ...ranges || [],
      { 
        min: previousRange.max, 
        max: previousRange.max + 20, 
        label: `${previousRange.max}-${previousRange.max + 20}`,
        color: Object.values(chartColors)[colorIndex].hex,
      },
    ]);
  };

  const _onRemoveRange = (index) => {
    if (ranges.length === 1) return;
    const newRanges = [...ranges];
    newRanges.splice(index, 1);
    setRanges(newRanges);
  };

  const _onChangeColor = (color, index) => {
    const newRanges = ranges.map((range, i) => {
      if (i === index) {
        return { ...range, color: color.hex };
      }
      return range;
    });
    setRanges(newRanges);
  };

  const _onSaveRanges = () => {
    setRangeErrors(null);
    // do a sanity check on the ranges
    // ensure that min is always less than max
    if (ranges.some((range) => range.min > range.max)) {
      setRangeErrors("Min values must be less than max values");
      return;
    }

    // ensure that the ranges are not overlapping
    if (ranges.some((range, index) => ranges.some((r, i) => i !== index && range.min < r.max && range.max > r.min))) {
      setRangeErrors("Ranges cannot overlap");
      return;
    }

    // ensure that the ranges are not empty
    if (ranges.some((range) => range.min === null || range.max === null)) {
      setRangeErrors("Ranges cannot be empty");
      return;
    }

    // ensure the labels are not empty
    if (ranges.some((range) => range.label === null)) {
      setRangeErrors("Labels cannot be empty");
      return;
    }

    onChange({ ranges });
  };

  return (
    <div className={"bg-content1 rounded-lg mx-auto p-4 w-full"}>
      {chart && chart.chartData && chart.ChartDatasetConfigs && (
        <>
          <div className={"w-full"}>
            <Row justify="flex-between" align="center">
              <div className="flex items-center gap-1">
                <Button
                  onPress={_onRefreshData}
                  isLoading={chartLoading}
                  size="sm"
                  endContent={<LuRefreshCw size={18} />}
                  variant="flat"
                  color="primary"
                >
                  {"Refresh chart"}
                </Button>
                <Spacer />
                <Checkbox
                  isSelected={useCache}
                  onValueChange={changeCache}
                  size="sm"
                >
                  {"Use cached data"}
                </Checkbox>
                <Tooltip
                  content="Chartbrew will use cached data for extra editing speed ⚡️"
                >
                  <div><LuInfo /></div>
                </Tooltip>
              </div>

              {_checkIfFilters() && (
                <Popover>
                  <PopoverTrigger>
                    <Link className="text-gray-500">
                      <LuListFilter />
                    </Link>
                  </PopoverTrigger>
                  <PopoverContent>
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </Row>
            {chart.ChartDatasetConfigs && conditions.length > 0 && (
              <>
                <Spacer y={2} />
                <div className="flex items-center gap-1">
                  {chart.ChartDatasetConfigs && conditions.map((c) => (
                    <Chip
                      color="primary"
                      variant={"flat"}
                      key={c.id}
                      size="sm"
                      endContent={(
                        <Link onPress={() => _onClearFilter(c)} className="text-default-500 flex items-center">
                          <LuCircleX size={14} />
                        </Link>
                      )}
                    >
                      <Text size="sm">
                        {c.type !== "date" && `${c.value}`}
                        {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                      </Text>
                    </Chip>
                  ))}
                </div>
              </>
            )}
            <Spacer y={2} />
            <Row>
              <Divider />
            </Row>
            <Spacer y={2} />
            <div className="h-[300px] w-full">
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
                  <div className="h-full">
                    <TableContainer
                      tabularData={chart.chartData}
                      datasets={chart.ChartDatasetConfigs}
                      height={400}
                      editMode
                    />
                  </div>
                )}

              {(chart.type === "kpi" || chart.type === "avg") && (
                <KpiMode chart={chart} editMode />
              )}

              {chart.type === "gauge" && (
                <GaugeChart
                  chart={chart}
                  redraw={redraw}
                  redrawComplete={_redrawComplete}
                />
              )}
            </div>
          </div>
          <Spacer y={2} />
          <div className="border-solid border-1 border-content3 px-3 py-2 rounded-2xl chart-preview-types">
            <Row align="center" wrap="wrap" className={"gap-4 justify-around"}>
              <Row className={"gap-1"}>
                <Tooltip
                  content={"Get the average value of all the points on the chart"}
                >
                  <Button
                    variant={chart.type !== "avg" ? "bordered" : "solid"}
                    color={chart.type === "avg" ? "secondary" : "default"}
                    onPress={() => _onChangeChartType({ type: "avg" })}
                    isIconOnly
                  >
                    <TbMathAvg size={24} />
                  </Button>
                </Tooltip>
                <Tooltip
                  content={chart.subType?.indexOf("AddTimeseries") > -1 ? "Turn accumulation off" : "Accumulate datasets"}
                >
                  <Button
                    variant={chart.subType?.indexOf("AddTimeseries") === -1 ? "bordered" : "solid"}
                    color={chart.subType?.indexOf("AddTimeseries") > -1 ? "secondary" : "default"}
                    onPress={_toggleAccumulation}
                    isDisabled={chart.type !== "line" && chart.type !== "bar" && chart.type !== "avg" && chart.type !== "kpi" && chart.type !== "gauge"}
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
                    onPress={() => _onChangeChartType({ type: "table" })}
                    color={chart.type === "table" ? "primary" : "default"}
                    isIconOnly
                  >
                    <BsTable size={20} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as line chart">
                  <Button
                    variant={chart.type !== "line" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "line" })}
                    color={chart.type === "line" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartLine size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as bar chart">
                  <Button
                    variant={chart.type !== "bar" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "bar" })}
                    color={chart.type === "bar" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartBar size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as a single value (KPI)">
                  <Button
                    variant={chart.type !== "kpi" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "kpi" })}
                    color={chart.type === "kpi" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbHash size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as a gauge chart">
                  <Button
                    variant={chart.type !== "gauge" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "gauge" })}
                    color={chart.type === "gauge" ? "primary" : "default"}
                    isIconOnly
                  >
                    <LuGauge size={24} />
                  </Button>
                </Tooltip>
              </Row>

              <Row className={"gap-1"}>
                <Tooltip content="Display as pie chart">
                  <Button
                    variant={chart.type !== "pie" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "pie" })}
                    color={chart.type === "pie" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartPie2 size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as doughnut chart">
                  <Button
                    variant={chart.type !== "doughnut" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "doughnut" })}
                    color={chart.type === "doughnut" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartDonut4 size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as radar chart">
                  <Button
                    variant={chart.type !== "radar" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "radar" })}
                    color={chart.type === "radar" ? "primary" : "default"}
                    isIconOnly
                  >
                    <TbChartRadar size={24} />
                  </Button>
                </Tooltip>
                <Tooltip content="Display as polar chart">
                  <Button
                    variant={chart.type !== "polar" ? "bordered" : "solid"}
                    onPress={() => _onChangeChartType({ type: "polar" })}
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
                  <CircularProgress size="lg" aria-label="Loading chart data" />
                </Row>
                <Row>
                  <Text b>Loading chart data...</Text>
                </Row>
                <Spacer y={2} />
              </>
            )}
            {!chartLoading && (
              <>
                <div className={"container mx-auto"}>
                  <Text className={"text-foreground-500 text-[20px]"}>{"Configure the dataset to get started"}</Text>
                  <Spacer y={1} />
                  <Skeleton className="rounded-lg">
                    <div className="h-5 rounded-lg bg-default-300"></div>
                  </Skeleton>
                </div>
                <Spacer y={0.5} />
              </>
            )}
          </>
        )}
      </div>

      {chart && chart.type && chart.ChartDatasetConfigs && chart.ChartDatasetConfigs.length > 0
        && chart.type !== "gauge" && (
        <div style={styles.topBuffer} className="chart-preview-growth">
          <Row align="center" className={"gap-4"}>
            <Checkbox
              isSelected={chart.mode === "kpichart"}
              onChange={_onChangeMode}
              isDisabled={chart.type === "kpi" || chart.type === "avg"}
              size="sm"
              className="min-w-[150px]"
            >
              Show KPI on chart
            </Checkbox>
            <Checkbox
              isSelected={chart.showGrowth}
              onChange={_onChangeGrowth}
              isDisabled={chart.mode === "chart" && chart.type !== "kpi"}
              size="sm"
              className="min-w-[150px]"
            >
              Show growth
            </Checkbox>
          </Row>
          <Spacer y={2} />
        </div>
      )}

      {chart && chart.type && chart.ChartDatasetConfigs && chart.ChartDatasetConfigs.length > 0
        && chart.type === "gauge" && (
        <div className="flex flex-col gap-1 mt-4">
          <div className="text-sm font-bold">Define gauge ranges</div>
          <div className="flex flex-col gap-1">
            {ranges.map((range, index) => (
              <div key={index} className={`flex flex-row ${index === 0 ? "items-end" : "items-center"} gap-2 w-full sm:flex-wrap md:flex-nowrap`}>
                <Input
                  label={index === 0 ? "Min" : ""}
                  labelPlacement="outside"
                  value={range.min}
                  onChange={(e) => _onChangeRange(parseFloat(e.target.value), index, "min")}
                  variant="bordered"
                  size="sm"
                  type="number"
                  step="0.01"
                  className="max-w-[150px]"
                />
                <Input
                  label={index === 0 ? "Max" : ""}
                  labelPlacement="outside"
                  value={range.max}
                  onChange={(e) => _onChangeRange(parseFloat(e.target.value), index, "max")}
                  variant="bordered"
                  size="sm"
                  type="number"
                  step="0.01"
                  className="max-w-[150px]"
                />
                <Input
                  label={index === 0 ? "Label" : ""}
                  labelPlacement="outside"
                  value={range.label}
                  onChange={(e) => _onChangeRange(e.target.value, index, "label")}
                  variant="bordered"
                  size="sm"
                  className="max-w-[200px]"
                />
                <Popover>
                  <PopoverTrigger>
                    <div
                      style={{ backgroundColor: range.color }}
                      className="min-w-[30px] h-[30px] rounded-lg cursor-pointer border-2 border-divider"
                      aria-label="Select color"
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <TwitterPicker
                      triangle={"hide"}
                      color={range.color}
                      onChange={(color) => _onChangeColor(color, index)}
                      colors={Object.values(chartColors).map((c) => c.hex)}
                    />
                  </PopoverContent>
                </Popover>
                {ranges.length > 1 && (
                  <Button
                    onPress={() => _onRemoveRange(index)}
                    variant="light"
                    size="sm"
                    isIconOnly
                  >
                    <LuX />
                  </Button>
                )}
              </div>
            ))}
            <Spacer y={1} />
            <div className="flex flex-row gap-2 items-center">
              <Button
                onPress={_onAddRange}
                variant="flat"
                size="sm"
                endContent={<LuPlus />}
              >
                Add range
              </Button>
              {!isEqual(ranges, chart.ranges) && (
                <Button
                  onPress={_onSaveRanges}
                  variant="flat"
                  size="sm"
                  color="primary"
                >
                  Save ranges
                </Button>
              )}
              {rangeErrors && (
                <div className="text-red-500 text-xs">
                  {rangeErrors}
                </div>
              )}
            </div>
          </div>
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
  changeCache: PropTypes.func.isRequired,
  useCache: PropTypes.bool.isRequired,
};

const mapStateToProps = (state) => {
  return {
    chartLoading: state.chart.loading,
  };
};

export default connect(mapStateToProps)(ChartPreview);
