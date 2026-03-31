import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Dropdown,
  Input,
  Link,
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
        <Dropdown.Trigger>
          <Chip variant="soft" size="sm" className="rounded-sm text-xs cursor-pointer">
            {field?.substring(field?.lastIndexOf(".") + 1) || "Field"} {_getOperatorKey(currentOperator)}
          </Chip>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu
            onSelectionChange={(keys) => _handleOperatorChange(keys.currentKey)}
            selectedKeys={[currentOperator]}
            selectionMode="single"
            disallowEmptySelection
          >
            {operators.map((op) => (
              <Dropdown.Item id={op.value} key={op.value} textValue={op.text}>
                {op.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    );
  };

  const renderInput = () => {
    if (isNullOperator) {
      return (
        <Input
          startContent={renderLabel()}
          className={["pl-1", className].filter(Boolean).join(" ")}
          value={currentOperator === "isNull" ? "Is null" : "Is not null"}
          isReadOnly
          variant="secondary"
          size="sm"
        />
      );
    }

    if (isDateField && field) {
      return (
        <div className={["flex flex-row items-center gap-1", className].filter(Boolean).join(" ")}>
          <DatePicker
            className="min-w-0 flex-1 pl-1 text-xs"
            name="fieldFilterDate"
            value={dateValue ? parseDate(moment(dateValue).format("YYYY-MM-DD")) : today()}
            onChange={(date) => {
              if (date) {
                setDateValue(date.toString());
              }
            }}
          >
            <DateField.Group fullWidth variant="primary" size="sm">
              <DateField.Prefix>
                {renderLabel()}
              </DateField.Prefix>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateField.Suffix>
                {dateValue !== filter?.value && (
                  <Link
                    onPress={() => onApply?.({ ...filter, operator: currentOperator, value: dateValue })}
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
              <Calendar aria-label="Filter date value">
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
                    {({year}) => <Calendar.YearPickerCell year={year} />}
                  </Calendar.YearPickerGridBody>
                </Calendar.YearPickerGrid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>
        </div>
      );
    }

    return (
      <Input
        startContent={renderLabel()}
        className={["pl-1", className].filter(Boolean).join(" ")}
        variant="secondary"
        value={textValue || ""}
        onChange={(e) => setTextValue(e.target.value)}
        size="sm"
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
