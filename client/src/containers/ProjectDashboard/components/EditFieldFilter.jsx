import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Autocomplete,
  AutocompleteItem,
  Chip,
  DatePicker,
  Divider,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { parseDate, today } from "@internationalized/date";
import moment from "moment";

import { operators } from "../../../modules/filterOperations";
import {
  applyDashboardFieldOption,
  findDashboardFieldOption,
  getDashboardFieldOptions,
} from "../../../modules/dashboardFilterBindings";
import FieldFilter from "./FieldFilter";

function EditFieldFilter({
  charts,
  filter,
  onChange,
}) {
  const fieldOptions = useMemo(() => getDashboardFieldOptions(charts), [charts]);
  const [fieldCondition, setFieldCondition] = useState({
    selectedFieldKey: filter?.selectedFieldKey || "",
    fieldId: filter?.fieldId || "",
    field: filter?.field || "",
    fieldLabel: filter?.fieldLabel || "",
    operator: filter?.operator || "is",
    value: filter?.value || "",
    dataType: filter?.dataType || "",
    bindings: Array.isArray(filter?.bindings) ? filter.bindings : [],
    charts: Array.isArray(filter?.charts) ? filter.charts : [],
  });

  useEffect(() => {
    const selectedOption = findDashboardFieldOption(fieldOptions, filter);
    setFieldCondition({
      selectedFieldKey: selectedOption?.key || filter?.selectedFieldKey || "",
      fieldId: selectedOption?.fieldId || filter?.fieldId || "",
      field: selectedOption?.field || filter?.field || "",
      fieldLabel: selectedOption?.text || filter?.fieldLabel || "",
      operator: filter?.operator || "is",
      value: filter?.value || "",
      dataType: selectedOption?.type || filter?.dataType || "",
      bindings: selectedOption?.bindings || (Array.isArray(filter?.bindings) ? filter.bindings : []),
      charts: selectedOption?.chartIds || (Array.isArray(filter?.charts) ? filter.charts : []),
    });
  }, [fieldOptions, filter]);

  const selectedField = findDashboardFieldOption(fieldOptions, fieldCondition);
  const isDateField = selectedField?.type === "date";

  const _handleFieldChange = (key, value) => {
    if (key === "selectedFieldKey") {
      const selectedOption = fieldOptions.find((option) => option.key === value);
      const nextCondition = applyDashboardFieldOption({
        ...fieldCondition,
        selectedFieldKey: value,
      }, selectedOption);
      setFieldCondition(nextCondition);
      onChange({ ...filter, ...nextCondition });
      return;
    }

    const nextCondition = {
      ...fieldCondition,
      [key]: value,
    };

    setFieldCondition(nextCondition);
    onChange({ ...filter, ...nextCondition });
  };

  return (
    <>
      <div className="font-bold">
        Configure the field filter
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-2 items-center">
          <Autocomplete
            label="Select a field"
            selectedKey={fieldCondition.selectedFieldKey || null}
            onSelectionChange={(key) => _handleFieldChange("selectedFieldKey", key)}
            size="sm"
            variant="bordered"
            aria-label="Select a field"
            isClearable={false}
          >
            {fieldOptions.map((fieldOption) => (
              <AutocompleteItem
                key={fieldOption.key}
                startContent={(
                  <Chip variant="flat" size="sm" color={fieldOption.label.color} className="min-w-[70px] text-center">
                    {fieldOption.type}
                  </Chip>
                )}
                textValue={fieldOption.text}
                description={`${fieldOption.chartIds.length} chart${fieldOption.chartIds.length === 1 ? "" : "s"}`}
              >
                {fieldOption.text}
              </AutocompleteItem>
            ))}
          </Autocomplete>

          <Select
            label="Select an operator"
            variant="bordered"
            selectedKeys={[fieldCondition.operator]}
            onSelectionChange={(keys) => _handleFieldChange("operator", keys.currentKey)}
            size="sm"
            aria-label="Select an operator"
          >
            {operators.map((op) => (
              <SelectItem key={op.value} textValue={op.text}>
                {op.text}
              </SelectItem>
            ))}
          </Select>

          {selectedField && (
            isDateField ? (
              <DatePicker
                label="Select a date"
                value={fieldCondition.value ? parseDate(moment(fieldCondition.value).format("YYYY-MM-DD")) : today()}
                onChange={(date) => _handleFieldChange("value", date.toString())}
                variant="bordered"
                showMonthAndYearPickers
                calendarProps={{ color: "primary" }}
                size="sm"
                aria-label="Select a date"
              />
            ) : (
              <Input
                label="Enter a value"
                variant="bordered"
                value={fieldCondition.value}
                onChange={(e) => _handleFieldChange("value", e.target.value)}
                size="sm"
                aria-label="Enter a value"
              />
            )
          )}
        </div>

        {selectedField && (
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">Affected charts:</div>
            <div className="flex flex-row flex-wrap gap-1">
              {selectedField.chartNames.map((chartName) => (
                <Chip key={chartName} color="primary" radius="sm" variant="flat">
                  {chartName}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <Divider />

        <div>
          <div className="mb-2 font-bold">Preview filter</div>
          <FieldFilter filter={fieldCondition} />
        </div>
      </div>
    </>
  );
}

EditFieldFilter.propTypes = {
  charts: PropTypes.array.isRequired,
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default EditFieldFilter;
