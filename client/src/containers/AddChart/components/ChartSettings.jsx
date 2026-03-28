import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Separator, Input, Tooltip, Modal, Select,
  Label, ListBox,
  TextField,
} from "@heroui/react";
import moment from "moment";
import { LuCheck, LuInfo, LuSettings, LuCircleX } from "react-icons/lu";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import Row from "../../../components/Row";
import Text from "../../../components/Text";
import DateRangeFilter from "../../ProjectDashboard/components/DateRangeFilter";

const xLabelOptions = [{
  key: "default",
  value: "default",
  text: "Default",
}, {
  key: "showAll",
  value: "showAll",
  text: "Show all"
}, {
  key: "half",
  value: "half",
  text: "Half of the values"
}, {
  key: "third",
  value: "third",
  text: "A third of the values",
}, {
  key: "fourth",
  value: "fourth",
  text: "A fourth of the values",
}, {
  key: "custom",
  value: "custom",
  text: "Custom",
}];

const timeIntervalOptions = [{
  text: "Seconds interval",
  value: "second",
}, {
  text: "Minutes interval",
  value: "minute",
}, {
  text: "Hourly interval",
  value: "hour",
}, {
  text: "Daily interval",
  value: "day",
}, {
  text: "Weekly interval",
  value: "week",
}, {
  text: "Monthly interval",
  value: "month",
}, {
  text: "Yearly interval",
  value: "year",
}];

const tableRowOptions = [{
  text: "5 rows per page",
  value: "5",
},{
  text: "10 rows per page",
  value: "10",
}, {
  text: "20 rows per page",
  value: "20",
}, {
  text: "30 rows per page",
  value: "30",
}, {
  text: "40 rows per page",
  value: "40",
}, {
  text: "50 rows per page",
  value: "50",
}];

