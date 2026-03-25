import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Chip, ProgressCircle, Separator, Input, Link, Popover, Skeleton, Tooltip,
} from "@heroui/react";
import {
  TbChartBar, TbChartDonut4, TbChartLine, TbChartPie2, TbChartRadar, TbGridDots, TbHash, TbMathAvg,
} from "react-icons/tb";
import { TiChartPie } from "react-icons/ti";
import { FaChartLine } from "react-icons/fa";
import { BsTable } from "react-icons/bs";
import { LuInfo, LuListFilter, LuRefreshCw, LuCircleX, LuGauge, LuX, LuPlus } from "react-icons/lu";
import { findIndex, isEqual } from "lodash";
import { TwitterPicker } from "react-color";
import { chartColors } from "../../../config/colors";

import LineChart from "../../Chart/components/LineChart";
import BarChart from "../../Chart/components/BarChart";
import RadarChart from "../../Chart/components/RadarChart";
import DoughnutChart from "../../Chart/components/DoughnutChart";
import PolarChart from "../../Chart/components/PolarChart";
import PieChart from "../../Chart/components/PieChart";
import MatrixChart from "../../Chart/components/MatrixChart";
import TableContainer from "../../Chart/components/TableView/TableContainer";
import Row from "../../../components/Row";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import KpiMode from "../../Chart/components/KpiMode";
import ChartFilters from "../../Chart/components/ChartFilters";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import GaugeChart from "../../Chart/components/GaugeChart";
import { getExposedChartFilters } from "../../../modules/getChartDatasetConditions";

