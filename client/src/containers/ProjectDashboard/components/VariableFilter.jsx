import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import {
  Input,
  Select,
  DatePicker,
  Chip,
  Link,
  ListBox,
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
            variant="secondary"
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
            variant="secondary"
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
          <DatePicker
            startContent={(
              <Chip variant="soft" size="sm" className="rounded-sm text-xs">
                <LuVariable size={16} />
                {label}
              </Chip>
            )}
            className={["pl-1", className].filter(Boolean).join(" ")}
            value={dateValue ? parseDate(moment(dateValue).format("YYYY-MM-DD")) : today()}
            onChange={(date) => setDateValue(date.toString())}
            variant="secondary"
            size="sm"
            isDisabled={!allowValueChange}
            showMonthAndYearPickers
            calendarProps={{ color: "primary" }}
            endContent={allowValueChange && dateValue !== filter?.value && (
              <Link onPress={() => onApply?.(dateValue)} className="text-foreground hover:text-foreground-500 cursor-pointer">
                <LuArrowRight size={18} />
              </Link>
            )}
            aria-label="Filter value"
          />
        );
      case "binary":
        return (
          <Select
            variant="secondary"
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
