import React, { useState, useEffect } from "react";
import { findIndex } from "lodash";
import PropTypes from "prop-types";
import {
  Select, Input, DatePicker, Autocomplete,
  Chip, Separator, EmptyState, Label, ListBox, SearchField, useFilter,
} from "@heroui/react";
import { parseDate, today } from "@internationalized/date";
import moment from "moment";
import { operators } from "../../../modules/filterOperations";
import FieldFilter from "./FieldFilter";
import { selectCharts } from "../../../slices/chart";
import { useSelector } from "react-redux";

function EditFieldFilter({
  filter,
  onChange,
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [fieldCondition, setFieldCondition] = useState({
    field: filter?.field || "",
    operator: filter?.operator || "is",
    value: filter?.value || "",
    dataType: filter?.dataType || "",
  });
  const [fieldOptions, setFieldOptions] = useState([]);

  const charts = useSelector(selectCharts);

  useEffect(() => {
    setFieldCondition({
      field: filter?.field || "",
      operator: filter?.operator || "is",
      value: filter?.value || "",
      dataType: filter?.dataType || "",
    });
  }, [filter]);

  useEffect(() => {
    if (charts) {
      const tempFieldOptions = [];
      charts.map((chart) => {
        if (chart.ChartDatasetConfigs) {
          chart.ChartDatasetConfigs.forEach((cdc) => {
            if (cdc.Dataset?.fieldsSchema) {
              Object.keys(cdc.Dataset?.fieldsSchema).forEach((key) => {
                const type = cdc.Dataset?.fieldsSchema[key];
                if (findIndex(tempFieldOptions, { key }) !== -1) return;
                tempFieldOptions.push({
                  key,
                  text: key && key.replace("root[].", "").replace("root.", ""),
                  value: key,
                  type,
                  chart_id: chart.id,
                  label: {
                    content: type || "unknown",
                    color: type === "date" ? "warning"
                      : type === "number" ? "success"
                        : type === "string" ? "primary"
                          : type === "boolean" ? "warning"
                            : "neutral"
                  },
                });
              });
            }
          });
        }
        return chart;
      });

      setFieldOptions(tempFieldOptions);
    }
  }, [charts]);

  const _handleFieldChange = (key, value) => {
    const newCondition = { ...fieldCondition, [key]: value };
    if (key === "field") {
      const selectedField = fieldOptions.find(f => f.value === value);
      newCondition.dataType = selectedField?.type;
    }
    setFieldCondition(newCondition);
    onChange({ ...filter, ...newCondition });
  };

  const selectedField = fieldOptions.find(f => f.value === fieldCondition.field);
  const isDateField = selectedField?.type === "date";

  const _getChartsWithField = (field) => {
    const chartsFound = [];
    charts.map((chart) => {
      let found = false;
      if (chart.ChartDatasetConfigs) {
        chart.ChartDatasetConfigs.forEach((cdc) => {
          if (cdc.Dataset?.fieldsSchema) {
            Object.keys(cdc.Dataset.fieldsSchema).forEach((key) => {
              if (key === field) found = true;
            });
          }
        });
      }

      if (found) chartsFound.push(chart);
      return chart;
    });

    return chartsFound;
  };

  return (
    <>
      <div className="font-bold">
        Configure the field filter
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-2 items-center">
          <Autocomplete
            value={fieldCondition.field || null}
            onChange={(value) => _handleFieldChange("field", value)}
            selectionMode="single"
            size="sm"
            variant="secondary"
            aria-label="Select a field"
          >
            <Label>Select a field</Label>
            <Autocomplete.Trigger>
              <Autocomplete.Value />
              <Autocomplete.Indicator />
            </Autocomplete.Trigger>
            <Autocomplete.Popover>
              <Autocomplete.Filter filter={contains}>
                <SearchField autoFocus name="field-filter-search" variant="secondary">
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search fields..." />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                  {fieldOptions.map((field) => (
                    <ListBox.Item
                      key={field.value}
                      id={field.value}
                      textValue={field.text}
                    >
                      <Chip variant="soft" size="sm" color={field.label.color} className="min-w-[70px] text-center">
                        {field.type}
                      </Chip>
                      {field.text}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Autocomplete.Filter>
            </Autocomplete.Popover>
          </Autocomplete>

          <Select
            variant="secondary"
            value={fieldCondition.operator || null}
            onChange={(value) => _handleFieldChange("operator", value)}
            selectionMode="single"
            size="sm"
            aria-label="Select an operator"
          >
            <Label>Select an operator</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {operators.map((op) => (
                  <ListBox.Item key={op.value} id={op.value} textValue={op.text}>
                    {op.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {fieldCondition.field && (
            isDateField ? (
              <DatePicker
                label="Select a date"
                value={fieldCondition.value ? parseDate(moment(fieldCondition.value).format("YYYY-MM-DD")) : today()}
                onChange={(date) => _handleFieldChange("value", date.toString())}
                variant="secondary"
                showMonthAndYearPickers
                calendarProps={{ color: "primary" }}
                size="sm"
                aria-label="Select a date"
              />
            ) : (
              <Input
                label="Enter a value"
                variant="secondary"
                value={fieldCondition.value}
                onChange={(e) => _handleFieldChange("value", e.target.value)}
                size="sm"
                aria-label="Enter a value"
              />
            )
          )}
        </div>

        {fieldCondition.field && (
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">Affected charts:</div>
            <div className="flex flex-row flex-wrap gap-1">
              {_getChartsWithField(fieldCondition.field).map((chart) => (
                <Chip key={chart.id} variant="primary" className="rounded-sm">
                  {chart.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <div>
          <div className="mb-2 font-bold">Preview filter</div>
          <FieldFilter filter={fieldCondition} />
        </div>
      </div>
    </>
  );
}

EditFieldFilter.propTypes = {
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default EditFieldFilter;
