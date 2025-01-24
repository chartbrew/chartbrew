import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Spacer, Input, Autocomplete, AutocompleteItem, DatePicker,
} from "@heroui/react";
import { I18nProvider } from "@react-aria/i18n";
import { LuX } from "react-icons/lu";
import { parseDate } from "@internationalized/date";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import determineType from "../../../modules/determineType";
import * as operations from "../../../modules/filterOperations";
import Row from "../../../components/Row";

function ChartFilters(props) {
  const {
    chart, onAddFilter, onClearFilter, conditions, inline, size, amount,
  } = props;

  const [optionFilter, setOptionFilter] = useState({});

  useEffect(() => {
    const filterOptions = {};
    conditions.forEach((c) => {
      filterOptions[c.id] = c.value || "";
    });
    setOptionFilter(filterOptions);
  }, [conditions]);

  const _getDropdownOptions = (dataset, condition) => {
    const conditionOpt = dataset.conditions.find((c) => c.field === condition.field);

    if (!conditionOpt || !conditionOpt.values) return [];

    return conditionOpt.values.map((v) => {
      const isBoolean = determineType(v) === "boolean";
      return {
        key: v,
        value: isBoolean || v === null ? `${v}` : v,
        text: `${v}`,
      };
    });
  };

  const _onOptionSelected = (value, condition, clear = false) => {
    if (clear) onClearFilter(condition);
    else onAddFilter({ ...condition, value });
  };

  const _getConditionValue = (conditionId) => {
    const condition = conditions.find((c) => c.id === conditionId);
    if (!condition) return null;

    return condition.value;
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    chart.ChartDatasetConfigs.forEach((cdc) => {
      if (Array.isArray(cdc.Dataset?.conditions)) {
        filterCount += cdc.Dataset.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount;
  };

  const _getFilteredOptions = (filterOptions, cId) => {
    if (!optionFilter[cId]) return filterOptions;

    return filterOptions
      .filter((o) => o.text
        && o.text.toString().toLowerCase()?.includes(optionFilter[cId].toLowerCase()));
  };

  const _onOptionValueChange = (value, condition) => {
    if (_getConditionValue(condition.id) === value) return;
    setOptionFilter({
      ...optionFilter, [condition.id]: value,
    });
  };

  const _onKeyDown = (e, condition) => {
    if (e.key === "Enter") {
      _onOptionSelected(optionFilter[condition.id], condition);
    }
  };

  const _getAllFilters = () => {
    const filters = [];
    chart.ChartDatasetConfigs.forEach((cdc) => {
      if (Array.isArray(cdc.Dataset?.conditions)) {
        cdc.Dataset.conditions.forEach((c) => {
          if (c.exposed) {
            filters.push({ ...c, Dataset: cdc.Dataset });
          }
        });
      }
    });

    if (amount) return filters.slice(0, amount);

    return filters;
  };

  return (
    <div>
      {!_checkIfFilters() && (
        <Row>
          <p>No filters available</p>
        </Row>
      )}
      {chart && _getAllFilters().map((condition) => {
        const filterOptions = _getDropdownOptions(condition.Dataset, condition);
        return (
          <Fragment key={condition.id}>
            <div className={`flex ${!inline ? "flex-col gap-1" : ""}`}>
              {condition.type !== "date" && !condition.hideValues && (
                <>
                  <Autocomplete
                    label={!inline ? `${condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}` : null}
                    variant="bordered"
                    selectedKey={_getConditionValue(condition.id)}
                    onSelectionChange={(key) => {
                      _onOptionSelected(key, condition);
                    }}
                    onInputChange={(value) => _onOptionValueChange(value, condition)}
                    onKeyDown={(e) => _onKeyDown(e, condition)}
                    placeholder={inline
                      ? _getConditionValue(condition.id) || `${condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}`
                      : _getConditionValue(condition.id) || "Search here"
                    }
                    inputProps={{
                      classNames: { input: "placeholder:text-xs" },
                    }}
                    allowsCustomValue
                    size={size}
                    aria-label="Filter"
                  >
                    {_getFilteredOptions(filterOptions, condition.id).slice(0, 50).map((opt) => (
                      <AutocompleteItem key={opt.value} textValue={opt.text}>
                        {opt.text}
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                  <Spacer y={1} />
                </>
              )}
              {condition.type !== "date" && condition.hideValues && (
                <>
                  <Input
                    type="text"
                    value={optionFilter[condition.id]}
                    label={!inline ? `${condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}` : null}
                    placeholder={inline
                      ? `${condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}`
                      : "Enter a value here"
                    }
                    onChange={(e) => {
                      setOptionFilter({
                        ...optionFilter, [condition.id]: e.target.value
                      });
                    }}
                    variant="bordered"
                    onKeyDown={(e) => _onKeyDown(e, condition)}
                    size={size}
                    classNames={{ input: "placeholder:text-xs" }}
                  />
                  <Spacer y={1} />
                </>
              )}
              {condition.type === "date" && !inline && (
                <>
                  <div className="flex items-center gap-1">
                    <I18nProvider locale="en-GB">
                      <DatePicker
                        label={`${condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}`}
                        variant="bordered"
                        showMonthAndYearPickers
                        value={(
                          _getConditionValue(condition.id)
                          && parseDate(_getConditionValue(condition.id))
                        ) || null}
                        onChange={(date) => _onOptionSelected(date.toString(), condition)}
                        size="sm"
                        aria-label="Date filter"
                      />
                    </I18nProvider>

                    {_getConditionValue(condition.id) && (
                      <Button
                        variant="light"
                        isIconOnly
                        onPress={() => _onOptionSelected("", condition, true)}
                        size={size}
                      >
                        <LuX />
                      </Button>
                    )}
                  </div>
                  <Spacer y={1} />
                </>
              )}
              {condition.type === "date" && inline && (
                <>
                  <div className="flex flex-row items-center gap-1">
                    <I18nProvider locale="en-GB">
                      <DatePicker
                        aria-label="Date filter"
                        placeholder={`${condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.key}`}
                        variant="bordered"
                        showMonthAndYearPickers
                        value={(
                          _getConditionValue(condition.id)
                          && parseDate(_getConditionValue(condition.id))
                        ) || null}
                        onChange={(date) => _onOptionSelected(date.toString(), condition)}
                        size="sm"
                      />
                    </I18nProvider>
                    {_getConditionValue(condition.id) && (
                      <Button
                        variant="light"
                        isIconOnly
                        onPress={() => _onOptionSelected("", condition, true)}
                        size={size}
                      >
                        <LuX />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

ChartFilters.propTypes = {
  chart: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  onClearFilter: PropTypes.func.isRequired,
  conditions: PropTypes.array,
  inline: PropTypes.bool,
  size: PropTypes.string,
  amount: PropTypes.number,
};

ChartFilters.defaultProps = {
  conditions: [],
  inline: false,
  size: "md",
  amount: 0,
};

export default ChartFilters;
