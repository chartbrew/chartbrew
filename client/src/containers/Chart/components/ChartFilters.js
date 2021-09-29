import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Dropdown, Form, Segment,
} from "semantic-ui-react";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale";
import { format, formatISO } from "date-fns";

import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file

import { secondary } from "../../../config/colors";

function ChartFilters(props) {
  const {
    chart, onAddFilter, onClearFilter, conditions,
  } = props;

  const [calendarOpen, setCalendarOpen] = useState("");

  const _getDropdownOptions = (dataset, condition) => {
    const conditionOpt = dataset.conditions.find((c) => c.field === condition.field);

    if (!conditionOpt || !conditionOpt.values) return [];

    return conditionOpt.values.map((v) => {
      return {
        key: v,
        value: v,
        text: v,
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

  return (
    <div>
      <Form>
        {!_checkIfFilters() && (
          <Form.Field>
            <p>No filters available</p>
          </Form.Field>
        )}
        {chart
          && chart.Datasets.filter((d) => d.conditions && d.conditions.length)
            .map((dataset) => {
              return dataset.conditions.filter((c) => c.exposed).map((condition) => {
                const filterOptions = _getDropdownOptions(dataset, condition);
                return (
                  <Form.Field key={condition.id}>
                    <label>{`${condition.field.replace("root[].", "")} ${condition.operator}`}</label>
                    {condition.type !== "date" && (
                    <Dropdown
                      selection
                      clearable
                      search
                      placeholder={`${condition.field.replace("root[].", "")}`}
                      options={filterOptions}
                      onChange={(e, data) => _onOptionSelected(data.value, condition)}
                      value={_getConditionValue(condition.id) || ""}
                      scrolling
                      style={{ minWidth: 250 }}
                    />
                    )}
                    {condition.type === "date" && calendarOpen !== condition.id && (
                    <>
                      <Button
                        basic
                        icon="calendar"
                        content={(_getConditionValue(condition.id) && format(new Date(_getConditionValue(condition.id)), "Pp", { locale: enGB })) || "Select a date"}
                        onClick={() => setCalendarOpen(condition.id)}
                        size="small"
                      />
                      {_getConditionValue(condition.id) && (
                        <Button
                          className="tertiary"
                          icon="x"
                          onClick={() => _onOptionSelected("", condition)}
                          size="small"
                        />
                      )}
                    </>
                    )}
                    {condition.type === "date" && calendarOpen === condition.id && (
                    <Segment textAlign="left">
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
                    </Segment>
                    )}
                  </Form.Field>
                );
              });
            })}
      </Form>
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
