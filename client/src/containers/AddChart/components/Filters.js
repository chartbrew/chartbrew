import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Message, Form, Button, Icon, List, Input, Header, Divider, Dropdown, Label,
} from "semantic-ui-react";
import uuid from "uuid/v4";
import _ from "lodash";

const initPatterns = [{
  id: uuid(),
  value: "",
}];

function Filters(props) {
  const { patterns, labels, onSave } = props;

  const [newPatterns, setNewPatterns] = useState(initPatterns);
  const [filteredLabels, setFilteredLabels] = useState([]);

  useEffect(() => {
    if (patterns && patterns.length > 0) {
      // introduce a delay to make sure the newPatterns init doesn't overwrite
      setTimeout(() => {
        setNewPatterns(patterns);
      }, 100);
    }

    setFilteredLabels(labels);
  }, [patterns, labels]);

  useEffect(() => {
    if (newPatterns.length === 1 && newPatterns[0].value === "") {
      setNewPatterns(initPatterns);
      setFilteredLabels(labels);
      return;
    }

    const newLabels = [];
    newPatterns.map((pattern) => {
      if (_.includes(labels, pattern.value)) {
        newLabels.push(pattern.value);
      }
      return pattern;
    });

    setFilteredLabels(newLabels);
  }, [newPatterns]);

  const _onAddPattern = () => {
    if ((newPatterns.length === 0 || newPatterns[newPatterns.length - 1].value !== "")) {
      setNewPatterns([...newPatterns, { id: uuid(), value: "" }]);
    }
  };

  const _onRemovePattern = (id) => {
    if (newPatterns && newPatterns.length === 1) {
      _onChangePattern(id, "");
      return;
    }

    const tempPatterns = [...newPatterns];
    let foundIndex;
    for (let i = 0; i < tempPatterns.length; i++) {
      if (tempPatterns[i].id === id) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex) {
      tempPatterns.splice(foundIndex, 1);
      setNewPatterns(tempPatterns);
    }
  };

  const _onChangePattern = (id, value) => {
    const tempPatterns = [...newPatterns];
    for (let i = 0; i < tempPatterns.length; i++) {
      if (tempPatterns[i].id === id) {
        tempPatterns[i].value = value;
        break;
      }
    }

    setNewPatterns(tempPatterns);
  };

  const _onSave = () => {
    onSave(newPatterns);
  };

  return (
    <div>
      <Header size="small">Include if the value:</Header>
      <Form>
        {newPatterns && newPatterns.map((pattern) => {
          return (
            <Form.Group key={pattern.id}>
              <Form.Field width={3}>
                <Dropdown
                  disabled
                  options={[{ text: "Matches", value: "match" }]}
                  selection
                  value="match"
                />
              </Form.Field>

              <Form.Field width={10}>
                <Input
                  placeholder="Enter a value"
                  value={pattern.value || ""}
                  onChange={(e, data) => _onChangePattern(pattern.id, data.value)}
                />
              </Form.Field>

              <Form.Field width={3}>
                <Button
                  negative
                  icon
                  onClick={() => _onRemovePattern(pattern.id)}
                >
                  <Icon name="x" />
                </Button>
              </Form.Field>
            </Form.Group>
          );
        })}
      </Form>
      {(newPatterns.length === 0 || newPatterns[newPatterns.length - 1] !== "")
        && (
        <List verticalAlign="middle">
          <List.Item as="a" onClick={_onAddPattern}>
            <Icon name="plus" />
            <List.Content>
              <List.Header>
                Add a new value
              </List.Header>
            </List.Content>
          </List.Item>
        </List>
        )}

      <Header size="small">The chart will show:</Header>
      {filteredLabels && filteredLabels.length > 0 && (
        <Label.Group>
          {filteredLabels.map((label) => {
            return (
              <Label key={label} color="blue" basic>{label}</Label>
            );
          })}
        </Label.Group>
      )}
      {filteredLabels && filteredLabels.length === 0 && (
        <p><i>No values found</i></p>
      )}

      <Button
        primary
        icon
        labelPosition="right"
        onClick={_onSave}
        style={{ marginTop: 10 }}
      >
        <Icon name="checkmark" />
        Save
      </Button>
      <Divider />
      <Message info>
        <p>New filters coming soon</p>
      </Message>
    </div>
  );
}

Filters.defaultProps = {
  labels: [],
};

Filters.propTypes = {
  patterns: PropTypes.array.isRequired,
  labels: PropTypes.array,
  onSave: PropTypes.func.isRequired,
};

export default Filters;