function ChartSettings({ chart, onChange }) {
  const [initSelectionRange] = useState({
    startDate: moment().startOf("month").toDate(),
    endDate: moment().endOf("month").toDate(),
    key: "selection",
  });
  const [dateRange, setDateRange] = useState(initSelectionRange);
  const [max, setMax] = useState("");
  const [min, setMin] = useState("");
  const [ticksNumber, setTicksNumber] = useState("");
  const [ticksSelection, setTicksSelection] = useState("default");
  const [dateFormattingModal, setDateFormattingModal] = useState(false);
  const [datesFormat, setDatesFormat] = useState(null);

  useEffect(() => {
    if (chart.maxValue || chart.maxValue === 0) {
      setMax(chart.maxValue);
    }
    if (chart.maxValue === null) {
      setMax("");
    }
    if (chart.minValue || chart.minValue === 0) {
      setMin(chart.minValue);
    }
    if (chart.minValue === null) {
      setMin("");
    }
  }, [chart.maxValue, chart.minValue]);

  useEffect(() => {
    setDateRange({ startDate: chart.startDate, endDate: chart.endDate });
    if (chart.dateVarsFormat) {
      setDatesFormat(chart.dateVarsFormat);
    }
  }, [chart.startDate, chart.endDate]);

  useEffect(() => {
    if (!chart.xLabelTicks || chart.xLabelTicks === "default") {
      setTicksSelection("default");
    } else if (chart.xLabelTicks !== "showAll" && chart.xLabelTicks !== "half" && chart.xLabelTicks !== "third" && chart.xLabelTicks !== "fourth") {
      setTicksSelection("custom");
      setTicksNumber(chart.xLabelTicks);
    } else {
      setTicksSelection(chart.xLabelTicks);
    }
  }, [chart.xLabelTicks]);

  useEffect(() => {
    if (chart.startDate && chart.endDate) {
      let newStartDate = moment(chart.startDate);
      let newEndDate = moment(chart.endDate);

      if (chart.currentEndDate) {
        const timeDiff = newEndDate.diff(newStartDate, chart.timeInterval);
        newEndDate = moment().utcOffset(0, true).endOf(chart.timeInterval);

        if (!chart.fixedStartDate) {
          newStartDate = newEndDate.clone().subtract(timeDiff, chart.timeInterval).startOf(chart.timeInterval);
        }
      }
    }
  }, [chart.currentEndDate, dateRange, chart.fixedStartDate]);

  const _onRemoveDateFiltering = () => {
    onChange({ dateRange: { startDate: null, endDate: null } });
  };

  const _onAddPoints = (value) => {
    onChange({ pointRadius: value });
  };

  const _onChangeDateRangeNew = ({ startDate, endDate }) => {
    setDateRange({ startDate, endDate });
    onChange({
      dateRange: {
        startDate: moment(startDate).utcOffset(0, true).format(),
        endDate: moment(endDate).utcOffset(0, true).format(),
      }
    });
  };

  const _onChangeTicks = (value) => {
    onChange({ xLabelTicks: value });
  };

  const _onChangeTickCustomValue = (value) => {
    setTicksNumber(value);
  };

  const _onConfirmTicksNumber = () => {
    onChange({ xLabelTicks: `${ticksNumber}` });
  };

  const _onChangeDateFormat = () => {
    onChange({ dateVarsFormat: datesFormat });
    setDateFormattingModal(false);
  };

  return (
    <div className={"bg-surface rounded-3xl mx-auto p-4 w-full"}>
      <Row>
        <Text b>Chart Settings</Text>
      </Row>

      <div className="h-4" />
      <Separator />
      <div className="h-4" />

      <div className="text-sm text-gray-500">Date settings</div>
      <div className="h-2" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-2 flex-wrap">
          <div>
            <DateRangeFilter
              startDate={chart.startDate}
              endDate={chart.endDate}
              onChange={_onChangeDateRangeNew}
            />
          </div>
          {(chart.startDate || chart.endDate) && (
            <Tooltip>
              <Tooltip.Trigger>
                <Button
                  variant="ghost"
                  isIconOnly onPress={() => _onRemoveDateFiltering()}
                  size="sm"
                >
                  <LuCircleX />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Remove date filtering</Tooltip.Content>
            </Tooltip>
          )}
          {chart.startDate && chart.endDate && (
            <Tooltip>
              <Tooltip.Trigger>
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() => setDateFormattingModal(true)}
                  size="sm"
                >
                  <LuSettings />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Date formatting</Tooltip.Content>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <Checkbox
              id="chart-settings-current-end"
              isSelected={chart.currentEndDate}
              isDisabled={!dateRange.endDate}
              onChange={(selected) => onChange({ currentEndDate: selected })}
              className="chart-settings-relative"
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-settings-current-end" className="text-sm">Auto-update the date range</Label>
              </Checkbox.Content>
            </Checkbox>
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <div>
                  <LuInfo size={16} />
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <div style={{ padding: 5 }}>
                  <div className="text-sm">
                    {"When this is enabled, the date range will be preserved but shifted to the present date."}
                  </div>
                  <div className="h-2" />
                  <div className="text-sm">
                    {"This option takes into account the date interval as well."}
                  </div>
                  <div className="h-4" />
                  <ul>
                    <li>
                      <div className="text-sm font-bold">
                        {"Daily interval: the end date will be the end of the present day"}
                      </div>
                    </li>
                    <li>
                      <div className="text-sm font-bold">
                        {"Weekly interval: the end date will be the end of the present week"}
                      </div>
                    </li>
                    <li>
                      <div className="text-sm font-bold">
                        {"Monthly interval: the end date will be the end of the present month"}
                      </div>
                    </li>
                  </ul>
                </div>
              </Tooltip.Content>
            </Tooltip>
          </div>
          <div className="h-2" />
          <Checkbox
            id="chart-settings-fixed-start"
            isSelected={chart.fixedStartDate}
            isDisabled={!chart.currentEndDate}
            onChange={(selected) => onChange({ fixedStartDate: selected })}
            variant="secondary"
          >
            <Checkbox.Control className="size-4 shrink-0">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label htmlFor="chart-settings-fixed-start" className="text-sm">Fix the start date</Label>
            </Checkbox.Content>
          </Checkbox>
        </div>
      </div>
      <div className="h-4" />
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-6 lg:col-span-6">
          <Select
            selectionMode="single"
            placeholder="Select a time interval"
            size="sm"
            value={chart.timeInterval || null}
            onChange={(value) => onChange({ timeInterval: value })}
            variant="secondary"
            className="chart-settings-interval"
            aria-label="Select a time interval"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {timeIntervalOptions.map((option) => (
                  <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                    {option.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="col-span-6 sm:col-span-12 md:col-span-6 lg:col-span-6 flex items-center">
          <Checkbox
            id="chart-settings-include-zeros"
            isSelected={chart.includeZeros}
            onChange={(selected) => onChange({ includeZeros: selected })}
            variant="secondary"
          >
            <Checkbox.Control className="size-4 shrink-0">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label htmlFor="chart-settings-include-zeros" className="text-sm">Allow zero values</Label>
            </Checkbox.Content>
          </Checkbox>
        </div>
      </div>

      <div className="h-4" />
      <Separator />
      <div className="h-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {chart.type === "line" && (
          <div>
            <Checkbox
              id="chart-settings-data-points"
              isSelected={chart.pointRadius > 0}
              onChange={(selected) => _onAddPoints(selected ? 3 : 0)}
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-settings-data-points" className="text-sm">Data points</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}
        {chart.type === "bar" && (
          <div>
            <Checkbox
              id="chart-settings-stacked"
              isSelected={chart.stacked}
              onChange={(selected) => onChange({ stacked: selected })}
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-settings-stacked" className="text-sm">Stack datasets</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}
        {chart.type === "bar" && (
          <div>
            <Checkbox
              id="chart-settings-horizontal"
              isSelected={chart.horizontal}
              onChange={(selected) => onChange({ horizontal: selected })}
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-settings-horizontal" className="text-sm">Horizontal bars</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}
        <div>
          <Checkbox
            id="chart-settings-legend"
            isSelected={chart.displayLegend}
            onChange={(selected) => onChange({ displayLegend: selected })}
            isDisabled={chart.type === "matrix"}
            variant="secondary"
          >
            <Checkbox.Control className="size-4 shrink-0">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label htmlFor="chart-settings-legend" className="text-sm">Legend</Label>
            </Checkbox.Content>
          </Checkbox>
        </div>
        <div>
          <Checkbox
            id="chart-settings-data-labels"
            isSelected={chart.dataLabels}
            onChange={(selected) => onChange({ dataLabels: selected })}
            isDisabled={chart.type === "matrix"}
            variant="secondary"
          >
            <Checkbox.Control className="size-4 shrink-0">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label htmlFor="chart-settings-data-labels" className="text-sm">Data labels</Label>
            </Checkbox.Content>
          </Checkbox>
        </div>
        {(chart.type === "line" || chart.type === "bar") && (
          <div>
            <Checkbox
              id="chart-settings-log-scale"
              isSelected={chart.isLogarithmic}
              onChange={(selected) => onChange({ isLogarithmic: selected })}
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-settings-log-scale" className="text-sm">Logarithmic scale</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}
        {chart.type === "line" && (
          <div>
            <Checkbox
              id="chart-settings-dashed-last"
              isSelected={chart.dashedLastPoint}
              onChange={(selected) => onChange({ dashedLastPoint: selected })}
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="chart-settings-dashed-last" className="text-sm">Dashed last point</Label>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}
      </div>

      <div className="h-4" />
      <Separator />
      <div className="h-4" />

      <div className="flex flex-col gap-2">
        {chart.type !== "table" && (
          <>
            <div className="flex flex-row items-end gap-2">
              <TextField name="max-y-axis-value" className="w-full">
                <Label>Max Y Axis value</Label>
                <Input
                  placeholder="Enter a number"
                  type="number"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  fullWidth
                  variant="secondary"
                />
              </TextField>
              <div className="flex flex-row gap-1">
                {max && (
                  <>
                    <Button
                      isDisabled={!max || (max === chart.maxValue)}
                      onPress={() => onChange({ maxValue: max })}
                      variant="secondary"
                      size="sm"
                    >
                      Save
                    </Button>
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        onChange({ maxValue: null });
                        setMax("");
                      }}
                      size="sm"
                    >
                      Clear
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-row items-end gap-2">
              <TextField name="min-y-axis-value" className="w-full">
                <Label>Min Y Axis value</Label>
                <Input
                  placeholder="Enter a number"
                  type="number"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                  fullWidth
                  variant="secondary"
                />
              </TextField>
              <div className="flex flex-row items-center gap-1">
                {min && (
                  <>
                    <Button
                      isDisabled={!min || (min === chart.minValue)}
                      onPress={() => onChange({ minValue: min })} variant="secondary"
                      size="sm"
                    >
                      Save
                    </Button>
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        onChange({ minValue: null });
                        setMin("");
                      }}
                      size="sm"
                    >
                      Clear
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {chart.type === "table" && (
          <>
            <Select
              selectionMode="single"
              placeholder="Default rows per page"
              value={`${chart.defaultRowsPerPage}` || null}
              onChange={(value) => onChange({ defaultRowsPerPage: parseInt(value, 10) })}
              variant="secondary"
            >
              <Label>Default rows per page</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {tableRowOptions.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                      {option.text}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </>
        )}
      </div>

      <div className="h-4" />
      <Separator />
      <div className="h-4" />

      <div className="grid grid-cols-12 gap-1">
        <div className="col-span-12">
          <Select
            selectionMode="single"
            placeholder="Select the number of labels"
            size="sm"
            value={ticksSelection || null}
            onChange={(value) => _onChangeTicks(value)}
            variant="secondary"
            aria-label="Select the number of labels"
          >
            <Label>Number of labels on the X Axis</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {xLabelOptions.map((option) => (
                  <ListBox.Item key={option.value} id={option.value} textValue={option.text}>
                    {option.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        {ticksSelection === "custom" && (
          <div className="col-span-12">
            <Input
              label="Enter the number of labels"
              placeholder="Enter a number"
              value={ticksNumber}
              onChange={(e) => _onChangeTickCustomValue(e.target.value)}
              type="number"
              action={{
                color: "green",
                icon: "checkmark",
                content: "Save",
                onClick: () => _onConfirmTicksNumber(),
              }}
              endContent={(
                <Button
                  variant="tertiary"
                  color="success"
                  onPress={() => _onConfirmTicksNumber()}
                  auto
                >
                  Save
                </Button>
              )}
            />
          </div>
        )}
      </div>

      <Modal.Backdrop isOpen={dateFormattingModal} onOpenChange={setDateFormattingModal}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-xl">
          <Modal.Header>
            <Modal.Heading>Set a custom format for your dates</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="text-sm">
              {"Chartbrew will use this format when injecting the dates as variables in your queries. The variables are"}
              {" "}
              <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">{"{{start_date}}"}</code>
              {" "}
              {"and"}
              {" "}
              <code className="rounded-md bg-default/40 px-1.5 py-0.5 text-sm text-default-700">{"{{end_date}}"}</code>
              {"."}
            </div>
            <div>
              <Input
                label="Enter a date format"
                initialValue={chart.dateVarsFormat}
                value={datesFormat}
                onChange={(e) => setDatesFormat(e.target.value)}
                fullWidth
                size="sm"
              />
            </div>
            <div className="flex flex-row flex-wrap gap-1">
              <Button size="sm"
                onPress={() => setDatesFormat("YYYY-MM-DD")}
                variant="tertiary"
              >
                {"YYYY-MM-DD"}
              </Button>
              <Button size="sm"
                onPress={() => setDatesFormat("YYYY-MM-DD HH:mm:ss")}
                variant="tertiary"
              >
                {"YYYY-MM-DD HH:mm:ss"}
              </Button>
              <Button size="sm"
                onPress={() => setDatesFormat("X")}
                variant="tertiary"
              >
                {"Timestamp (in seconds)"}
              </Button>
              <Button size="sm"
                onPress={() => setDatesFormat("x")}
                variant="tertiary"
              >
                {"Timestamp (in ms)"}
              </Button>
            </div>
            <div className="text-sm">
              {"See "}
              <a
                href="https://momentjs.com/docs/#/displaying/format/"
                target="_blank"
                rel="noreferrer"
              >
                {"moment.js documentation"}
              </a>
              {" for how to format dates."}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setDateFormattingModal(false)}
            >
              Cancel
            </Button>
            <Button
              onPress={_onChangeDateFormat}
            >
              <LuCheck size={18} />
              Apply date format
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

ChartSettings.propTypes = {
  chart: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
};

export default ChartSettings;
