import React, { Fragment, useState } from "react";
import PropTypes from "prop-types";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale";
import { format, formatISO } from "date-fns";
import {
  Button, Spacer, Input, Autocomplete, AutocompleteItem,
} from "@nextui-org/react";
import { LuCalendarDays, LuXCircle } from "react-icons/lu";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import { secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";
import * as operations from "../../../modules/filterOperations";
import Text from "../../../components/Text";
import Row from "../../../components/Row";

function ChartFilters(props) {
  const {
    chart, onAddFilter, onClearFilter, conditions,
  } = props;

  const [calendarOpen, setCalendarOpen] = useState("");
  const [optionFilter, setOptionFilter] = useState({});

  const _getDropdownOptions = (dataset, condition) => {
    const conditionOpt = dataset.conditions.find((c) => c.field === condition.field);

    if (!conditionOpt || !conditionOpt.values) return [];

    return conditionOpt.values.map((v) => {
      const isBoolean = determineType(v) === "boolean";
      return {
        key: v,
        value: isBoolean || v === null ? `${v}` : v,
        text: isBoolean || v === null ? `${v}` : v,
      };
    });
  };

  const _onOptionSelected = (value, condition) => {
    setCalendarOpen("");
    if (!value) onClearFilter(condition);
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
      if (cdc.Dataset?.conditions) {
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

  return (
    <div className="min-w-[200px]">
      {!_checkIfFilters() && (
        <Row>
          <p>No filters available</p>
        </Row>
      )}
      {chart && chart.ChartDatasetConfigs.filter((d) => d?.Dataset?.conditions && d?.Dataset?.conditions?.length).map((cdc) => {
        return cdc.Dataset?.conditions.filter((c) => c.exposed).map((condition) => {
          const filterOptions = _getDropdownOptions(cdc.Dataset, condition);
          return (
            <Fragment key={condition.id}>
              <div className="flex flex-col">
                <Row align="center">
                  <Text b>
                    {condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)}
                  </Text>
                  <Spacer x={0.5} />
                  <Text>
                    {operations
                      .operators?.find((o) => condition.operator === o.value)?.text}
                  </Text>
                </Row>
                <Spacer y={1} />
                {condition.type !== "date" && !condition.hideValues && (
                  <>
                    <Autocomplete
                      variant="bordered"
                      selectedKey={_getConditionValue(condition.id)}
                      onSelectionChange={(key) => {
                        _onOptionSelected(key, condition);
                      }}
                      onInputChange={(value) => _onOptionValueChange(value, condition)}
                      onKeyDown={(e) => _onKeyDown(e, condition)}
                      labelPlacement="outside"
                      placeholder={_getConditionValue(condition.id) || "Search here"}
                      allowsCustomValue
                    >
                      {_getFilteredOptions(filterOptions, condition.id).map((opt) => (
                        <AutocompleteItem key={opt.value}>
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
                      placeholder="Enter a value here"
                      labelPlacement="outside"
                      onChange={(e) => {
                        setOptionFilter({
                          ...optionFilter, [condition.id]: e.target.value
                        });
                      }}
                      variant="bordered"
                      onKeyDown={(e) => _onKeyDown(e, condition)}
                    />
                    <Spacer y={1} />
                  </>
                )}
                {condition.type === "date" && calendarOpen !== condition.id && (
                  <>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="bordered"
                        endContent={<LuCalendarDays />}
                        onClick={() => setCalendarOpen(condition.id)}
                      >
                        {(_getConditionValue(condition.id) && format(new Date(_getConditionValue(condition.id)), "Pp", { locale: enGB })) || "Select a date"}
                      </Button>
                      {_getConditionValue(condition.id) && (
                        <Button
                          variant="light"
                          color="danger"
                          isIconOnly
                          onClick={() => _onOptionSelected("", condition)}
                        >
                          <LuXCircle />
                        </Button>
                      )}
                    </div>
                    <Spacer y={1} />
                  </>
                )}
                {condition.type === "date" && calendarOpen === condition.id && (
                  <>
                    <div>
                      <Calendar
                        date={(
                          _getConditionValue(condition.id)
                          && new Date(_getConditionValue(condition.id))
                        )
                          || new Date()}
                        onChange={(date) => _onOptionSelected(formatISO(date), condition)}
                        locale={enGB}
                        color={secondary}
                      />
                    </div>
                    <Spacer y={1} />
                  </>
                )}
              </div>
              <Spacer y={1} />
            </Fragment>
          );
        });
      })}
    </div>
  );
}

ChartFilters.propTypes = {
  chart: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  onClearFilter: PropTypes.func.isRequired,
  conditions: PropTypes.array,
};

ChartFilters.defaultProps = {
  conditions: [],
};

export default ChartFilters;
