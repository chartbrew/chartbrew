import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import moment from "moment";
import {
  Input,
  Select,
  SelectItem,
  DatePicker,
  Chip,
  Link,
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
              <Chip variant="flat" radius="sm" size="sm" className="text-xs" startContent={<LuVariable size={16} />}>
                {label}
              </Chip>
            )}
            classNames={{
              inputWrapper: "pl-1"
            }}
            variant={allowValueChange ? "bordered" : "flat"}
            value={textValue || ""}
            onChange={(e) => setTextValue(e.target.value)}
            size="sm"
            className={className}
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
              <Chip variant="flat" radius="sm" size="sm" className="text-xs" startContent={<LuVariable size={16} />}>
                {label}
              </Chip>
            )}
            classNames={{
              inputWrapper: "pl-1"
            }}
            variant={allowValueChange ? "bordered" : "flat"}
            value={textValue || ""}
            onChange={(e) => setTextValue(e.target.value)}
            type="number"
            size="sm"
            className={className}
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
              <Chip variant="flat" radius="sm" size="sm" className="text-xs" startContent={<LuVariable size={16} />}>
                {label}
              </Chip>
            )}
            classNames={{
              inputWrapper: "pl-1"
            }}
            value={dateValue ? parseDate(moment(dateValue).format("YYYY-MM-DD")) : today()}
            onChange={(date) => setDateValue(date.toString())}
            variant={allowValueChange ? "bordered" : "flat"}
            size="sm"
            className={className}
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
            variant={allowValueChange ? "bordered" : "flat"}
            selectedKeys={[value || ""]}
            onSelectionChange={(keys) => onApply?.(keys.currentKey)}
            size="sm"
            isDisabled={!allowValueChange}
            startContent={(
              <Chip variant="flat" radius="sm" size="sm" className="text-xs" startContent={<LuVariable size={16} />}>
                {label}
              </Chip>
            )}
            classNames={{
              value: "min-w-16 text-xs",
            }}
            aria-label="Filter value"
          >
            <SelectItem key="true" textValue="True">
              True
            </SelectItem>
            <SelectItem key="false" textValue="False">
              False
            </SelectItem>
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
