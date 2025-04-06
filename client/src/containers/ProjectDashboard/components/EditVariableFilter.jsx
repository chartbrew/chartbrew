import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Select, SelectItem, Input, DatePicker, Checkbox, Divider,
} from "@heroui/react";
import { Link } from "react-router-dom";
import { parseDate, today } from "@internationalized/date";
import moment from "moment";
import VariableFilter from "./VariableFilter";

function EditVariableFilter({
  filter,
  onChange,
  project,
}) {
  const [variableCondition, setVariableCondition] = useState({
    variable: filter?.variable || "",
    value: filter?.value || "",
    dataType: filter?.dataType || "text",
    label: filter?.label || "",
    allowValueChange: filter?.allowValueChange || false,
  });

  useEffect(() => {
    setVariableCondition({
      variable: filter?.variable || "",
      value: filter?.value || "",
      dataType: filter?.dataType || "text",
      label: filter?.label || "",
      allowValueChange: filter?.allowValueChange || false,
    });
  }, [filter]);

  const _handleVariableChange = (key, value) => {
    const newCondition = { ...variableCondition, [key]: value };
    setVariableCondition(newCondition);
    onChange({ ...filter, ...newCondition });
  };

  return (
    <>
      <div className="font-bold">
        Configure the variable filter
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2 items-center">
          <Input
            label="Filter label"
            variant="bordered"
            value={variableCondition.label}
            onChange={(e) => _handleVariableChange("label", e.target.value)}
            size="sm"
          />

          <Select
            label="Select a variable"
            variant="bordered"
            selectedKeys={[variableCondition.variable]}
            onSelectionChange={(keys) => _handleVariableChange("variable", keys.currentKey)}
            aria-label="Select a variable"
            size="sm"
            selectionMode="single"
          >
            {project?.Variables?.map((variable) => (
              <SelectItem key={variable.name} textValue={variable.name}>
                {variable.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="flex flex-row gap-2 items-center">
          <Select
            label="Data type"
            variant="bordered"
            selectedKeys={[variableCondition.dataType]}
            onSelectionChange={(keys) => {
              if (keys.currentKey === "date") {
                _handleVariableChange("value", today().toString());
                _handleVariableChange("dataType", keys.currentKey);
              } else {
                _handleVariableChange("dataType", keys.currentKey);
              }
            }}
            size="sm"
          >
            <SelectItem key="text" textValue="Text">
              Text
            </SelectItem>
            <SelectItem key="number" textValue="Number">
              Number
            </SelectItem>
            <SelectItem key="date" textValue="Date">
              Date
            </SelectItem>
            <SelectItem key="binary" textValue="Binary">
              Binary
            </SelectItem>
          </Select>

          {variableCondition.dataType === "date" ? (
            <DatePicker
              label="Select a date"
              value={variableCondition.value ? parseDate(moment(variableCondition.value).format("YYYY-MM-DD")) : today()}
              onChange={(date) => _handleVariableChange("value", date.toString())}
              variant="bordered"
              showMonthAndYearPickers
              calendarProps={{ color: "primary" }}
              size="sm"
            />
          ) : variableCondition.dataType === "number" ? (
            <Input
              label="Enter a number"
              variant="bordered"
              type="number"
              value={variableCondition.value}
              onChange={(e) => _handleVariableChange("value", e.target.value)}
              size="sm"
            />
          ) : variableCondition.dataType === "binary" ? (
            <Select
              label="Select value"
              variant="bordered"
              selectedKeys={[variableCondition.value]}
              onSelectionChange={(keys) => _handleVariableChange("value", keys.currentKey)}
              size="sm"
            >
              <SelectItem key="true" textValue="True">
                True
              </SelectItem>
              <SelectItem key="false" textValue="False">
                False
              </SelectItem>
            </Select>
          ) : (
            <Input
              label="Enter a value"
              variant="bordered"
              value={variableCondition.value}
              onChange={(e) => _handleVariableChange("value", e.target.value)}
              size="sm"
            />
          )}
        </div>

        <div className="flex flex-row gap-2 items-center">
          <Checkbox
            isSelected={variableCondition.allowValueChange}
            onValueChange={(isSelected) => _handleVariableChange("allowValueChange", isSelected)}
            size="sm"
          >
            Allow value change
          </Checkbox>
        </div>

        <div>
          <Link to="../variables" className="text-primary-400 text-sm">
            Missing a variable? Click here to create new variables for this project.
          </Link>
        </div>

        <Divider />

        <div>
          <div className="mb-2 font-bold">Preview filter</div>
          <VariableFilter
            filter={variableCondition}
            onValueChange={(value) => _handleVariableChange("value", value)}
            onApply={() => {}}
          />
        </div>
      </div>
    </>
  );
}

EditVariableFilter.propTypes = {
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
};

export default EditVariableFilter;
