import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import {
  Button, Checkbox, Chip, Description, Header, Input, Label, TextField, Link, ListBox, Popover, Select, Skeleton, Tooltip,
} from "@heroui/react";
import {
  TbChartBar, TbChartDonut4, TbChartLine, TbChartPie2, TbChartRadar, TbGridDots, TbHash,
  TbMathAvg,
} from "react-icons/tb";
import { TiChartPie } from "react-icons/ti";
import { BsTable } from "react-icons/bs";
import { LuInfo, LuListFilter, LuRefreshCw, LuCircleX, LuGauge, LuX, LuPlus, LuChartBarBig, LuMap } from "react-icons/lu";
import { findIndex, isEqual } from "lodash";
import { chartColors } from "../../../config/colors";

import ChartRenderer from "../../Chart/components/ChartRenderer";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import ChartFilters from "../../Chart/components/ChartFilters";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { getExposedChartFilters } from "../../../modules/getChartDatasetConditions";
import ColorPickerControl from "../../../components/ColorPickerControl";
import { getPresetDefinition, hasPresetCapability } from "../../../visualization/presetRegistry";

const chartTypeGroups = [
  {
    label: "Trends and comparisons",
    types: [["line", TbChartLine], ["bar", TbChartBar], ["horizontalBar", LuChartBarBig], ["radar", TbChartRadar]],
  },
  {
    label: "Parts of a whole",
    types: [["pie", TbChartPie2], ["doughnut", TbChartDonut4], ["polar", TiChartPie]],
  },
  {
    label: "Summary",
    types: [["kpi", TbHash], ["gauge", LuGauge], ["avg", TbMathAvg]],
  },
  {
    label: "Tables and maps",
    types: [["table", BsTable], ["matrix", TbGridDots], ["map", LuMap]],
  },
];

