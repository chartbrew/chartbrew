import React, { useState, useEffect } from "react";
import { findIndex } from "lodash";
import PropTypes from "prop-types";
import {
  Select, SelectItem, Input, DatePicker, Autocomplete, AutocompleteItem,
  Chip, Divider,
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
            label="Select a field"
            value={() => (
              <span>{(fieldCondition.field && fieldCondition.field.substring(fieldCondition.field.lastIndexOf(".") + 1)) || "Select a field"}</span>
            )}
            selectedKey={fieldCondition.field}
            onSelectionChange={(key) => _handleFieldChange("field", key)}
            size="sm"
            variant="bordered"
            aria-label="Select a field"
            isClearable={false}
          >
            {fieldOptions.map((field) => (
              <AutocompleteItem
                key={field.value}
                startContent={(
                  <Chip variant="flat" size="sm" color={field.label.color} className="min-w-[70px] text-center">
                    {field.type}
                  </Chip>
                )}
                textValue={field.text}
              >
                {field.text}
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

          {fieldCondition.field && (
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

        {fieldCondition.field && (
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">Affected charts:</div>
            <div className="flex flex-row flex-wrap gap-1">
              {_getChartsWithField(fieldCondition.field).map((chart) => (
                <Chip key={chart.id} color="primary" radius="sm" variant="flat">
                  {chart.name}
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
  filter: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default EditFieldFilter;
