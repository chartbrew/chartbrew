import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Link, Checkbox, Container, Divider, Grid, Row, Spacer,
  Text, Input, Dropdown, Tooltip, Modal, Badge,
} from "@nextui-org/react";
import {
  Calendar, ChevronDown, CloseSquare, InfoCircle, Setting, TickSquare
} from "react-iconly";
import moment from "moment";
import { DateRangePicker } from "react-date-range";
import { enGB } from "date-fns/locale";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import { secondary, primary } from "../../../config/colors";
import { defaultStaticRanges, defaultInputRanges } from "../../../config/dateRanges";

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

function ChartSettings(props) {
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

  const {
    type, pointRadius, displayLegend,
    endDate, fixedStartDate, currentEndDate, timeInterval,
    includeZeros, startDate, onChange, onComplete,
    maxValue, minValue, xLabelTicks, stacked, dateVarsFormat, horizontal,
    dataLabels,
  } = props;

  useEffect(() => {
    if (startDate) {
      _onViewRange(true, true);
    }
  }, []);

  useEffect(() => {
    if (maxValue || maxValue === 0) {
      setMax(maxValue);
    }
    if (maxValue === null) {
      setMax("");
    }
    if (minValue || minValue === 0) {
      setMin(minValue);
    }
    if (minValue === null) {
      setMin("");
    }
  }, [maxValue, minValue]);

  useEffect(() => {
    setDateRange({ startDate, endDate });
    if (dateVarsFormat) {
      setDatesFormat(dateVarsFormat);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!xLabelTicks || xLabelTicks === "default") {
      setTicksSelection("default");
    } else if (xLabelTicks !== "showAll" && xLabelTicks !== "half" && xLabelTicks !== "third" && xLabelTicks !== "fourth") {
      setTicksSelection("custom");
      setTicksNumber(xLabelTicks);
    } else {
      setTicksSelection(xLabelTicks);
    }
  }, [xLabelTicks]);

  useEffect(() => {
    if (startDate && endDate) {
      let newStartDate = moment(startDate);
      let newEndDate = moment(endDate);

      if (currentEndDate) {
        const timeDiff = newEndDate.diff(newStartDate, timeInterval);
        newEndDate = moment().utcOffset(0, true).endOf(timeInterval);

        if (!fixedStartDate) {
          newStartDate = newEndDate.clone().subtract(timeDiff, timeInterval).startOf(timeInterval);
        }
      }

      setLabelStartDate(newStartDate.format("ll"));
      setLabelEndDate(newEndDate.format("ll"));
    }
  }, [currentEndDate, dateRange, fixedStartDate]);

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
    onChange({ stacked: !stacked });
  };

  const _onChangeHorizontal = () => {
    onChange({ horizontal: !horizontal });
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
    <Container
      css={{
        backgroundColor: "$backgroundContrast",
        br: "$md",
        p: 10,
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
      <Row>
        <Text b>Chart Settings</Text>
      </Row>

      <Spacer y={0.5} />
      <Divider />
      <Spacer y={0.5} />

      <Row>
        <Text>Global date settings</Text>
      </Row>
      <Spacer y={0.5} />
      <Row>
        <Grid.Container gap={1}>
          <Grid xs={12} sm={12} md={6} alignItems="center">
            <div>
              <Container css={{ ml: 0, pl: 0 }}>
                <Row css={{ ml: 0, pl: 0 }} align="center">
                  <Button
                    iconRight={<Calendar set="bold" />}
                    onClick={() => _onViewRange(true)}
                    auto
                  >
                    Date filter
                  </Button>
                  <Spacer x={0.3} />
                  {(startDate || endDate) && (
                    <Tooltip content="Remove date filtering">
                      <Button
                        light
                        icon={<CloseSquare />}
                        color="error"
                        onClick={() => _onRemoveDateFiltering()}
                        auto
                      />
                    </Tooltip>
                  )}
                  {startDate && endDate && (
                    <Tooltip content="Date formatting">
                      <Button
                        light
                        icon={<Setting />}
                        onClick={() => setDateFormattingModal(true)}
                        auto
                        size="xs"
                        css={{ minWidth: "fit-content" }}
                      />
                    </Tooltip>
                  )}
                </Row>
              </Container>
              <Row style={{ marginTop: 5 }} align="center">
                {startDate && (
                  <Badge color="secondary" size="sm">
                    <Link onClick={() => setDateRangeModal(true)} css={{ color: "$accents0" }}>
                      {labelStartDate}
                    </Link>
                  </Badge>
                )}
                <Spacer x={0.3} />
                {startDate && (<span> to </span>)}
                <Spacer x={0.3} />
                {endDate && (
                  <Badge color="secondary" size="sm">
                    <Link onClick={() => setDateRangeModal(true)} css={{ color: "$accents0" }}>
                      {labelEndDate}
                    </Link>
                  </Badge>
                )}
              </Row>
            </div>
          </Grid>
          <Grid xs={12} sm={12} md={6} direction="column">
            <Checkbox
              isSelected={currentEndDate}
              isDisabled={!dateRange.endDate}
              onChange={() => {
                onChange({ currentEndDate: !currentEndDate });
              }}
              size="sm"
            >
              Auto-update the date range
              <Spacer x={0.3} />
              <Tooltip
                content={(
                  <div style={{ padding: 5 }}>
                    <Text>
                      {"When this is enabled, the end date will be automatically updated to the current date and the date range length will be preserved."}
                    </Text>
                    <Spacer y={0.3} />
                    <Text>
                      {"This option takes into account the date interval as well."}
                    </Text>
                    <Spacer y={0.3} />
                    <ul>
                      <li>
                        <Text>
                          {"Daily interval: the end date will be the end of the present day"}
                        </Text>
                      </li>
                      <li>
                        <Text>
                          {"Weekly interval: the end date will be the end of the present week"}
                        </Text>
                      </li>
                      <li>
                        <Text>
                          {"Monthly interval: the end date will be the end of the present month"}
                        </Text>
                      </li>
                    </ul>
                  </div>
                )}
              >
                <InfoCircle set="light" size="small" />
              </Tooltip>
            </Checkbox>
            <Spacer y={0.5} />
            <Checkbox
              isSelected={fixedStartDate}
              isDisabled={!currentEndDate}
              onChange={(selected) => {
                onChange({ fixedStartDate: selected });
              }}
              size="sm"
            >
              Fix the start date
            </Checkbox>
          </Grid>
        </Grid.Container>
      </Row>
      <Spacer y={0.5} />
      <Grid.Container gap={1}>
        <Grid xs={12} sm={6} md={6}>
          <Dropdown isBordered>
            <Dropdown.Trigger>
              <Input
                placeholder="Select the frequency"
                value={
                  timeInterval
                  && timeIntervalOptions.find((option) => option.value === timeInterval).text
                }
                bordered
                contentRight={<ChevronDown />}
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => onChange({ timeInterval: key })}
              selectedKeys={[timeInterval]}
              selectionMode="single"
            >
              {timeIntervalOptions.map((option) => (
                <Dropdown.Item key={option.value}>
                  {option.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Grid>
        <Grid xs={12} sm={6} md={6} alignItems="center">
          <Checkbox
            isSelected={includeZeros}
            onChange={() => onChange({ includeZeros: !includeZeros })}
            size="sm"
          >
            Allow zero values
          </Checkbox>
        </Grid>
      </Grid.Container>

      <Spacer y={0.5} />
      <Divider />
      <Spacer y={0.5} />

      <Grid.Container gap={1}>
        {type === "line" && (
          <Grid xs={12} sm={6} md={6}>
            <Checkbox
              isSelected={pointRadius > 0}
              onChange={() => {
                if (pointRadius > 0) {
                  _onAddPoints(0);
                } else {
                  _onAddPoints(3);
                }
              }}
              size="sm"
            >
              Data points
            </Checkbox>
          </Grid>
        )}
        {type === "bar" && (
          <Grid xs={12} sm={6} md={6}>
            <Checkbox
              isSelected={stacked}
              onChange={_onChangeStacked}
              size="sm"
            >
              Stack datasets
            </Checkbox>
          </Grid>
        )}
        {type === "bar" && (
          <Grid xs={12} sm={6} md={6}>
            <Checkbox
              isSelected={horizontal}
              onChange={_onChangeHorizontal}
              size="sm"
            >
              Horizontal bars
            </Checkbox>
          </Grid>
        )}
        <Grid xs={12} sm={6} md={6}>
          <Checkbox
            isSelected={displayLegend}
            onChange={() => onChange({ displayLegend: !displayLegend })}
            size="sm"
          >
            Legend
          </Checkbox>
        </Grid>
        <Grid xs={12} sm={6} md={6}>
          <Checkbox
            isSelected={dataLabels}
            onChange={() => onChange({ dataLabels: !dataLabels })}
            size="sm"
          >
            Data labels
          </Checkbox>
        </Grid>
      </Grid.Container>

      <Spacer y={0.5} />
      <Divider />
      <Spacer y={0.5} />

      <Grid.Container gap={1}>
        <Grid xs={12} sm={6} md={6}>
          <Input
            label="Max Y Axis value"
            placeholder="Enter a number"
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
        <Grid xs={12} sm={6} md={6} justify="center" alignItems="flex-end">
          {max && (
            <>
              <Button
                disabled={!max || (max === maxValue)}
                onClick={() => onChange({ maxValue: max })}
                color="success"
                flat
                auto
              >
                Save
              </Button>
              <Spacer x={0.1} />
              <Button
                flat
                color="error"
                onClick={() => {
                  onChange({ maxValue: null });
                  setMax("");
                }}
                auto
              >
                Clear
              </Button>
            </>
          )}
        </Grid>
        <Grid xs={12} sm={6} md={6}>
          <Input
            label="Min Y Axis value"
            placeholder="Enter a number"
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            bordered
            fullWidth
          />
        </Grid>
        <Grid xs={12} sm={6} md={6} justify="center" alignItems="flex-end">
          {min && (
            <>
              <Button
                disabled={!min || (min === minValue)}
                onClick={() => onChange({ minValue: min })}
                color="success"
                auto
                flat
              >
                Save
              </Button>
              <Spacer x={0.1} />
              <Button
                flat
                color="error"
                onClick={() => {
                  onChange({ minValue: null });
                  setMin("");
                }}
                auto
              >
                Clear
              </Button>
            </>
          )}
        </Grid>
      </Grid.Container>

      <Spacer y={0.5} />
      <Divider />
      <Spacer y={0.5} />

      <Grid.Container gap={1}>
        <Grid xs={12} sm={12} md={12}>
          <Dropdown isBordered>
            <Dropdown.Trigger>
              <Input
                label="Number of labels on the X Axis"
                placeholder="Select the number of labels"
                value={
                  ticksSelection
                  && xLabelOptions.find((option) => option.value === ticksSelection).text
                }
                bordered
                fullWidth
                contentRight={<ChevronDown />}
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => _onChangeTicks(key)}
              selectedKeys={[ticksSelection]}
              selectionMode="single"
            >
              {xLabelOptions.map((option) => (
                <Dropdown.Item key={option.value}>
                  {option.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Grid>
        {ticksSelection === "custom" && (
          <Grid xs={12} sm={12} md={12}>
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
              contentRight={(
                <Button
                  flat
                  color="success"
                  onClick={() => _onConfirmTicksNumber()}
                  auto
                >
                  Save
                </Button>
              )}
            />
          </Grid>
        )}
      </Grid.Container>

      <Modal open={dateRangeModal} onClose={() => setDateRangeModal(false)} width="800px">
        <Modal.Header>
          <Text h3>Set a custom date range for your chart</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
            {currentEndDate && (
              <>
                <Row>
                  <Text>
                    {"The date range is set to auto-update to the current date. If you want to set an exact custom date range, disable the auto-update option."}
                  </Text>
                </Row>
                <Spacer y={0.5} />
              </>
            )}
            <Row justify="center">
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
            </Row>
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setDateRangeModal(false)}
            auto
          >
            Cancel
          </Button>
          <Button
            iconRight={<TickSquare />}
            onClick={_onComplete}
            auto
          >
            Apply date filter
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={dateFormattingModal} onClose={() => setDateFormattingModal(false)} width="600px">
        <Modal.Header>
          <Text h3>Set a custom format for your dates</Text>
        </Modal.Header>
        <Modal.Body>
          <Container>
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
            <Spacer y={2} />
            <Row>
              <Input
                labelPlaceholder="Enter a date format"
                initialValue={dateVarsFormat}
                value={datesFormat}
                onChange={(e) => setDatesFormat(e.target.value)}
                bordered
                fullWidth
              />
            </Row>
            <Spacer y={0.5} />
            <Row wrap="wrap">
              <Button
                color="primary"
                size="xs"
                onClick={() => setDatesFormat("YYYY-MM-DD")}
                auto
                css={{ marginBottom: 5 }}
                bordered
              >
                {"YYYY-MM-DD"}
              </Button>
              <Spacer x={0.3} />
              <Button
                color="primary"
                size="xs"
                disableOutline
                onClick={() => setDatesFormat("YYYY-MM-DD HH:mm:ss")}
                auto
                bordered
              >
                {"YYYY-MM-DD HH:mm:ss"}
              </Button>
              <Spacer x={0.3} />
              <Button
                color="primary"
                size="xs"
                disableOutline
                onClick={() => setDatesFormat("X")}
                auto
                bordered
              >
                {"Timestamp (in seconds)"}
              </Button>
              <Spacer x={0.3} />
              <Button
                color="primary"
                size="xs"
                disableOutline
                onClick={() => setDatesFormat("x")}
                auto
                bordered
              >
                {"Timestamp (in ms)"}
              </Button>
            </Row>
            <Spacer y={0.5} />
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
          </Container>
        </Modal.Body>
        <Modal.Footer>
          <Button
            flat
            color="warning"
            onClick={() => setDateFormattingModal(false)}
            auto
          >
            Cancel
          </Button>
          <Button
            iconRight={<TickSquare />}
            onClick={_onChangeDateFormat}
            auto
          >
            Apply date format
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

ChartSettings.defaultProps = {
  displayLegend: false,
  pointRadius: 0,
  startDate: null,
  endDate: null,
  includeZeros: true,
  currentEndDate: false,
  fixedStartDate: false,
  timeInterval: "day",
  onChange: () => { },
  onComplete: () => { },
  maxValue: null,
  minValue: null,
  xLabelTicks: "",
  stacked: false,
  horizontal: false,
  dateVarsFormat: "",
  dataLabels: false,
};

ChartSettings.propTypes = {
  type: PropTypes.string.isRequired,
  displayLegend: PropTypes.bool,
  pointRadius: PropTypes.number,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  includeZeros: PropTypes.bool,
  currentEndDate: PropTypes.bool,
  fixedStartDate: PropTypes.bool,
  timeInterval: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  maxValue: PropTypes.number,
  minValue: PropTypes.number,
  xLabelTicks: PropTypes.number,
  stacked: PropTypes.bool,
  horizontal: PropTypes.bool,
  dateVarsFormat: PropTypes.string,
  dataLabels: PropTypes.bool,
};

export default ChartSettings;
