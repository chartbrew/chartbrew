import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import {
  Calendar,
  DateField,
  DatePicker,
  Input,
  Link,
  ListBox,
  Select,
} from "@heroui/react";
import { LuArrowRight, LuVariable } from "react-icons/lu";
import { parseDate, today } from "@internationalized/date";
import DashboardFilterLabel from "./DashboardFilterLabel";

const normalizeDateValue = (value) => {
  if (!value) return "";

  const formattedValue = moment(value);
  if (!formattedValue.isValid()) return "";

  return formattedValue.format("YYYY-MM-DD");
};

const formatVariableLabel = (value) => {
  if (!value) return "Variable";
  const normalizedValue = value.replace(/[_-]+/g, " ").trim();
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
};

function VariableFilter({
  filter,
  className = "max-w-xs",
  onApply = () => {},
}) {
  const {
    label, variable, value, dataType, allowValueChange,
  } = filter;
  const displayLabel = label?.trim() || formatVariableLabel(variable);

  const [textValue, setTextValue] = useState(value);
  const [dateValue, setDateValue] = useState(value);

  useEffect(() => {
    setTextValue(value);
    setDateValue(normalizeDateValue(value));
  }, [value]);

  const renderLabel = () => (
    <DashboardFilterLabel icon={LuVariable}>{displayLabel}</DashboardFilterLabel>
  );

  const renderInput = () => {
    switch (dataType) {
      case "text":
        return (
          <Input
            startContent={(
              renderLabel()
            )}
            className={["pl-1", className].filter(Boolean).join(" ")}
            variant="primary"
            value={textValue || ""}
            onChange={(e) => setTextValue(e.target.value)}
            size="sm"
            isReadOnly={!allowValueChange}
            endContent={allowValueChange && textValue !== filter?.value && (
              <Link onPress={() => onApply?.(textValue)} className="text-foreground hover:text-foreground-500 cursor-pointer">
                <LuArrowRight size={18} />
              </Link>
            )}
            type="text"
          />
        );
      case "number":
        return (
          <Input
            startContent={(
              renderLabel()
            )}
            className={["pl-1", className].filter(Boolean).join(" ")}
            variant="primary"
            value={textValue || ""}
            onChange={(e) => setTextValue(e.target.value)}
            type="number"
            size="sm"
            isReadOnly={!allowValueChange}
            endContent={allowValueChange && textValue !== filter?.value && (
              <Link onPress={() => onApply?.(textValue)} className="text-foreground hover:text-foreground-500 cursor-pointer">
                <LuArrowRight size={18} />
              </Link>
            )}
          />
        );
      case "date":
        {
          const appliedDateValue = normalizeDateValue(filter?.value);
          const currentDateValue = normalizeDateValue(dateValue);

        return (
          <div className={["flex flex-row items-center", className].filter(Boolean).join(" ")}>
            <DatePicker
              aria-label="Filter value"
              name="variableFilterDate"
              className="min-w-3xs flex-1 text-xs"
              value={currentDateValue ? parseDate(currentDateValue) : today()}
              onChange={(date) => {
                if (date) {
                  setDateValue(normalizeDateValue(date.toString()));
                }
              }}
              isDisabled={!allowValueChange}
            >
              <DateField.Group fullWidth variant="primary" size="sm">
                <DateField.Prefix>
                  {renderLabel()}
                </DateField.Prefix>
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  {allowValueChange && currentDateValue !== appliedDateValue && (
                    <Link
                      onPress={() => onApply?.(currentDateValue)}
                      className="flex shrink-0 cursor-pointer items-center px-1 text-foreground hover:text-foreground-500"
                    >
                      <LuArrowRight size={18} />
                    </Link>
                  )}
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Filter value">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(date) => <Calendar.Cell date={date} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </div>
        );
        }
      case "binary":
        return (
          <Select
            variant="primary"
            className={className}
            value={value || null}
            onChange={(selectedValue) => onApply?.(selectedValue)}
            selectionMode="single"
            size="sm"
            isDisabled={!allowValueChange}
            startContent={(
              renderLabel()
            )}
            aria-label="Filter value"
          >
            <Select.Trigger className="min-w-16 text-xs">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="true" textValue="True">
                  True
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="false" textValue="False">
                  False
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        );
      default:
        return null;
    }
  };

  return renderInput();
}

VariableFilter.propTypes = {
  filter: PropTypes.shape({
    label: PropTypes.string,
    variable: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
    dataType: PropTypes.oneOf(["text", "number", "date", "binary"]).isRequired,
    allowValueChange: PropTypes.bool,
  }).isRequired,
  onApply: PropTypes.func,
  className: PropTypes.string,
};

export default VariableFilter;
