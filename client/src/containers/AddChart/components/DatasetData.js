import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Dropdown, Icon, Input, Button, Grid,
} from "semantic-ui-react";
import uuid from "uuid/v4";

const operators = [{
  key: "=",
  text: "= (is)",
  value: "=",
}, {
  key: "≠",
  text: "≠ (is not)",
  value: "≠",
}, {
  key: ">",
  text: "> (greater than)",
  value: ">",
}, {
  key: "≥",
  text: "≥ (greater or equal)",
  value: "≥",
}, {
  key: "<",
  text: "< (less than)",
  value: "<",
}, {
  key: "≤",
  text: "≤ (less or equal)",
  value: "≤",
}, {
  key: "∈",
  text: "∈ (contains)",
  value: "∈",
}, {
  key: "∉",
  text: "∉ (does not contain)",
  value: "∉",
}];

function DatasetData(props) {
  const { requestResult } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [selectedField, setSelectedField] = useState("");
  const [conditions, setConditions] = useState([{
    id: uuid(),
    field: "",
    operator: "=",
    value: "",
  }]);

  useEffect(() => {
    if (requestResult && requestResult.data && requestResult.data[0]) {
      const tempFieldOptions = [];
      Object.keys(requestResult.data[0]).forEach((field) => {
        tempFieldOptions.push({
          key: field,
          text: field,
          value: field,
        });
      });
      setFieldOptions(tempFieldOptions);
    }
  }, [requestResult]);

  const _selectField = (e, data) => {
    setSelectedField(data.value);
  };

  const _updateCondition = (id, data, type) => {
    const newConditions = conditions.map((condition) => {
      const newCondition = condition;
      if (condition.id === id) {
        newCondition[type] = data.value;
      }

      return newCondition;
    });

    setConditions(newConditions);
  };

  const _onAddCondition = () => {
    const newConditions = [...conditions, {
      id: uuid(),
      field: "",
      operator: "=",
      value: "",
    }];

    setConditions(newConditions);
  };

  const _onRemoveCondition = (id) => {
    let newConditions = [...conditions];
    newConditions = newConditions.filter((condition) => condition.id !== id);

    if (newConditions.length === 0) {
      newConditions.push({
        id: uuid(),
        field: "",
        operator: "=",
        value: "",
      });
    }

    setConditions(newConditions);
  };

  // if (!requestResult) {
  //   return (
  //     <div>
  //       <p><i> - Fetch some data first - </i></p>
  //     </div>
  //   );
  // }

  return (
    <Grid style={styles.mainGrid}>
      <Grid.Row columns={2}>
        <Grid.Column>
          <label>{"X Axis "}</label>
          <Dropdown
            icon={null}
            button
            className="small button"
            options={fieldOptions}
            search
            text={selectedField || "Select a field"}
            onChange={_selectField}
            scrolling
          />
        </Grid.Column>
        <Grid.Column>
          <label>{"Y Axis "}</label>
          <Dropdown
            icon={null}
            button
            className="small button"
            options={fieldOptions}
            search
            text={selectedField || "Select a field"}
            onChange={_selectField}
            scrolling
          />
        </Grid.Column>
      </Grid.Row>

      {conditions.map((condition, index) => {
        return (
          <Grid.Row key={condition.id} style={styles.conditionRow}>
            <Grid.Column>
              {index === 0 && (<label>{"where "}</label>)}
              {index > 0 && (<label>{"and "}</label>)}
              <Dropdown
                icon={null}
                className="small button"
                button
                options={fieldOptions}
                search
                text={condition.field || "field"}
                onChange={(e, data) => _updateCondition(condition.id, data, "field")}
              />
              <Dropdown
                icon={null}
                button
                className="small button"
                options={operators}
                search
                text={condition.operator || "="}
                onChange={(e, data) => _updateCondition(condition.id, data, "operator")}
              />
              <Input
                placeholder="Enter a value"
                size="small"
                onChange={(e, data) => _updateCondition(condition.id, data, "value")}
              />

              <Button
                icon
                basic
                style={styles.addConditionBtn}
                onClick={_onAddCondition}
              >
                <Icon name="plus" />
              </Button>
              <Button
                icon
                basic
                style={styles.addConditionBtn}
                onClick={() => _onRemoveCondition(condition.id)}
              >
                <Icon name="minus" />
              </Button>
            </Grid.Column>

          </Grid.Row>
        );
      })}
    </Grid>
  );
}

const styles = {
  addConditionBtn: {
    boxShadow: "none",
  },
  conditionRow: {
    paddingTop: 5,
    paddingBottom: 5,
  },
};

DatasetData.propTypes = {
  requestResult: PropTypes.object.isRequired,
};

export default DatasetData;
