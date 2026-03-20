import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Autocomplete,
  AutocompleteItem,
  Chip,
} from "@heroui/react";

import DateRangeFilter from "./DateRangeFilter";
import {
  applyDashboardFieldOption,
  findDashboardFieldOption,
  findDashboardVariableOption,
  getDashboardDateFieldOptions,
  getDashboardVariableOptions,
} from "../../../modules/dashboardFilterBindings";

function EditDateRangeFilter({
  charts,
  filter,
  onChange,
}) {
  const dateFieldOptions = useMemo(() => getDashboardDateFieldOptions(charts), [charts]);
  const [fieldSelection, setFieldSelection] = useState({
    selectedFieldKey: filter?.selectedFieldKey || "",
    fieldId: filter?.fieldId || "",
    field: filter?.field || "",
    fieldLabel: filter?.fieldLabel || "",
    dataType: filter?.dataType || "",
    bindings: Array.isArray(filter?.bindings) ? filter.bindings.filter((binding) => binding?.targetType === "field") : [],
    charts: Array.isArray(filter?.charts) ? filter.charts : [],
  });
  const [dateRange, setDateRange] = useState({
    startDate: filter?.startDate,
    endDate: filter?.endDate,
  });
  const [selectedFieldKey, setSelectedFieldKey] = useState(filter?.selectedFieldKey || "");
  const [startVariableKey, setStartVariableKey] = useState("");
  const [endVariableKey, setEndVariableKey] = useState("");

  useEffect(() => {
    const selectedOption = findDashboardFieldOption(dateFieldOptions, filter);
    const fieldBindings = selectedOption?.bindings
      || (Array.isArray(filter?.bindings) ? filter.bindings.filter((binding) => binding?.targetType === "field") : []);
    setSelectedFieldKey(selectedOption?.key || filter?.selectedFieldKey || "");
    setFieldSelection({
      selectedFieldKey: selectedOption?.key || filter?.selectedFieldKey || "",
      fieldId: selectedOption?.fieldId || filter?.fieldId || "",
      field: selectedOption?.field || filter?.field || "",
      fieldLabel: selectedOption?.text || filter?.fieldLabel || "",
      dataType: selectedOption?.type || filter?.dataType || "",
      bindings: fieldBindings,
      charts: selectedOption?.chartIds || (Array.isArray(filter?.charts) ? filter.charts : []),
    });
    setDateRange({
      startDate: filter?.startDate,
      endDate: filter?.endDate,
    });
    const variableBindings = Array.isArray(filter?.bindings)
      ? filter.bindings.filter((binding) => binding?.targetType === "variable")
      : [];
    const startBinding = variableBindings.find((binding) => binding?.role === "start");
    const endBinding = variableBindings.find((binding) => binding?.role === "end");
    setStartVariableKey(startBinding?.variableName || "");
    setEndVariableKey(endBinding?.variableName || "");
  }, [dateFieldOptions, filter]);

  const selectedField = findDashboardFieldOption(dateFieldOptions, {
    ...filter,
    selectedFieldKey,
  });
  const variableOptions = useMemo(() => (
    getDashboardVariableOptions(charts, selectedField?.bindings || fieldSelection.bindings)
  ), [charts, fieldSelection.bindings, selectedField?.bindings]);
  const selectedStartVariable = findDashboardVariableOption(variableOptions, startVariableKey);
  const selectedEndVariable = findDashboardVariableOption(variableOptions, endVariableKey);

  const _buildDateFilterPayload = ({
    nextFieldSelection = fieldSelection,
    nextDateRange = dateRange,
    nextStartVariable = selectedStartVariable,
    nextEndVariable = selectedEndVariable,
  } = {}) => {
    const variableBindings = [
      ...((nextStartVariable?.bindings || []).map((binding) => ({
        ...binding,
        role: "start",
      }))),
      ...((nextEndVariable?.bindings || []).map((binding) => ({
        ...binding,
        role: "end",
      }))),
    ];

    return {
      ...filter,
      ...nextFieldSelection,
      type: "date",
      startDate: nextDateRange.startDate,
      endDate: nextDateRange.endDate,
      startVariableKey: nextStartVariable?.key || "",
      endVariableKey: nextEndVariable?.key || "",
      bindings: [
        ...(nextFieldSelection.bindings || []),
        ...variableBindings,
      ],
    };
  };

  const _handleFieldSelection = (key) => {
    const selectedOption = dateFieldOptions.find((option) => option.key === key);
    const nextFieldSelection = applyDashboardFieldOption({
      ...fieldSelection,
      selectedFieldKey: selectedOption?.key || "",
    }, selectedOption);
    const nextVariableOptions = getDashboardVariableOptions(charts, nextFieldSelection.bindings);
    const nextStartVariable = findDashboardVariableOption(nextVariableOptions, startVariableKey);
    const nextEndVariable = findDashboardVariableOption(nextVariableOptions, endVariableKey);

    setSelectedFieldKey(selectedOption?.key || "");
    setFieldSelection(nextFieldSelection);
    setStartVariableKey(nextStartVariable?.key || "");
    setEndVariableKey(nextEndVariable?.key || "");
    onChange(_buildDateFilterPayload({
      nextFieldSelection,
      nextStartVariable,
      nextEndVariable,
    }));
  };

  const _handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
    onChange(_buildDateFilterPayload({
      nextDateRange: newDateRange,
    }));
  };

  const _handleVariableSelection = (role, key) => {
    const selectedOption = findDashboardVariableOption(variableOptions, key);
    const nextStartVariable = role === "start" ? selectedOption : selectedStartVariable;
    const nextEndVariable = role === "end" ? selectedOption : selectedEndVariable;

    if (role === "start") {
      setStartVariableKey(selectedOption?.key || "");
    } else {
      setEndVariableKey(selectedOption?.key || "");
    }

    onChange(_buildDateFilterPayload({
      nextStartVariable,
      nextEndVariable,
    }));
  };

  return (
    <>
      <div className="font-bold">
        Configure the date filter
      </div>

      <div className="flex flex-col gap-4">
        <Autocomplete
          label="Select a date field"
          selectedKey={selectedFieldKey || null}
          onSelectionChange={_handleFieldSelection}
          size="sm"
          variant="bordered"
          aria-label="Select a date field"
          isClearable={false}
        >
          {dateFieldOptions.map((fieldOption) => (
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

        {selectedField && variableOptions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Autocomplete
              label="Start variable"
              selectedKey={startVariableKey || null}
              onSelectionChange={(key) => _handleVariableSelection("start", key)}
              size="sm"
              variant="bordered"
              aria-label="Select a start variable"
              isClearable
            >
              {variableOptions.map((variableOption) => (
                <AutocompleteItem
                  key={variableOption.key}
                  startContent={(
                    <Chip variant="flat" size="sm" color={variableOption.label.color} className="min-w-[70px] text-center">
                      {variableOption.type}
                    </Chip>
                  )}
                  textValue={variableOption.text}
                  description={`${variableOption.chartIds.length} chart${variableOption.chartIds.length === 1 ? "" : "s"} · ${variableOption.sources.join(", ")}`}
                >
                  {variableOption.text}
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Autocomplete
              label="End variable"
              selectedKey={endVariableKey || null}
              onSelectionChange={(key) => _handleVariableSelection("end", key)}
              size="sm"
              variant="bordered"
              aria-label="Select an end variable"
              isClearable
            >
              {variableOptions.map((variableOption) => (
                <AutocompleteItem
                  key={variableOption.key}
                  startContent={(
                    <Chip variant="flat" size="sm" color={variableOption.label.color} className="min-w-[70px] text-center">
                      {variableOption.type}
                    </Chip>
                  )}
                  textValue={variableOption.text}
                  description={`${variableOption.chartIds.length} chart${variableOption.chartIds.length === 1 ? "" : "s"} · ${variableOption.sources.join(", ")}`}
                >
                  {variableOption.text}
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
        )}

        <DateRangeFilter
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={_handleDateRangeChange}
          showLabel
          size="lg"
          isEdit
        />

        <div className="text-sm text-foreground-500">
          Dashboard date filters now bind to chart date fields explicitly. You can also map the same filter to request variables so V2 charts keep field filtering and query variables in sync.
        </div>
      </div>
    </>
  );
}

EditDateRangeFilter.propTypes = {
  charts: PropTypes.array.isRequired,
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default EditDateRangeFilter;
