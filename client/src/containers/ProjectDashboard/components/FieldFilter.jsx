import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Input, DatePicker, Chip, Link, Dropdown, DropdownTrigger,
  DropdownMenu, DropdownItem,
} from "@heroui/react";
import { parseDate, today } from "@internationalized/date";
import { LuArrowRight } from "react-icons/lu";
import moment from "moment";
import { operators } from "../../../modules/filterOperations";

function FieldFilter({
  filter,
  className = "max-w-xs",
  onApply = () => {},
}) {
  const { field, operator, value, dataType } = filter;
  const [currentOperator, setCurrentOperator] = useState(operator);
  const [currentValue, setCurrentValue] = useState(value);
  const [textValue, setTextValue] = useState(value);
  const [dateValue, setDateValue] = useState(value);

  useEffect(() => {
    setCurrentOperator(operator);
    setCurrentValue(value);
    setTextValue(value);
    setDateValue(value);
  }, [operator, value]);

  const isDateField = dataType === "date";
  const isNullOperator = currentOperator === "isNull" || currentOperator === "isNotNull";

  const _getOperatorKey = (operator) => {
    const op = operators.find(o => o.value === operator);
    return op?.key || operator;
  };

  const _handleOperatorChange = (newOperator) => {
    setCurrentOperator(newOperator);
    onApply?.({ ...filter, operator: newOperator, value: currentValue });
  };

  const renderLabel = () => {
    return (
      <Dropdown aria-label="Select an operator">
        <DropdownTrigger>
          <Chip variant="flat" radius="sm" size="sm" className="text-xs cursor-pointer">
            {field?.substring(field?.lastIndexOf(".") + 1) || "Field"} {_getOperatorKey(currentOperator)}
          </Chip>
        </DropdownTrigger>
        <DropdownMenu
          onSelectionChange={(keys) => _handleOperatorChange(keys.currentKey)}
          selectedKeys={[currentOperator]}
          selectionMode="single"
          disallowEmptySelection
        >
          {operators.map((op) => (
            <DropdownItem key={op.value} textValue={op.text}>
              {op.text}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    );
  };

  const renderInput = () => {
    if (isNullOperator) {
      return (
        <Input
          startContent={renderLabel()}
          classNames={{
            inputWrapper: "pl-1"
          }}
          value={currentOperator === "isNull" ? "Is null" : "Is not null"}
          isReadOnly
          variant="bordered"
          size="sm"
          className={className}
        />
      );
    }

    if (isDateField && field) {
      return (
        <DatePicker
          startContent={renderLabel()}
          classNames={{
            inputWrapper: "pl-1"
          }}
          value={dateValue ? parseDate(moment(dateValue).format("YYYY-MM-DD")) : today()}
          onChange={(date) => setDateValue(date.toString())}
          variant="bordered"
          size="sm"
          className={className}
          showMonthAndYearPickers
          calendarProps={{ color: "primary" }}
          endContent={dateValue !== filter?.value && (
            <Link onPress={() => onApply?.({ ...filter, operator: currentOperator, value: dateValue })} className="text-foreground hover:text-foreground-500 cursor-pointer">
              <LuArrowRight size={18} />
            </Link>
          )}
        />
      );
    }

    return (
      <Input
        startContent={renderLabel()}
        classNames={{
          inputWrapper: "pl-1"
        }}
        variant="bordered"
        value={textValue || ""}
        onChange={(e) => setTextValue(e.target.value)}
        size="sm"
        className={className}
        endContent={textValue !== filter?.value && (
          <Link onPress={() => onApply?.({ ...filter, operator: currentOperator, value: textValue })} className="text-foreground hover:text-foreground-500 cursor-pointer">
            <LuArrowRight size={18} />
          </Link>
        )}
        type={dataType === "number" ? "number" : "text"}
      />
    );
  };

  return (
    <div className="flex flex-row gap-2 items-center">
      {renderInput()}
    </div>
  );
}

FieldFilter.propTypes = {
  filter: PropTypes.object.isRequired,
  className: PropTypes.string,
  onApply: PropTypes.func,
};

export default FieldFilter;