function ChartPreview(props) {
  const {
    chart, onChange, onRefreshData, chartLoading, changeCache, useCache,
  } = props;

  const [redraw, setRedraw] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [rangeErrors, setRangeErrors] = useState(null);

  useEffect(() => {
    setRedraw(true);
  }, [chart.dataLabels, chart.type]);

  useEffect(() => {
    setRanges(chart.ranges || [{ 
      min: 0, 
      max: 100, 
      label: "Total",
      color: Object.values(chartColors)[0].hex,
    }]);
  }, [chart.ranges]);

  const _checkIfFilters = () => {
    return getExposedChartFilters(chart).length > 0;
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
    if (data.type === "polar" || data.type === "pie" || data.type === "doughnut" || data.type === "radar" || data.type === "table" || data.type === "matrix") {
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

  const _onChangeInvertGrowth = () => {
    setRedraw(true);

    return onChange({ invertGrowth: !chart.invertGrowth });
  };

  const _redrawComplete = () => {
    setRedraw(false);
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
                  isPending={chartLoading}
                  size="sm"
                  endContent={!chartLoading ? <LuRefreshCw size={18} /> : undefined}
                  startContent={chartLoading ? <ButtonSpinner /> : undefined}
                  variant="tertiary" >
                  {"Refresh chart"}
                </Button>
                <div className="w-2" />
                <Checkbox
                  isSelected={useCache}
                  onValueChange={changeCache}
                  size="sm"
                >
                  {"Use cached data"}
                </Checkbox>
                <Tooltip>
                  <Tooltip.Trigger>
                    <div><LuInfo /></div>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Chartbrew will use cached data for extra editing speed ⚡️</Tooltip.Content>
                </Tooltip>
              </div>

              {_checkIfFilters() && (
                <Popover>
                  <Popover.Trigger>
                    <Link className="text-gray-500">
                      <LuListFilter />
                    </Link>
                  </Popover.Trigger>
                  <Popover.Content>
                    <Popover.Dialog>
                      <ChartFilters
                        chart={chart}
                        onAddFilter={_onAddFilter}
                        onClearFilter={_onClearFilter}
                        conditions={conditions}
                      />
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              )}
            </Row>
            {chart.ChartDatasetConfigs && conditions.length > 0 && (
              <>
                <div className="h-4" />
                <div className="flex items-center gap-1">
                  {chart.ChartDatasetConfigs && conditions.map((c) => (
                    <Chip
                      variant="primary"
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
            <div className="h-4" />
            <Row>
              <Separator />
            </Row>
            <div className="h-4" />
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
                  <PieChart
                    chart={chart}
                    height={300}
                    editMode
                  />
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
              {chart.type === "matrix"
                && (
                  <MatrixChart
                    chart={chart}
                    height={300}
                    editMode
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
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
                      defaultRowsPerPage={chart.defaultRowsPerPage}
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
          <div className="h-4" />
          <div className="border-solid border border-content3 px-3 py-2 rounded-2xl chart-preview-types">
            <div className="flex flex-row gap-4 justify-around flex-wrap">
              <div className="flex flex-row gap-1">
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "avg" ? "outline" : "primary"} onPress={() => _onChangeChartType({ type: "avg" })}
                      isIconOnly
                    >
                      <TbMathAvg size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Get the average value of all the points on the chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.subType?.indexOf("AddTimeseries") === -1 ? "outline" : "primary"} onPress={_toggleAccumulation}
                      isDisabled={chart.type !== "line" && chart.type !== "bar" && chart.type !== "avg" && chart.type !== "kpi" && chart.type !== "gauge"}
                      isIconOnly
                    >
                      <FaChartLine size={20} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    {chart.subType?.indexOf("AddTimeseries") > -1 ? "Turn accumulation off" : "Accumulate datasets"}
                  </Tooltip.Content>
                </Tooltip>
              </div>

              <div className="flex flex-row gap-1">
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "table" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "table" })} isIconOnly
                    >
                      <BsTable size={20} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display data in a table view</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "line" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "line" })} isIconOnly
                    >
                      <TbChartLine size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as line chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "bar" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "bar" })} isIconOnly
                    >
                      <TbChartBar size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as bar chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "kpi" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "kpi" })} isIconOnly
                    >
                      <TbHash size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as a single value (KPI)</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "gauge" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "gauge" })} isIconOnly
                    >
                      <LuGauge size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as a gauge chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "matrix" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "matrix" })} isIconOnly
                    >
                      <TbGridDots size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as a time-based matrix chart (heatmap)</Tooltip.Content>
                </Tooltip>
              </div>

              <div className={"flex flex-row gap-1"}>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "pie" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "pie" })} isIconOnly
                    >
                      <TbChartPie2 size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as pie chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "doughnut" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "doughnut" })} isIconOnly
                    >
                      <TbChartDonut4 size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as doughnut chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "radar" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "radar" })} isIconOnly
                    >
                      <TbChartRadar size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as radar chart</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      variant={chart.type !== "polar" ? "outline" : "primary"}
                      onPress={() => _onChangeChartType({ type: "polar" })} isIconOnly
                    >
                      <TiChartPie size={24} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Display as polar chart</Tooltip.Content>
                </Tooltip>
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        {chart && chart.type && !chart.chartData && (
          <>
            {chartLoading && (
              <>
                <Row>
                  <ProgressCircle size="lg" aria-label="Loading chart data" />
                </Row>
                <Row>
                  <Text b>Loading chart data...</Text>
                </Row>
                <div className="h-4" />
              </>
            )}
            {!chartLoading && (
              <>
                <div className={"container mx-auto"}>
                  <Text className={"text-foreground-500 text-[20px]"}>{"Configure the dataset to get started"}</Text>
                  <div className="h-2" />
                  <Skeleton className="rounded-lg">
                    <div className="h-5 rounded-lg bg-default-300"></div>
                  </Skeleton>
                </div>
                <div className="h-1" />
              </>
            )}
          </>
        )}
      </div>

      {chart && chart.type && chart.ChartDatasetConfigs && chart.ChartDatasetConfigs.length > 0
        && chart.type !== "gauge" && chart.type !== "matrix" && (
        <div style={styles.topBuffer} className="chart-preview-growth">
          <div className="flex flex-row items-center gap-4">
            <Checkbox
              isSelected={chart.mode === "kpichart"}
              onChange={_onChangeMode}
              isDisabled={chart.type === "kpi" || chart.type === "avg"}
              size="sm"
            >
              Show KPI on chart
            </Checkbox>
            <Checkbox
              isSelected={chart.showGrowth}
              onChange={_onChangeGrowth}
              isDisabled={chart.mode === "chart" && chart.type !== "kpi"}
              size="sm"
            >
              Show growth
            </Checkbox>
            <Checkbox
              isSelected={chart.invertGrowth}
              onChange={_onChangeInvertGrowth}
              size="sm"
            >
              Invert growth
            </Checkbox>
          </div>
          <div className="h-4" />
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
                  variant="secondary"
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
                  variant="secondary"
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
                  variant="secondary"
                  size="sm"
                  className="max-w-[200px]"
                />
                <Popover>
                  <Popover.Trigger>
                    <div
                      style={{ backgroundColor: range.color }}
                      className="min-w-[30px] h-[30px] rounded-lg cursor-pointer border-2 border-divider"
                      aria-label="Select color"
                    />
                  </Popover.Trigger>
                  <Popover.Content>
                    <Popover.Dialog>
                      <TwitterPicker
                        triangle={"hide"} onChange={(color) => _onChangeColor(color, index)}
                        colors={Object.values(chartColors).map((c) => c.hex)}
                      />
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
                {ranges.length > 1 && (
                  <Button
                    onPress={() => _onRemoveRange(index)}
                    variant="ghost"
                    size="sm"
                    isIconOnly
                  >
                    <LuX />
                  </Button>
                )}
              </div>
            ))}
            <div className="h-2" />
            <div className="flex flex-row gap-2 items-center">
              <Button
                onPress={_onAddRange}
                variant="tertiary"
                size="sm"
                endContent={<LuPlus />}
              >
                Add range
              </Button>
              {!isEqual(ranges, chart.ranges) && (
                <Button
                  onPress={_onSaveRanges}
                  variant="tertiary"
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
