import React, { useState } from "react";
import PropTypes from "prop-types";
import { Dropdown } from "semantic-ui-react";

function Filters(props) {
  const { chart, onAddFilter, onClearFilter } = props;

  const [filterValues, setFilterValues] = useState({});

  const _changeValue = (conditionId, value) => {
    const newValues = filterValues;
    newValues[conditionId] = value;
    setFilterValues(newValues);
  };

  const _getDropdownOptions = (datasetId, condition) => {
    const { conditionsOptions } = chart;
    if (!conditionsOptions) return [];
    const datasetConditions = conditionsOptions.find((opt) => opt.dataset_id === datasetId);

    if (!datasetConditions || !datasetConditions.conditions) return [];
    const conditionOpt = datasetConditions.conditions.find((c) => c.field === condition.field);

    if (!conditionOpt) return [];

    return conditionOpt.values.map((v) => {
      return {
        key: v,
        value: v,
        text: v,
      };
    });
  };

  const _onOptionSelected = (value, condition) => {
    if (!value) onClearFilter(condition);
    else onAddFilter({ ...condition, value });

    _changeValue(condition.id, value);
  };

  return (
    <div>
      {chart && chart.Datasets.filter((d) => d.conditions && d.conditions.length).map((dataset) => {
        return dataset.conditions.filter((c) => c.exposed).map((condition) => {
          const filterOptions = _getDropdownOptions(dataset.id, condition);
          return (
            <Dropdown
              selection
              clearable
              placeholder={`${condition.field.replace("root[].", "")} ${condition.operator}`}
              options={filterOptions}
              onChange={(e, data) => _onOptionSelected(data.value, condition)}
              value={filterValues[condition.id] || ""}
            />
          );
        });
      })}
    </div>
  );
}

Filters.propTypes = {
  chart: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  onClearFilter: PropTypes.func.isRequired,
};

export default Filters;
