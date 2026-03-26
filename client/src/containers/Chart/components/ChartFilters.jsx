import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Autocomplete,
  Button,
  Calendar,
  DateField,
  DatePicker,
  EmptyState,
  Input,
  Label,
  ListBox,
  SearchField,
  useFilter,
} from "@heroui/react";
import { I18nProvider } from "@react-aria/i18n";
import { LuX } from "react-icons/lu";
import { parseDate } from "@internationalized/date";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import determineType from "../../../modules/determineType";
import * as operations from "../../../modules/filterOperations";
import Row from "../../../components/Row";
import { getExposedChartFilters } from "../../../modules/getChartDatasetConditions";

function ChartFilters(props) {
  const { contains } = useFilter({ sensitivity: "base" });
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
    const conditionOpt = condition.sourceConditions?.find((c) => c.id === condition.id)
      || condition.sourceConditions?.find((c) => c.field === condition.field)
      || dataset?.conditions?.find((c) => c.id === condition.id)
      || dataset?.conditions?.find((c) => c.field === condition.field);

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
    return getExposedChartFilters(chart).length;
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
    const filters = getExposedChartFilters(chart);

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
                    variant="secondary"
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
                    className="[&_input]:placeholder:text-xs"
                    allowsCustomValue
                    size={size}
                    aria-label="Filter"
                  >
                    {!inline && (
                      <Label>
                        {`${condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}`}
                      </Label>
                    )}
                    <Autocomplete.Trigger>
                      <Autocomplete.Value />
                      <Autocomplete.ClearButton />
                      <Autocomplete.Indicator />
                    </Autocomplete.Trigger>
                    <Autocomplete.Popover>
                      <Autocomplete.Filter filter={contains}>
                        <SearchField autoFocus name={`chart-filter-${condition.id}`} variant="secondary">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Search here" />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                        <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
                          {_getFilteredOptions(filterOptions, condition.id).slice(0, 50).map((opt) => (
                            <ListBox.Item key={opt.value} id={opt.value} textValue={opt.text}>
                              {opt.text}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Autocomplete.Filter>
                    </Autocomplete.Popover>
                  </Autocomplete>
                  <div className="h-2" />
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
                    variant="secondary"
                    onKeyDown={(e) => _onKeyDown(e, condition)}
                    size={size}
                    className="placeholder:text-xs"
                  />
                  <div className="h-2" />
                </>
              )}
              {condition.type === "date" && !inline && (
                <>
                  <div className="flex items-center gap-1">
                    <I18nProvider locale="en-GB">
                      <DatePicker
                        aria-label="Date filter"
                        name={`chart-filter-date-${condition.id}`}
                        className="min-w-0 flex-1"
                        value={(
                          _getConditionValue(condition.id)
                          && parseDate(_getConditionValue(condition.id))
                        ) || null}
                        onChange={(date) => {
                          if (date) {
                            _onOptionSelected(date.toString(), condition);
                          }
                        }}
                      >
                        <Label>
                          {`${condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.text}`}
                        </Label>
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
                          <Calendar aria-label="Date filter">
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
                    </I18nProvider>

                    {_getConditionValue(condition.id) && (
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={() => _onOptionSelected("", condition, true)}
                        size={size}
                      >
                        <LuX />
                      </Button>
                    )}
                  </div>
                  <div className="h-2" />
                </>
              )}
              {condition.type === "date" && inline && (
                <>
                  <div className="flex flex-row items-center gap-1">
                    <I18nProvider locale="en-GB">
                      <DatePicker
                        aria-label={`${condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.key}`}
                        name={`chart-filter-date-inline-${condition.id}`}
                        className="min-w-0 flex-1"
                        value={(
                          _getConditionValue(condition.id)
                          && parseDate(_getConditionValue(condition.id))
                        ) || null}
                        onChange={(date) => {
                          if (date) {
                            _onOptionSelected(date.toString(), condition);
                          }
                        }}
                      >
                        <Label className="sr-only">
                          {`${condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${operations.operators?.find((o) => condition.operator === o.value)?.key}`}
                        </Label>
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
                          <Calendar aria-label="Date filter">
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
                    </I18nProvider>
                    {_getConditionValue(condition.id) && (
                      <Button
                        variant="ghost"
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
  size: "sm",
  amount: 0,
};

export default ChartFilters;
