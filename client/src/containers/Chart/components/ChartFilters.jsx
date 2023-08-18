import React, { Fragment, useState } from "react";
import PropTypes from "prop-types";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale";
import { format, formatISO } from "date-fns";
import {
  Container, Row, Button, Dropdown, Spacer, Text, Input,
} from "@nextui-org/react";
import { Calendar as CalendarIcon, CloseSquare, TickSquare } from "react-iconly";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import { secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";
import * as operations from "../../../modules/filterOperations";

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
    chart.Datasets.forEach((d) => {
      if (d.conditions) {
        filterCount += d.conditions.filter((c) => c.exposed).length;
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

  return (
    <div>
      <Container css={{ pl: 0, pr: 0 }}>
        {!_checkIfFilters() && (
          <Row>
            <p>No filters available</p>
          </Row>
        )}
        {chart
          && chart.Datasets.filter((d) => d.conditions && d.conditions.length)
            .map((dataset) => {
              return dataset.conditions.filter((c) => c.exposed).map((condition) => {
                const filterOptions = _getDropdownOptions(dataset, condition);
                return (
                  <Fragment key={condition.id}>
                    <Row align="center">
                      <div>
                        <Row align="center">
                          <Text b size={14}>
                            {condition.displayName || condition.field.substring(condition.field.lastIndexOf(".") + 1)}
                          </Text>
                          <Spacer x={0.2} />
                          <Text size={14}>
                            {operations
                              .operators?.find((o) => condition.operator === o.value)?.text}
                          </Text>
                        </Row>
                        <Spacer y={0.2} />
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {condition.type !== "date" && !condition.hideValues && (
                            <Dropdown isBordered>
                              <Dropdown.Trigger type="text">
                                <Input
                                  type="text"
                                  value={
                                    optionFilter[condition.id]
                                    || _getConditionValue(condition.id)
                                  }
                                  placeholder="Enter a value or search"
                                  onChange={(e) => {
                                    setOptionFilter({
                                      ...optionFilter, [condition.id]: e.target.value
                                    });
                                  }}
                                  bordered
                                  size="sm"
                                  contentRightStyling={false}
                                  contentRight={(
                                    <Button
                                      auto
                                      icon={<TickSquare />}
                                      color="success"
                                      size="sm"
                                      css={{ minWidth: "fit-content" }}
                                      flat
                                      onClick={() => {
                                        _onOptionSelected(optionFilter[condition.id], condition);
                                      }}
                                    />
                                  )}
                                />
                              </Dropdown.Trigger>
                              <Dropdown.Menu
                                selectedKeys={[`${_getConditionValue(condition.id)}`]}
                                onSelectionChange={(selection) => {
                                  _onOptionSelected(Object.values(selection)[0], condition);
                                  setOptionFilter({
                                    ...optionFilter, [condition.id]: ""
                                  });
                                }}
                                selectionMode="single"
                                css={{ minWidth: "max-content" }}
                              >
                                {_getFilteredOptions(filterOptions, condition.id).map((opt) => (
                                  <Dropdown.Item key={opt.value}>
                                    {opt.text}
                                  </Dropdown.Item>
                                ))}
                              </Dropdown.Menu>
                            </Dropdown>
                          )}
                          {condition.type !== "date" && condition.hideValues && (
                            <Input
                              type="text"
                              value={
                                optionFilter[condition.id]
                                || _getConditionValue(condition.id)
                              }
                              placeholder="Enter a value here"
                              onChange={(e) => {
                                setOptionFilter({
                                  ...optionFilter, [condition.id]: e.target.value
                                });
                              }}
                              bordered
                              size="sm"
                              contentRightStyling={false}
                              contentRight={(
                                <Button
                                  auto
                                  icon={<TickSquare />}
                                  color="success"
                                  size="sm"
                                  css={{ minWidth: "fit-content" }}
                                  flat
                                  onClick={() => {
                                    _onOptionSelected(optionFilter[condition.id], condition);
                                  }}
                                />
                              )}
                            />
                          )}
                          {condition.type === "date" && calendarOpen !== condition.id && (
                            <>
                              <Button
                                bordered
                                icon={<CalendarIcon />}
                                onClick={() => setCalendarOpen(condition.id)}
                                auto
                                size="sm"
                              >
                                {(_getConditionValue(condition.id) && format(new Date(_getConditionValue(condition.id)), "Pp", { locale: enGB })) || "Select a date"}
                              </Button>
                              <Spacer x={0.2} />
                              {_getConditionValue(condition.id) && (
                                <Button
                                  light
                                  icon={<CloseSquare />}
                                  onClick={() => _onOptionSelected("", condition)}
                                  auto
                                />
                              )}
                            </>
                          )}
                          {condition.type === "date" && calendarOpen === condition.id && (
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
                          )}
                        </div>
                      </div>
                    </Row>
                    <Spacer y={0.5} />
                  </Fragment>
                );
              });
            })}
      </Container>
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
