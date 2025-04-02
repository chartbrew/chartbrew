import React, { useState, useEffect } from "react"
import PropTypes from "prop-types"
import { DateRangePicker, Link, Chip, Button } from "@heroui/react"
import moment from "moment"
import { parseDateTime } from "@internationalized/date"
import { LuArrowRight } from "react-icons/lu"

function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  className = "",
  variant = "bordered",
  size = "sm",
}) {
  // This is the actual value that is displayed to the user
  const [currentValue, setCurrentValue] = useState({
    start: parseDateTime(moment.utc(startDate).format("YYYY-MM-DDTHH:mm:ss")),
    end: parseDateTime(moment.utc(endDate).format("YYYY-MM-DDTHH:mm:ss")),
  })

  // This is the committed value that we compare against to show the save button
  const [committedValue, setCommittedValue] = useState({
    start: parseDateTime(moment.utc(startDate).format("YYYY-MM-DDTHH:mm:ss")),
    end: parseDateTime(moment.utc(endDate).format("YYYY-MM-DDTHH:mm:ss")),
  })

  // Update the values when props change
  useEffect(() => {
    const newValue = {
      start: parseDateTime(moment.utc(startDate).format("YYYY-MM-DDTHH:mm:ss")),
      end: parseDateTime(moment.utc(endDate).format("YYYY-MM-DDTHH:mm:ss")),
    };
    setCurrentValue(newValue);
    setCommittedValue(newValue);
  }, [startDate, endDate])

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
  }

  const _handleDateRangeChange = (value) => {
    setCurrentValue(value);
  }

  const _applyDateRange = () => {
    const startDate = moment([currentValue.start.year, currentValue.start.month - 1, currentValue.start.day])
      .utcOffset(0, true).format();
    const endDate = moment([currentValue.end.year, currentValue.end.month - 1, currentValue.end.day, 23, 59, 59])
      .utcOffset(0, true).format();

    onChange({ startDate, endDate });
    setCommittedValue(currentValue);
  }

  const _hasChanges = () => {
    return (
      currentValue.start.toString() !== committedValue.start.toString() ||
      currentValue.end.toString() !== committedValue.end.toString()
    );
  }

  return (
    <DateRangePicker
      variant={variant}
      visibleMonths={2}
      value={currentValue}
      calendarProps={{
        focusedValue: currentValue?.start,
      }}
      onChange={_handleDateRangeChange}
      color="primary"
      aria-label="Select a date range"
      size={size}
      className={className}
      classNames={{
        input: "text-xs",
      }}
      endContent={_hasChanges() && (
        <Link onPress={_applyDateRange} className="text-foreground hover:text-foreground-500 cursor-pointer">
          <LuArrowRight size={18} />
        </Link>
      )}
      CalendarBottomContent={
        <div className="flex flex-col gap-1 pb-4">
          <div className="flex flex-row flex-wrap gap-1 px-2 py-1">
            <Link onPress={() => _onSelectRange("this_month")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                This month
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_month")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Last month
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_7_days")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Last 7 days
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_30_days")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Last 30 days
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_90_days")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Last 90 days
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_year")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Last year
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("quarter_to_date")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Quarter to date
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("last_quarter")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Last quarter
              </Chip>
            </Link>
            <Link onPress={() => _onSelectRange("year_to_date")} className="whitespace-nowrap">
              <Chip size="sm" variant="flat" className="cursor-pointer">
                Year to date
              </Chip>
            </Link>
          </div>
          {_hasChanges() && (
            <div className="px-2">
              <Button
                variant="bordered"
                onPress={_applyDateRange}
                endContent={<LuArrowRight size={18} />}
                size="sm"
                fullWidth
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      }
    />
  )
}

DateRangeFilter.propTypes = {
  startDate: PropTypes.string.isRequired,
  endDate: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  variant: PropTypes.string,
  size: PropTypes.string,
}

export default DateRangeFilter
