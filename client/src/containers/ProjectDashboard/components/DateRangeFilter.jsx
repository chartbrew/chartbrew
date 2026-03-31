import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Chip,
  DateField,
  DateRangePicker,
  Link,
  RangeCalendar,
} from "@heroui/react";
import moment from "moment";
import { getLocalTimeZone, parseDateTime } from "@internationalized/date";
import { LuArrowRight } from "react-icons/lu";
import { RangeCalendarStateContext, useLocale } from "react-aria-components";

function RangeCalendarMonthHeading({ offset = 0 }) {
  const state = React.useContext(RangeCalendarStateContext);
  const { locale } = useLocale();
  if (!state) {
    return null;
  }
  const startDate = state.visibleRange.start;
  const monthDate = startDate.add({ months: offset });
  const dateObj = monthDate.toDate(getLocalTimeZone());
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    dateObj,
  );
  return <span className="text-sm font-medium">{monthYear}</span>;
}

RangeCalendarMonthHeading.propTypes = {
  offset: PropTypes.number,
};

function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  className = "",
  size = "sm",
  variant = "primary",
  isEdit = false,
}) {
  // This is the actual value that is displayed to the user
  const [currentValue, setCurrentValue] = useState({
    start: startDate ? parseDateTime(moment.utc(startDate).format("YYYY-MM-DDTHH:mm:ss")) : null,
    end: endDate ? parseDateTime(moment.utc(endDate).format("YYYY-MM-DDTHH:mm:ss")) : null,
  });

  // This is the committed value that we compare against to show the save button
  const [committedValue, setCommittedValue] = useState({
    start: startDate ? parseDateTime(moment.utc(startDate).format("YYYY-MM-DDTHH:mm:ss")) : null,
    end: endDate ? parseDateTime(moment.utc(endDate).format("YYYY-MM-DDTHH:mm:ss")) : null,
  });

  // Update the values when props change
  useEffect(() => {
    const newValue = {
      start: startDate ? parseDateTime(moment.utc(startDate).format("YYYY-MM-DDTHH:mm:ss")) : null,
      end: endDate ? parseDateTime(moment.utc(endDate).format("YYYY-MM-DDTHH:mm:ss")) : null,
    };
    setCurrentValue(newValue);
    setCommittedValue(newValue);
  }, [startDate, endDate]);

  const _onSelectRange = (type) => {
    let newStartDate;
    let newEndDate;

    switch (type) {
      case "this_month":
        newStartDate = moment().startOf("month").startOf("day");
        newEndDate = moment().endOf("month").endOf("day");
        break;
      case "last_month":
        newStartDate = moment().subtract(1, "month").startOf("month").startOf("day");
        newEndDate = moment().subtract(1, "month").endOf("month").endOf("day");
        break;
      case "last_7_days":
        newStartDate = moment().subtract(7, "days").startOf("day");
        newEndDate = moment().endOf("day");
        break;
      case "last_30_days":
        newStartDate = moment().subtract(30, "days").startOf("day");
        newEndDate = moment().endOf("day");
        break;
      case "last_90_days":
        newStartDate = moment().subtract(90, "days").startOf("day");
        newEndDate = moment().endOf("day");
        break;
      case "last_year":
        newStartDate = moment().subtract(1, "year").startOf("year").startOf("day");
        newEndDate = moment().subtract(1, "year").endOf("year").endOf("day");
        break;
      case "quarter_to_date":
        newStartDate = moment().startOf("quarter").startOf("day");
        newEndDate = moment().endOf("day");
        break;
      case "last_quarter":
        newStartDate = moment().subtract(1, "quarter").startOf("quarter").startOf("day");
        newEndDate = moment().subtract(1, "quarter").endOf("quarter").endOf("day");
        break;
      case "year_to_date":
        newStartDate = moment().startOf("year").startOf("day");
        newEndDate = moment().endOf("day");
        break;
      default:
        return;
    }

    const newValue = {
      start: parseDateTime(newStartDate.format("YYYY-MM-DDTHH:mm:ss")),
      end: parseDateTime(newEndDate.format("YYYY-MM-DDTHH:mm:ss")),
    };

    setCurrentValue(newValue);
    if (isEdit) {
      _applyDateRange(newValue);
    }
  };

  const _handleDateRangeChange = (value) => {
    if (!value?.start || !value?.end) {
      return;
    }
    setCurrentValue(value);
    if (isEdit) {
      _applyDateRange(value);
    }
  };

  const _applyDateRange = (appliedValue = currentValue) => {
    if (!appliedValue?.start?.day || !appliedValue?.end?.day) {
      return;
    }

    const startDateOut = moment([appliedValue.start.year, appliedValue.start.month - 1, appliedValue.start.day])
      .utcOffset(0, true).format();
    const endDateOut = moment([appliedValue.end.year, appliedValue.end.month - 1, appliedValue.end.day, 23, 59, 59])
      .utcOffset(0, true).format();

    onChange({ startDate: startDateOut, endDate: endDateOut });
    setCommittedValue(appliedValue);
  };

  const _hasChanges = () => {
    return (
      currentValue.start?.toString() !== committedValue.start?.toString() ||
      currentValue.end?.toString() !== committedValue.end?.toString()
    );
  };

  return (
    <DateRangePicker
      aria-label="Select a date range"
      className={["text-xs", className].filter(Boolean).join(" ")}
      endName="dashboardFilterEnd"
      startName="dashboardFilterStart"
      value={currentValue}
      onChange={_handleDateRangeChange}
    >
      <DateField.Group fullWidth variant={variant} size={size}>
        <DateField.Input slot="start">
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end">
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          {_hasChanges() && (
            <Link
              onPress={() => _applyDateRange()}
              isDisabled={!_hasChanges()}
              className="flex shrink-0 cursor-pointer items-center px-1 text-foreground hover:text-foreground-500"
            >
              <LuArrowRight size={18} />
            </Link>
          )}
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover className="flex max-w-[100vw] flex-col">
        <RangeCalendar
          aria-label="Select a date range"
          className="@container-normal w-auto overflow-x-auto"
          visibleDuration={{ months: 2 }}
        >
          <RangeCalendar.Heading className="sr-only" />
          <div className="flex w-max gap-8">
            <div className="w-64">
              <RangeCalendar.Header>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendarMonthHeading offset={0} />
                <div className="size-6" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </div>
            <div className="w-64">
              <RangeCalendar.Header>
                <div className="size-6" />
                <RangeCalendarMonthHeading offset={1} />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid offset={{ months: 1 }}>
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </div>
          </div>
        </RangeCalendar>
        <div className="flex flex-col gap-1 border-t border-divider pb-4 pt-2">
          <div className="flex flex-row flex-wrap gap-1 px-2 py-1 max-w-lg">
            <Link onPress={() => _onSelectRange("this_month")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                This month
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_month")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Last month
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_7_days")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Last 7 days
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_30_days")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Last 30 days
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_90_days")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Last 90 days
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_year")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Last year
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("quarter_to_date")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Quarter to date
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_quarter")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Last quarter
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("year_to_date")} className="whitespace-nowrap">
              <Chip size="sm" variant="soft" className="cursor-pointer">
                Year to date
              </Chip>
            </Link>
          </div>
          {_hasChanges() && (
            <div className="px-2">
              <Button
                variant="secondary"
                onPress={() => _applyDateRange()}
                size="sm"
                fullWidth
              >
                Apply
                <LuArrowRight size={18} />
              </Button>
            </div>
          )}
        </div>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

DateRangeFilter.propTypes = {
  startDate: PropTypes.string.isRequired,
  endDate: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  variant: PropTypes.string,
  size: PropTypes.string,
  isEdit: PropTypes.bool,
};

export default DateRangeFilter;
