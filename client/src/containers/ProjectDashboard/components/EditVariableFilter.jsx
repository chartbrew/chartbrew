import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Select, Input, DatePicker, Separator, Label, ListBox,
} from "@heroui/react";
import { parseDate, today } from "@internationalized/date";
import moment from "moment";
import VariableFilter from "./VariableFilter";

function EditVariableFilter({
  filter,
  onChange,
}) {
  const [variableCondition, setVariableCondition] = useState({
    variable: filter?.variable || "",
    value: filter?.value || "",
    dataType: filter?.dataType || "text",
    label: filter?.label || "",
    allowValueChange: filter?.allowValueChange || true,
  });

  useEffect(() => {
    setVariableCondition({
      variable: filter?.variable || "",
      value: filter?.value || "",
      dataType: filter?.dataType || "text",
      label: filter?.label || "",
      allowValueChange: filter?.allowValueChange || true,
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
            variant="secondary"
            value={variableCondition.label}
            onChange={(e) => _handleVariableChange("label", e.target.value)}
            size="sm"
          />

          <Input
            label="Variable name (no brackets)"
            variant="secondary"
            value={variableCondition.variable}
            onChange={(e) => _handleVariableChange("variable", e.target.value)}
            size="sm"
          />
        </div>

        <div className="flex flex-row gap-2 items-center">
          <Select
            variant="secondary"
            value={variableCondition.dataType || null}
            onChange={(value) => {
              if (value === "date") {
                _handleVariableChange("value", today().toString());
                _handleVariableChange("dataType", value);
              } else {
                _handleVariableChange("dataType", value);
              }
            }}
            selectionMode="single"
            size="sm"
          >
            <Label>Data type</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="text" textValue="Text">
                  Text
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="number" textValue="Number">
                  Number
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="date" textValue="Date">
                  Date
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="binary" textValue="Binary">
                  Binary
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          {variableCondition.dataType === "date" ? (
            <DatePicker
              label="Select a date"
              value={variableCondition.value ? parseDate(moment(variableCondition.value).format("YYYY-MM-DD")) : today()}
              onChange={(date) => _handleVariableChange("value", date.toString())}
              variant="secondary"
              showMonthAndYearPickers
              calendarProps={{ color: "primary" }}
              size="sm"
            />
          ) : variableCondition.dataType === "number" ? (
            <Input
              label="Enter a number"
              variant="secondary"
              type="number"
              value={variableCondition.value}
              onChange={(e) => _handleVariableChange("value", e.target.value)}
              size="sm"
            />
          ) : variableCondition.dataType === "binary" ? (
            <Select
              variant="secondary"
              value={variableCondition.value || null}
              onChange={(value) => _handleVariableChange("value", value)}
              selectionMode="single"
              size="sm"
            >
              <Label>Select value</Label>
              <Select.Trigger>
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
          ) : (
            <Input
              label="Enter a value"
              variant="secondary"
              value={variableCondition.value}
              onChange={(e) => _handleVariableChange("value", e.target.value)}
              size="sm"
            />
          )}
        </div>

        <Separator />

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
