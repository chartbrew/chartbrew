import React, { useState } from "react";
import PropTypes from "prop-types";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale";
import { format, formatISO } from "date-fns";
import {
  Container, Row, Button, Dropdown, Spacer, Text, Input,
} from "@nextui-org/react";
import { Calendar as CalendarIcon, CloseSquare } from "react-iconly";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import { secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";

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
                  <Row key={condition.id} align="center">
                    <div>
                      <Text b>{`${condition.field.substring(condition.field.lastIndexOf(".") + 1)} ${condition.operator}`}</Text>
                      <Spacer y={0.2} />
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {condition.type !== "date" && (
                          <Dropdown>
                            <Dropdown.Trigger type="text">
                              <Input
                                type="text"
                                value={
                                  optionFilter[condition.id]
                                  || _getConditionValue(condition.id)
                                }
                                placeholder="Double-click to search"
                                onChange={(e) => {
                                  setOptionFilter({
                                    ...optionFilter, [condition.id]: e.target.value
                                  });
                                }}
                                bordered
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
                            >
                              {_getFilteredOptions(filterOptions, condition.id).map((opt) => (
                                <Dropdown.Item key={opt.value}>
                                  {opt.text}
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          </Dropdown>
                        )}
                        {condition.type === "date" && calendarOpen !== condition.id && (
                          <>
                            <Button
                              bordered
                              icon={<CalendarIcon />}
                              onClick={() => setCalendarOpen(condition.id)}
                              auto
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
