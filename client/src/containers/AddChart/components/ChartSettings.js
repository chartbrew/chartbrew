import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button, Link, Checkbox, Container, Divider, Grid, Row, Spacer,
  Text, Input, Dropdown, Tooltip, Modal, Badge,
} from "@nextui-org/react";
import {
  Calendar, ChevronDown, TickSquare
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

  const {
    type, pointRadius, displayLegend,
    endDate, currentEndDate, timeInterval,
    includeZeros, startDate, onChange, onComplete,
    maxValue, minValue, xLabelTicks, stacked,
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
        const timeDiff = newEndDate.diff(newStartDate, "days");
        newEndDate = moment().endOf("day");
        newStartDate = newEndDate.clone().subtract(timeDiff, "days").startOf("day");
      }

      setLabelStartDate(newStartDate.format("ll"));
      setLabelEndDate(newEndDate.format("ll"));
    }
  }, [currentEndDate, dateRange]);

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

  const _onActivateRange = (checked) => {
    if (!checked) {
      _onViewRange(false);
      return;
    }

    if (startDate == null || endDate == null) {
      _onViewRange(true);
    }
  };

  const _onAddPoints = (value) => {
    onChange({ pointRadius: value });
  };

  const _onChangeStacked = () => {
    onChange({ stacked: !stacked });
  };

  const _onChangeDateRange = (range) => {
    const startDate = moment(range.selection.startDate).toDate();
    const endDate = moment(range.selection.endDate).toDate();
    setDateRange({ startDate, endDate });
  };

  const _onComplete = () => {
    const { startDate, endDate } = dateRange;
    onChange({ dateRange: { startDate, endDate } });

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
          <Grid xs={12} sm={6} md={6} alignItems="center">
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
                  <Spacer x={0.5} />
                  <Tooltip content="Toggle date filtering">
                    <Checkbox
                      isSelected={startDate != null || endDate != null}
                      onChange={(checked) => _onActivateRange(checked)}
                    />
                  </Tooltip>
                </Row>
              </Container>
              <div style={{ marginTop: 5 }}>
                {startDate && (
                  <Badge color="secondary" size="sm">
                    <Link onClick={() => setDateRangeModal(true)} css={{ color: "$accents0" }}>
                      {labelStartDate}
                    </Link>
                  </Badge>
                )}
                {startDate && (<span> to </span>)}
                {endDate && (
                  <Badge color="secondary" size="sm">
                    <Link onClick={() => setDateRangeModal(true)} css={{ color: "$accents0" }}>
                      {labelEndDate}
                    </Link>
                  </Badge>
                )}
              </div>
            </div>
          </Grid>
          <Grid xs={12} sm={6} md={6} alignItems="flex-start">
            <Checkbox
              isSelected={currentEndDate}
              isDisabled={!dateRange.endDate}
              onChange={() => {
                onChange({ currentEndDate: !currentEndDate });
              }}
              size="sm"
            >
              Make the date range relative to present
            </Checkbox>
          </Grid>
        </Grid.Container>
      </Row>
      <Spacer y={0.5} />
      <Grid.Container gap={1}>
        <Grid xs={12} sm={6} md={6}>
          <Dropdown>
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
        <Grid xs={12} sm={6} md={6}>
          {type === "line"
            && (
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
            )}
          {type === "bar" && (
            <Checkbox
              isSelected={stacked}
              onChange={_onChangeStacked}
              size="sm"
            >
              Stack datasets
            </Checkbox>
          )}
        </Grid>
        <Grid xs={12} sm={6} md={6}>
          <Checkbox
            isSelected={displayLegend}
            onChange={() => onChange({ displayLegend: !displayLegend })}
            size="sm"
          >
            Legend
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
          <Dropdown>
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
            <Row justify="center">
              <DateRangePicker
                locale={enGB}
                direction="horizontal"
                rangeColors={[secondary, primary]}
                ranges={[
                  dateRange.startDate && dateRange.endDate ? {
                    startDate: moment(dateRange.startDate).toDate(),
                    endDate: moment(dateRange.endDate).toDate(),
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
  timeInterval: "day",
  onChange: () => { },
  onComplete: () => { },
  maxValue: null,
  minValue: null,
  xLabelTicks: "",
  stacked: false,
};

ChartSettings.propTypes = {
  type: PropTypes.string.isRequired,
  displayLegend: PropTypes.bool,
  pointRadius: PropTypes.number,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  includeZeros: PropTypes.bool,
  currentEndDate: PropTypes.bool,
  timeInterval: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  maxValue: PropTypes.number,
  minValue: PropTypes.number,
  xLabelTicks: PropTypes.number,
  stacked: PropTypes.bool,
};

export default ChartSettings;
