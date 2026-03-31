import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import {
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Input,
  Link,
  ListBox,
  Select,
} from "@heroui/react";
import { LuArrowRight, LuVariable } from "react-icons/lu";
import { parseDate, today } from "@internationalized/date";

function VariableFilter({
  filter,
  className = "max-w-xs",
  onApply = () => {},
}) {
  const { label, value, dataType, allowValueChange } = filter;

  const [textValue, setTextValue] = useState(value);
  const [dateValue, setDateValue] = useState(value);

  useEffect(() => {
    setTextValue(value);
    setDateValue(value);
  }, [value]);

  const renderInput = () => {
    switch (dataType) {
      case "text":
        return (
          <Input
            startContent={(
              <Chip variant="soft" size="sm" className="rounded-sm text-xs">
                <LuVariable size={16} />
                {label}
              </Chip>
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
              <Chip variant="soft" size="sm" className="rounded-sm text-xs">
                <LuVariable size={16} />
                {label}
              </Chip>
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
        return (
          <div className={["flex flex-row items-center gap-1", className].filter(Boolean).join(" ")}>
            <Chip variant="soft" size="sm" className="shrink-0 rounded-sm text-xs">
              <LuVariable size={16} />
              {label}
            </Chip>
            <DatePicker
              aria-label="Filter value"
              name="variableFilterDate"
              className="min-w-0 flex-1 pl-1 text-xs"
              value={dateValue ? parseDate(moment(dateValue).format("YYYY-MM-DD")) : today()}
              onChange={(date) => {
                if (date) {
                  setDateValue(date.toString());
                }
              }}
              isDisabled={!allowValueChange}
            >
              <DateField.Group fullWidth variant="primary" size="sm">
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  {allowValueChange && dateValue !== filter?.value && (
                    <Link
                      onPress={() => onApply?.(dateValue)}
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
              <Chip variant="soft" size="sm" className="rounded-sm text-xs">
                <LuVariable size={16} />
                {label}
              </Chip>
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
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  dataType: PropTypes.oneOf(["text", "number", "date", "binary"]).isRequired,
  allowValueChange: PropTypes.bool,
  onApply: PropTypes.func,
  className: PropTypes.string,
};

export default VariableFilter;
