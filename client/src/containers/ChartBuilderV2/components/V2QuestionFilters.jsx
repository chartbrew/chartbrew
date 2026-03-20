import React from "react";
import PropTypes from "prop-types";
import { nanoid } from "@reduxjs/toolkit";
import {
  Autocomplete, AutocompleteItem, Button, Chip, DatePicker, Input, Select, SelectItem, Spacer, Switch,
} from "@heroui/react";
import { I18nProvider } from "@react-aria/i18n";
import { parseDate } from "@internationalized/date";
import { LuPlus, LuTrash2 } from "react-icons/lu";

import { operators } from "../../../modules/filterOperations";

function V2QuestionFilters({ filters, fieldOptions, onChange }) {
  const _onAddFilter = () => {
    onChange([
      ...filters,
      {
        id: nanoid(),
        fieldId: "",
        operator: "is",
        value: "",
        type: null,
        exposed: false,
      },
    ]);
  };

  const _onRemoveFilter = (filterId) => {
    onChange(filters.filter((filter) => filter.id !== filterId));
  };

  const _onUpdateFilter = (filterId, patch) => {
    onChange(filters.map((filter) => {
      if (filter.id !== filterId) {
        return filter;
      }

      const nextFilter = {
        ...filter,
        ...patch,
      };

      if (Object.prototype.hasOwnProperty.call(patch, "fieldId")) {
        const selectedField = fieldOptions.find((field) => `${field.id}` === `${patch.fieldId}`);
        nextFilter.type = selectedField?.type || null;
        nextFilter.value = "";
      }

      if (Object.prototype.hasOwnProperty.call(patch, "exposed")) {
        nextFilter.valueSource = patch.exposed ? "chartFilter" : "static";
        nextFilter.bindingId = patch.exposed ? (nextFilter.bindingId || nextFilter.id) : null;
      }

      return nextFilter;
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      {filters.map((filter) => {
        const selectedField = fieldOptions.find((field) => `${field.id}` === `${filter.fieldId}`);
        const isDate = selectedField?.type === "date";

        return (
          <div key={filter.id} className="rounded-lg border-1 border-divider bg-background p-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-4">
                <Autocomplete
                  label="Field"
                  labelPlacement="outside"
                  variant="bordered"
                  selectedKey={filter.fieldId}
                  onSelectionChange={(key) => _onUpdateFilter(filter.id, { fieldId: key })}
                  aria-label="Filter field"
                >
                  {fieldOptions.map((field) => (
                    <AutocompleteItem
                      key={field.id}
                      textValue={field.label}
                      startContent={(
                        <Chip size="sm" variant="flat">
                          {field.type}
                        </Chip>
                      )}
                    >
                      {field.label}
                    </AutocompleteItem>
                  ))}
                </Autocomplete>
              </div>
              <div className="col-span-12 md:col-span-3">
                <Select
                  label="Operator"
                  labelPlacement="outside"
                  variant="bordered"
                  selectedKeys={[filter.operator]}
                  onSelectionChange={(keys) => _onUpdateFilter(filter.id, { operator: keys.currentKey })}
                  aria-label="Filter operator"
                >
                  {operators.map((operator) => (
                    <SelectItem key={operator.value}>
                      {operator.text}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="col-span-12 md:col-span-3">
                {isDate ? (
                  <I18nProvider locale="en-GB">
                    <DatePicker
                      label="Value"
                      labelPlacement="outside"
                      variant="bordered"
                      showMonthAndYearPickers
                      value={filter.value ? parseDate(filter.value) : null}
                      onChange={(date) => _onUpdateFilter(filter.id, { value: date?.toString() || "" })}
                      aria-label="Filter value"
                    />
                  </I18nProvider>
                ) : (
                  <Input
                    label="Value"
                    labelPlacement="outside"
                    variant="bordered"
                    value={filter.value || ""}
                    onChange={(event) => _onUpdateFilter(filter.id, { value: event.target.value })}
                    aria-label="Filter value"
                  />
                )}
              </div>
              <div className="col-span-12 md:col-span-1 flex items-center md:items-end">
                <Switch
                  isSelected={filter.exposed === true}
                  onValueChange={(value) => _onUpdateFilter(filter.id, { exposed: value })}
                  size="sm"
                >
                  Expose
                </Switch>
              </div>
              <div className="col-span-12 md:col-span-1 flex items-end justify-end">
                <Button
                  isIconOnly
                  variant="light"
                  color="danger"
                  onPress={() => _onRemoveFilter(filter.id)}
                  aria-label="Remove filter"
                >
                  <LuTrash2 />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <Spacer y={1} />
      <div>
        <Button
          variant="bordered"
          startContent={<LuPlus />}
          onPress={_onAddFilter}
          size="sm"
        >
          Add chart filter
        </Button>
      </div>
    </div>
  );
}

V2QuestionFilters.propTypes = {
  fieldOptions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    type: PropTypes.string,
    exposed: PropTypes.bool,
  })),
  filters: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    fieldId: PropTypes.string,
    operator: PropTypes.string,
    value: PropTypes.any,
    type: PropTypes.string,
  })),
  onChange: PropTypes.func,
};

V2QuestionFilters.defaultProps = {
  fieldOptions: [],
  filters: [],
  onChange: () => {},
};

export default V2QuestionFilters;
