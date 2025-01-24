import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Divider, Spacer, Input, Tooltip, Modal, Chip, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem,
} from "@heroui/react";
import moment from "moment";
import { DateRangePicker } from "react-date-range";
import { enGB } from "date-fns/locale";
import { LuCalendarDays, LuCheck, LuInfo, LuSettings, LuCircleX } from "react-icons/lu";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import { secondary, primary } from "../../../config/colors";
import { defaultStaticRanges, defaultInputRanges } from "../../../config/dateRanges";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

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

function ChartSettings({ chart, onChange, onComplete }) {
  const [initSelectionRange] = useState({
    startDate: moment().startOf("month").toDate(),
    endDate: moment().endOf("month").toDate(),
    key: "selection",
  });
  const [dateRangeModal, setDateRangeModal] = useState(false);
  const [dateRange, setDateRange] = useState(initSelectionRange);
  const [labelStartDate, setLabelStartDate] = useState("");
  const [labelEndDate, setLabelEndDate] = useState("");
  const [max, setMax] = useState("");
  const [min, setMin] = useState("");
  const [ticksNumber, setTicksNumber] = useState("");
  const [ticksSelection, setTicksSelection] = useState("default");
  const [dateFormattingModal, setDateFormattingModal] = useState(false);
  const [datesFormat, setDatesFormat] = useState(null);

  useEffect(() => {
    if (chart.startDate) {
      _onViewRange(true, true);
    }
  }, []);

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

      setLabelStartDate(newStartDate.format("ll"));
      setLabelEndDate(newEndDate.format("ll"));
    }
  }, [chart.currentEndDate, dateRange, chart.fixedStartDate]);

  const _onViewRange = (value, init) => {
    if (!value) {
      onChange({ dateRange: { startDate: null, endDate: null } });
    }

    let isModalOpen = value;
    if (init) {
      isModalOpen = false;
    }

    setDateRangeModal(isModalOpen);
  };

  const _onRemoveDateFiltering = () => {
    onChange({ dateRange: { startDate: null, endDate: null } });
  };

  const _onAddPoints = (value) => {
    onChange({ pointRadius: value });
  };

  const _onChangeStacked = () => {
    onChange({ stacked: !chart.stacked });
  };

  const _onChangeHorizontal = () => {
    onChange({ horizontal: !chart.horizontal });
  };

  const _onChangeDateRange = (range) => {
    const { startDate, endDate } = range.selection;
    setDateRange({ startDate, endDate });
  };

  const _onComplete = () => {
    const { startDate, endDate } = dateRange;

    onChange({
      dateRange: {
        startDate: moment(startDate).utcOffset(0, true).format(),
        endDate: moment(endDate).utcOffset(0, true).format(),
      }
    });

    setDateRangeModal(false);

    onComplete();
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
    <div className={"bg-content1 rounded-lg mx-auto p-4 w-full"}>
      <Row>
        <Text b>Chart Settings</Text>
      </Row>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Text>Date settings</Text>
      </Row>
      <Spacer y={1} />
      <div className="grid grid-cols-12 gap-2 justify-between">
        <div className="col-span-12 lg:col-span-6">
          <Row className={"pl-0 ml-0 gap-2"} align="center">
            <Button
              endContent={<LuCalendarDays />}
              onClick={() => _onViewRange(true)}
              variant="ghost"
              className="chart-settings-dates"
            >
              Date filter
            </Button>
            {(chart.startDate || chart.endDate) && (
              <Tooltip content="Remove date filtering">
                <Button
                  variant="light"
                  isIconOnly
                  color="danger"
                  onPress={() => _onRemoveDateFiltering()}
                  size="sm"
                >
                  <LuCircleX />
                </Button>
              </Tooltip>
            )}
            {chart.startDate && chart.endDate && (
              <Tooltip content="Date formatting">
                <Button
                  variant="light"
                  isIconOnly
                  onPress={() => setDateFormattingModal(true)}
                  size="sm"
                >
                  <LuSettings />
                </Button>
              </Tooltip>
            )}
          </Row>
          <Spacer y={1} />
          <Row className={"gap-1"} align="center">
            {chart.startDate && (
              <Chip variant="faded" color="secondary" size="sm" onClick={() => setDateRangeModal(true)}>
                <Text className={"text-foreground"}>{labelStartDate}</Text>
              </Chip>
            )}
            {chart.startDate && (<span>-</span>)}
            {chart.endDate && (
              <Chip variant="faded" color="secondary" size="sm" onClick={() => setDateRangeModal(true)}>
                <Text className="text-foreground">
                  {labelEndDate}
                </Text>
              </Chip>
            )}
          </Row>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <div className="flex flex-row items-center gap-2">
            <Checkbox
              isSelected={chart.currentEndDate}
              isDisabled={!dateRange.endDate}
              onChange={() => {
                onChange({ currentEndDate: !chart.currentEndDate });
              }}
              size="sm"
              className="chart-settings-relative"
            >
              Auto-update the date range
            </Checkbox>
            <Tooltip
              content={(
                <div style={{ padding: 5 }}>
                  <Text>
                    {"When this is enabled, the date range will be preserved but shifted to the present date."}
                  </Text>
                  <Spacer y={1} />
                  <Text>
                    {"This option takes into account the date interval as well."}
                  </Text>
                  <Spacer y={2} />
                  <ul>
                    <li>
                      <Text b>
                        {"Daily interval: the end date will be the end of the present day"}
                      </Text>
                    </li>
                    <li>
                      <Text b>
                        {"Weekly interval: the end date will be the end of the present week"}
                      </Text>
                    </li>
                    <li>
                      <Text b>
                        {"Monthly interval: the end date will be the end of the present month"}
                      </Text>
                    </li>
                  </ul>
                </div>
              )}
            >
              <div>
                <LuInfo />
              </div>
            </Tooltip>
          </div>
          <Spacer y={1} />
          <Checkbox
            isSelected={chart.fixedStartDate}
            isDisabled={!chart.currentEndDate}
            onValueChange={(selected) => {
              onChange({ fixedStartDate: selected });
            }}
            size="sm"
          >
            Fix the start date
          </Checkbox>
        </div>
      </div>
      <Spacer y={4} />
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-6 lg:col-span-6">
          <Select
            selectionMode="single"
            placeholder="Select a time interval"
            label="Time interval"
            size="sm"
            selectedKeys={[chart.timeInterval]}
            onSelectionChange={(keys) => onChange({ timeInterval: keys.currentKey })}
            variant="bordered"
            renderValue={() => (
              <Text>{timeIntervalOptions.find((option) => option.value === chart.timeInterval).text}</Text>
            )}
            className="chart-settings-interval"
            aria-label="Select a time interval"
          >
            {timeIntervalOptions.map((option) => (
              <SelectItem key={option.value} textValue={option.text}>
                {option.text}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="col-span-6 sm:col-span-12 md:col-span-6 lg:col-span-6 flex items-center">
          <Checkbox
            isSelected={chart.includeZeros}
            onChange={() => onChange({ includeZeros: !chart.includeZeros })}
            size="sm"
          >
            Allow zero values
          </Checkbox>
        </div>
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {chart.type === "line" && (
          <div>
            <Checkbox
              isSelected={chart.pointRadius > 0}
              onChange={() => {
                if (chart.pointRadius > 0) {
                  _onAddPoints(0);
                } else {
                  _onAddPoints(3);
                }
              }}
              size="sm"
            >
              Data points
            </Checkbox>
          </div>
        )}
        {chart.type === "bar" && (
          <div>
            <Checkbox
              isSelected={chart.stacked}
              onChange={_onChangeStacked}
              size="sm"
            >
              Stack datasets
            </Checkbox>
          </div>
        )}
        {chart.type === "bar" && (
          <div>
            <Checkbox
              isSelected={chart.horizontal}
              onChange={_onChangeHorizontal}
              size="sm"
            >
              Horizontal bars
            </Checkbox>
          </div>
        )}
        <div>
          <Checkbox
            isSelected={chart.displayLegend}
            onChange={() => onChange({ displayLegend: !chart.displayLegend })}
            size="sm"
          >
            Legend
          </Checkbox>
        </div>
        <div>
          <Checkbox
            isSelected={chart.dataLabels}
            onChange={() => onChange({ dataLabels: !chart.dataLabels })}
            size="sm"
          >
            Data labels
          </Checkbox>
        </div>
        {(chart.type === "line" || chart.type === "bar") && (
          <div>
            <Checkbox
              isSelected={chart.isLogarithmic}
              onValueChange={(selected) => onChange({ isLogarithmic: selected })}
              size="sm"
            >
              Logarithmic scale
            </Checkbox>
          </div>
        )}
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-2">
          <Input
            label="Max Y Axis value"
            placeholder="Enter a number"
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            variant="bordered"
            fullWidth
          />
          <div className="flex flex-row gap-1">
            {max && (
              <>
                <Button
                  disabled={!max || (max === chart.maxValue)}
                  onPress={() => onChange({ maxValue: max })}
                  color="success"
                  variant="flat"
                  size="sm"
                >
                  Save
                </Button>
                <Button
                  variant="flat"
                  color="danger"
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
        <div className="flex flex-row items-center gap-2">
          <Input
            label="Min Y Axis value"
            placeholder="Enter a number"
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            variant="bordered"
            fullWidth
          />
          <div className="flex flex-row gap-1">
            {min && (
              <>
                <Button
                  disabled={!min || (min === chart.minValue)}
                  onPress={() => onChange({ minValue: min })}
                  color="success"
                  variant="flat"
                  size="sm"
                >
                  Save
                </Button>
                <Button
                  variant="flat"
                  color="danger"
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
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="grid grid-cols-12 gap-1">
        <div className="col-span-12">
          <Select
            selectionMode="single"
            placeholder="Select the number of labels"
            label="Number of labels on the X Axis"
            size="sm"
            selectedKeys={[ticksSelection]}
            onSelectionChange={(keys) => _onChangeTicks(keys.currentKey)}
            variant="bordered"
            renderValue={() => (
              <Text>{xLabelOptions.find((option) => option.value === ticksSelection).text}</Text>
            )}
            aria-label="Select the number of labels"
          >
            {xLabelOptions.map((option) => (
              <SelectItem key={option.value} textValue={option.text}>
                {option.text}
              </SelectItem>
            ))}
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
                  variant="flat"
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

      <Modal
        isOpen={dateRangeModal}
        onClose={() => setDateRangeModal(false)}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Set a custom date range for your chart</Text>
          </ModalHeader>
          <ModalBody>
            <div>
              {chart.currentEndDate && (
                <>
                  <Text>
                    {"The date range is set to auto-update to the current date. If you want to set an exact custom date range, disable the auto-update option."}
                  </Text>
                  <Spacer y={4} />
                </>
              )}
              <div>
                <DateRangePicker
                  locale={enGB}
                  direction="horizontal"
                  rangeColors={[secondary, primary]}
                  ranges={[
                    dateRange.startDate && dateRange.endDate ? {
                      startDate: new Date(dateRange.startDate),
                      endDate: new Date(dateRange.endDate),
                      key: "selection",
                    } : initSelectionRange
                  ]}
                  onChange={_onChangeDateRange}
                  staticRanges={defaultStaticRanges}
                  inputRanges={defaultInputRanges}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDateRangeModal(false)}
            >
              Cancel
            </Button>
            <Button
              endContent={<LuCheck />}
              onPress={_onComplete}
              color="primary"
            >
              Apply date filter
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={dateFormattingModal} onClose={() => setDateFormattingModal(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <Text size="h3">Set a custom format for your dates</Text>
          </ModalHeader>
          <ModalBody>
            <Row>
              <Text>
                {"Chartbrew will use this format when injecting the dates as variables in your queries. The variables are"}
                {" "}
                <code>{"{{start_date}}"}</code>
                {" "}
                {"and"}
                {" "}
                <code>{"{{end_date}}"}</code>
                {"."}
              </Text>
            </Row>
            <Spacer y={4} />
            <Row>
              <Input
                label="Enter a date format"
                initialValue={chart.dateVarsFormat}
                value={datesFormat}
                onChange={(e) => setDatesFormat(e.target.value)}
                variant="bordered"
                fullWidth
              />
            </Row>
            <Spacer y={1} />
            <Row wrap="wrap" className={"gap-1"}>
              <Button
                color="primary"
                size="sm"
                onPress={() => setDatesFormat("YYYY-MM-DD")}
                variant="bordered"
              >
                {"YYYY-MM-DD"}
              </Button>
              <Spacer x={0.6} />
              <Button
                color="primary"
                size="sm"
                onPress={() => setDatesFormat("YYYY-MM-DD HH:mm:ss")}
                variant="bordered"
              >
                {"YYYY-MM-DD HH:mm:ss"}
              </Button>
              <Spacer x={0.6} />
              <Button
                color="primary"
                size="sm"
                onPress={() => setDatesFormat("X")}
                variant="bordered"
              >
                {"Timestamp (in seconds)"}
              </Button>
              <Spacer x={0.6} />
              <Button
                color="primary"
                size="sm"
                onPress={() => setDatesFormat("x")}
                variant="bordered"
              >
                {"Timestamp (in ms)"}
              </Button>
            </Row>
            <Spacer y={1} />
            <Row>
              <Text small>
                {"See "}
                <a
                  href="https://momentjs.com/docs/#/displaying/format/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {"moment.js documentation"}
                </a>
                {" for how to format dates."}
              </Text>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDateFormattingModal(false)}
            >
              Cancel
            </Button>
            <Button
              endContent={<LuCheck />}
              onPress={_onChangeDateFormat}
              color="primary"
            >
              Apply date format
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

ChartSettings.propTypes = {
  chart: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
};

export default ChartSettings;
