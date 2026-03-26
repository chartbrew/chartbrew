import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Calendar,
  DateField,
  DatePicker,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
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
    <div className="flex flex-col gap-2">
      <div className="font-bold">
        Configure the variable filter
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2 items-center">
          <div className="w-full">
            <Label htmlFor="filter-label">Filter label</Label>
            <Input
              id="filter-label"
              variant="secondary"
              placeholder="Enter a label"
              value={variableCondition.label}
              onChange={(e) => _handleVariableChange("label", e.target.value)}
              size="sm"
              className="w-full"
            />
          </div>
          <div className="w-full">
            <Label htmlFor="variable-name">Variable name</Label>
            <Input
              id="variable-name"
              variant="secondary"
              placeholder="Variable name (no brackets)"
              value={variableCondition.variable}
              onChange={(e) => _handleVariableChange("variable", e.target.value)}
              size="sm"
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-row gap-2 items-end">
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
              name="editVariableFilterDate"
              value={variableCondition.value ? parseDate(moment(variableCondition.value).format("YYYY-MM-DD")) : today()}
              onChange={(date) => {
                if (date) {
                  _handleVariableChange("value", date.toString());
                }
              }}
              className="min-w-0"
            >
              <Label>Select a date</Label>
              <DateField.Group fullWidth variant="secondary" size="sm">
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Select a date">
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
          ) : variableCondition.dataType === "number" ? (
            <Input
              placeholder="Enter a number"
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
              placeholder="Enter a value"
              variant="secondary"
              value={variableCondition.value}
              onChange={(e) => _handleVariableChange("value", e.target.value)}
              size="sm"
            />
          )}
        </div>

        <Separator className="my-2" />

        <div>
          <div className="mb-2 font-bold">Preview filter</div>
          <VariableFilter
            filter={variableCondition}
            onValueChange={(value) => _handleVariableChange("value", value)}
            onApply={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

EditVariableFilter.propTypes = {
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
};

export default EditVariableFilter;