export function ChartPreviewAppearance({ chart, onChange }) {
  const [ranges, setRanges] = useState([]);
  const [rangeErrors, setRangeErrors] = useState(null);
  const supportsKpiOverlay = hasPresetCapability(chart?.type, "kpiOverlay");
  const supportsGrowth = supportsKpiOverlay || hasPresetCapability(chart?.type, "growth");

  useEffect(() => {
    setRanges(chart.ranges || [{
      min: 0,
      max: 100,
      label: "Total",
      color: Object.values(chartColors)[0].hex,
    }]);
  }, [chart.ranges]);

  const _toggleAccumulation = () => {
    if (chart.subType?.indexOf("AddTimeseries") > -1) {
      return onChange({ subType: "timeseries" });
    }

    const updateData = { subType: "AddTimeseries" };
    if (chart.type === "avg") updateData.type = "line";

    return onChange(updateData);
  };

  const _onChangeMode = (selected) => onChange({ mode: selected ? "kpichart" : "chart" });
  const _onChangeGrowth = (selected) => onChange({ showGrowth: selected });
  const _onChangeInvertGrowth = (selected) => onChange({ invertGrowth: selected });
  const _onChangeRange = (value, index, key) => {
    setRanges(ranges.map((range, rangeIndex) => (
      rangeIndex === index ? { ...range, [key]: value } : range
    )));
  };
  const _onAddRange = () => {
    const previousRange = ranges[ranges.length - 1] || {
      min: 0,
      max: 100,
      label: "Total",
      color: Object.values(chartColors)[0].hex,
    };
    const colorIndex = ranges.length % Object.values(chartColors).length;
    setRanges([...ranges, {
      min: previousRange.max,
      max: previousRange.max + 20,
      label: `${previousRange.max}-${previousRange.max + 20}`,
      color: Object.values(chartColors)[colorIndex].hex,
    }]);
  };
  const _onRemoveRange = (index) => {
    if (ranges.length === 1) return;
    setRanges(ranges.filter((_range, rangeIndex) => rangeIndex !== index));
  };
  const _onChangeColor = (color, index) => {
    _onChangeRange(color, index, "color");
  };
  const _onSaveRanges = () => {
    setRangeErrors(null);
    if (ranges.some((range) => range.min > range.max)) {
      setRangeErrors("Min values must be less than max values");
      return;
    }
    if (ranges.some((range, index) => ranges.some((otherRange, otherIndex) => (
      otherIndex !== index && range.min < otherRange.max && range.max > otherRange.min
    )))) {
      setRangeErrors("Ranges cannot overlap");
      return;
    }
    if (ranges.some((range) => range.min === null || range.max === null)) {
      setRangeErrors("Ranges cannot be empty");
      return;
    }
    if (ranges.some((range) => range.label === null)) {
      setRangeErrors("Labels cannot be empty");
      return;
    }
    onChange({ ranges });
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Checkbox
        isDisabled={!["line", "bar", "avg", "kpi", "gauge"].includes(chart.type)}
        isSelected={chart.subType?.includes("AddTimeseries") || false}
        onChange={_toggleAccumulation}
        variant="secondary"
      >
        <Checkbox.Content>
          <Checkbox.Control className="size-4 shrink-0">
            <Checkbox.Indicator />
          </Checkbox.Control>
          Accumulate datasets
        </Checkbox.Content>
      </Checkbox>
      {chart.ChartDatasetConfigs?.length > 0 && supportsGrowth ? (
        <div className="chart-preview-growth">
          <div className="flex flex-row flex-wrap items-center gap-4">
            {supportsKpiOverlay ? (
              <Checkbox
                id="chart-preview-kpi-mode"
                isSelected={chart.mode === "kpichart"}
                onChange={_onChangeMode}
                variant="secondary"
              >
                <Checkbox.Content>
                  <Checkbox.Control className="size-4 shrink-0"><Checkbox.Indicator /></Checkbox.Control>
                  Show KPI on chart
                </Checkbox.Content>
              </Checkbox>
            ) : null}
            <Checkbox
              id="chart-preview-growth"
              isDisabled={supportsKpiOverlay && chart.mode !== "kpichart"}
              isSelected={chart.showGrowth}
              onChange={_onChangeGrowth}
              variant="secondary"
            >
              <Checkbox.Content>
                <Checkbox.Control className="size-4 shrink-0"><Checkbox.Indicator /></Checkbox.Control>
                Show growth
              </Checkbox.Content>
            </Checkbox>
            <Checkbox
              id="chart-preview-invert-growth"
              isDisabled={supportsKpiOverlay && chart.mode !== "kpichart"}
              isSelected={chart.invertGrowth}
              onChange={_onChangeInvertGrowth}
              variant="secondary"
            >
              <Checkbox.Content>
                <Checkbox.Control className="size-4 shrink-0"><Checkbox.Indicator /></Checkbox.Control>
                Invert growth
              </Checkbox.Content>
            </Checkbox>
          </div>
        </div>
      ) : null}

      {chart.ChartDatasetConfigs?.length > 0 && chart.type === "gauge" ? (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold">Gauge ranges</div>
          <div className="flex flex-col gap-2">
            {ranges.map((range, index) => (
              <div className="flex w-full flex-wrap items-end gap-2" key={index}>
                <TextField className="min-w-0 flex-1 basis-28" name={`range-${index}-min`}>
                  <Label>Min</Label>
                  <Input
                    onChange={(event) => _onChangeRange(parseFloat(event.target.value), index, "min")}
                    size="sm"
                    step="0.01"
                    type="number"
                    value={range.min}
                    variant="secondary"
                  />
                </TextField>
                <TextField className="min-w-0 flex-1 basis-28" name={`range-${index}-max`}>
                  <Label>Max</Label>
                  <Input
                    onChange={(event) => _onChangeRange(parseFloat(event.target.value), index, "max")}
                    size="sm"
                    step="0.01"
                    type="number"
                    value={range.max}
                    variant="secondary"
                  />
                </TextField>
                <TextField className="min-w-0 flex-1 basis-28" name={`range-${index}-label`}>
                  <Label>Label</Label>
                  <Input
                    onChange={(event) => _onChangeRange(event.target.value, index, "label")}
                    size="sm"
                    value={range.label}
                    variant="secondary"
                  />
                </TextField>
                <ColorPickerControl
                  ariaLabel={`Range ${index + 1} color`}
                  fallbackColor={chartColors.blue.hex}
                  onChange={(color) => _onChangeColor(color, index)}
                  presetColors={Object.values(chartColors).map((color) => color.hex)}
                  renderTrigger={() => (
                    <div
                      aria-label={`Range ${index + 1} color`}
                      className="h-[30px] min-w-[30px] cursor-pointer rounded-lg border-2 border-divider"
                      style={{ backgroundColor: range.color }}
                    />
                  )}
                  value={range.color}
                />
                {ranges.length > 1 ? (
                  <Button aria-label={`Remove range ${index + 1}`} isIconOnly onPress={() => _onRemoveRange(index)} size="sm" variant="ghost">
                    <LuX />
                  </Button>
                ) : null}
              </div>
            ))}
            <div className="flex flex-row flex-wrap items-center gap-2">
              <Button onPress={_onAddRange} size="sm" variant="tertiary">Add range<LuPlus /></Button>
              {!isEqual(ranges, chart.ranges) ? (
                <Button onPress={_onSaveRanges} size="sm" variant="secondary">Save ranges</Button>
              ) : null}
              {rangeErrors ? <div className="text-xs text-danger">{rangeErrors}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

ChartPreviewAppearance.propTypes = {
  chart: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

function ChartPreview(props) {
  const {
    chart, onChange, onRefreshData, chartLoading, changeCache, transitioning, useCache,
    showAppearanceControls, studio, viewControl,
  } = props;

  const [redraw, setRedraw] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [previewHeight, setPreviewHeight] = useState(300);
  const previewRef = useRef(null);
  const SelectedChartIcon = chartTypeGroups.flatMap((group) => group.types)
    .find(([type]) => type === chart?.type)?.[1];

  useEffect(() => {
    setRedraw(true);
  }, [
    chart.dataLabels,
    chart.invertGrowth,
    chart.mode,
    chart.showGrowth,
    chart.type,
    chart.visualization?.settings?.dataLabels,
    chart.visualization?.settings?.dataLabelsFormat,
  ]);

  useEffect(() => {
    if (!previewRef.current) return undefined;
    const updateHeight = () => setPreviewHeight(Math.max(240, previewRef.current.clientHeight));
    const observer = new ResizeObserver(updateHeight);
    observer.observe(previewRef.current);
    updateHeight();
    return () => observer.disconnect();
  }, []);

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
    if (data.type === "polar" || data.type === "pie" || data.type === "doughnut" || data.type === "radar" || data.type === "table" || data.type === "matrix" || data.type === "map") {
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

  const _redrawComplete = () => {
    setRedraw(false);
  };

  const _onRefreshData = () => {
    setRedraw(true);
    onRefreshData();
  };

  return (
    <div className={studio
      ? "chart-studio-preview-content flex h-full min-h-0 w-full flex-col bg-surface"
      : "bg-surface rounded-3xl mx-auto p-4 w-full"}
    >
      {chart && chart.type && (chart.render?.configuration || chartLoading || chart.ChartDatasetConfigs?.length > 0) && (
        <div className={studio ? "chart-studio-preview-toolbar w-full" : "w-full"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                aria-label="Chart type"
                className="w-48 shrink-0"
                disabledKeys={chart.visualization?.layers?.length > 1 ? ["map"] : []}
                onChange={(type) => {
                  if (!type || type === chart.type) return;
                  _onChangeChartType(["bar", "horizontalBar"].includes(type)
                    ? { horizontal: false, type }
                    : { type });
                }}
                selectionMode="single"
                value={chart.type}
                variant="secondary"
              >
                <Select.Trigger className="h-8 min-h-8 items-center py-0">
                  <Select.Value className="flex min-w-0 items-center gap-2 text-sm">
                    {SelectedChartIcon && <SelectedChartIcon aria-hidden className="size-4 shrink-0 text-muted" />}
                    <span className="truncate">{getPresetDefinition(chart.type)?.label}</span>
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="min-w-64" placement="bottom start">
                  <ListBox aria-label="Chart types">
                    {chartTypeGroups.map((group) => (
                      <ListBox.Section key={group.label}>
                        <Header>{group.label}</Header>
                        {group.types.map(([type, Icon]) => (
                          <ListBox.Item id={type} key={type} textValue={getPresetDefinition(type).label}>
                            <Icon aria-hidden className="size-5 shrink-0 text-muted" />
                            <div className="flex flex-col">
                              <Label>{getPresetDefinition(type).label}</Label>
                              {type === "map" && chart.visualization?.layers?.length > 1 ? (
                                <Description>Use one dataset and one value for a map</Description>
                              ) : null}
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox.Section>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Button
                onPress={_onRefreshData}
                isPending={chartLoading}
                size="sm"
                variant="tertiary"
              >
                {chartLoading ? <ButtonSpinner /> : null}
                {"Refresh chart"}
                {!chartLoading ? <LuRefreshCw size={18} /> : null}
              </Button>
              <div className="flex items-center gap-1">
                <Checkbox
                  id="chart-preview-use-cache"
                  isSelected={useCache}
                  onChange={changeCache}
                  variant="secondary"
                >
                  <Checkbox.Content>
                    <Checkbox.Control className="size-4 shrink-0">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    Use cached data
                  </Checkbox.Content>
                </Checkbox>
                <Tooltip>
                  <Tooltip.Trigger>
                    <div><LuInfo /></div>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Chartbrew will use cached data for extra editing speed ⚡️</Tooltip.Content>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {viewControl}
              {_checkIfFilters() && (
                <Popover>
                  <Popover.Trigger>
                    <Link aria-label="Chart filters" className="text-gray-500">
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
            </div>
          </div>
          {chart.ChartDatasetConfigs && conditions.length > 0 && (
            <>
              <div className="h-4" />
              <div className="flex flex-wrap items-center gap-2">
                {chart.ChartDatasetConfigs && conditions.map((c) => (
                  <Chip
                    variant="primary"
                    key={c.id}
                    size="sm"
                  >
                    <Text size="sm">
                      {c.type !== "date" && `${c.value}`}
                      {c.type === "date" && format(new Date(c.value), "Pp", { locale: enGB })}
                    </Text>
                    <Link onPress={() => _onClearFilter(c)} className="text-default-500 flex items-center">
                      <LuCircleX size={14} />
                    </Link>
                  </Chip>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {chart && chart.render?.configuration && chart.ChartDatasetConfigs && (
        <div
          className={studio
            ? "chart-studio-chart-canvas flex w-full items-center justify-center"
            : "flex h-[300px] w-full items-center justify-center"}
          ref={previewRef}
        >
          <div className="h-full w-full min-h-0">
            <ChartRenderer
              chart={chart}
              editMode
              height={previewHeight}
              loading={chartLoading || transitioning}
              redraw={redraw}
              redrawComplete={_redrawComplete}
            />
          </div>
        </div>
      )}

      {chart && chart.type && !chart.render?.configuration && (
        <div
          className={studio
            ? "chart-studio-chart-canvas flex w-full items-center justify-center"
            : "flex h-[300px] w-full items-center justify-center"}
          ref={previewRef}
        >
          {chartLoading ? (
            <div className="h-full w-full" role="status" aria-label="Loading chart data">
              <Skeleton className="h-full w-full rounded-3xl" />
            </div>
          ) : (
            <Text className="text-muted text-[20px]">Configure the dataset to get started</Text>
          )}
        </div>
      )}

      {showAppearanceControls ? <ChartPreviewAppearance chart={chart} onChange={onChange} /> : null}
    </div>
  );
}

ChartPreview.propTypes = {
  chart: PropTypes.object.isRequired,
  chartLoading: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onRefreshData: PropTypes.func.isRequired,
  onRefreshPreview: PropTypes.func.isRequired,
  changeCache: PropTypes.func.isRequired,
  transitioning: PropTypes.bool,
  useCache: PropTypes.bool.isRequired,
  showAppearanceControls: PropTypes.bool,
  studio: PropTypes.bool,
  viewControl: PropTypes.node,
};

ChartPreview.defaultProps = {
  showAppearanceControls: true,
  studio: false,
  transitioning: false,
  viewControl: null,
};

const mapStateToProps = (state) => {
  return {
    chartLoading: state.chart.loading,
  };
};

export default connect(mapStateToProps)(ChartPreview);
