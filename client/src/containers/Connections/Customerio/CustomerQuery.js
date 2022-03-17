import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Dropdown, Form, Icon, Input, Label, List, Popup
} from "semantic-ui-react";

function CustomerQuery(props) {
  const {
    conditions, onUpdateConditions, limit, onUpdateLimit
  } = props;

  const [segmentConfig, setSegmentConfig] = useState(null);

  const _onAddSegmentCondition = () => {
    let condition = { segment: { id: segmentConfig.id } };
    if (segmentConfig.operation === "not") {
      condition = { not: { segment: { id: segmentConfig.id } } };
    }

    if (!conditions.and) {
      onUpdateConditions({ and: [condition] });
      setSegmentConfig(null);
      return;
    }

    onUpdateConditions({ and: [...conditions.and, condition] });
    setSegmentConfig(null);
  };

  const _onRemoveCondition = (type, identifier) => {
    const newConditions = [];
    const selector = conditions.and ? "and" : "or";

    if (type === "segment") {
      conditions[selector].forEach((condition) => {
        if ((!condition.segment && !condition.not)
          || (condition.segment && condition.segment.id !== identifier)
          || (condition.not && !condition.not.segment)
          || (condition.not && condition.not.segment && condition.not.segment.id !== identifier)
        ) {
          newConditions.push(condition);
        }
      });
    }

    onUpdateConditions({ [selector]: newConditions });
  };

  const _onConfigureSegment = () => {
    setSegmentConfig({});
  };

  return (
    <div>
      <Button
        size="small"
        content="Add segment condition"
        onClick={() => _onConfigureSegment()}
      />
      <Button
        size="small"
        content="Add attribute condition"
      />

      {segmentConfig && (
        <Form style={{ marginTop: 20 }}>
          <Form.Group>
            <Form.Field>
              <Dropdown
                selection
                placeholder="Select operation"
                options={[
                  { text: "in", value: "in", key: "in" },
                  { text: "not in", value: "not", key: "not" }
                ]}
                defaultValue={"in"}
                value={segmentConfig.operation}
                onChange={(e, data) => {
                  setSegmentConfig({ ...segmentConfig, operation: data.value });
                }}
              />
            </Form.Field>
            <Form.Field>
              <Input
                placeholder="Segments"
                value={segmentConfig.id}
                onChange={(e, data) => {
                  setSegmentConfig({ ...segmentConfig, id: data.value });
                }}
              />
            </Form.Field>
            <Form.Field>
              <Button
                icon="checkmark"
                onClick={_onAddSegmentCondition}
                primary
              />
              <Button
                icon="x"
                onClick={() => setSegmentConfig(null)}
              />
            </Form.Field>
          </Form.Group>
        </Form>
      )}

      {conditions.and && (
        <List style={{ marginTop: 20 }}>
          {conditions.and.map((condition) => {
            return (
              <List.Item
                key={
                  (condition.segment && condition.segment.id)
                  || (condition.not && conditions.not.segment && condition.not.segment.id)
                }
              >
                {condition.segment && (
                  <Label as="a">
                    {`in ${condition.segment.id}`}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.segment.id)}
                    />
                  </Label>
                )}
                {condition.not && condition.not.segment && (
                  <Label as="a">
                    {`not in ${condition.not.segment.id}`}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.not.segment.id)}
                    />
                  </Label>
                )}
              </List.Item>
            );
          })}
        </List>
      )}

      <Form>
        <Form.Field>
          <Popup
            content={"The total amount of items to get. Leave empty or 0 for unlimited."}
            trigger={(
              <label>
                {"Maximum number of items (0 = unlimited)"}
                <Icon name="info circle" />
              </label>
            )}
            inverted
          />
          <Input
            type="number"
            placeholder="Limit the number of records to return"
            value={limit}
            onChange={(e, data) => onUpdateLimit(data.value)}
          />
        </Form.Field>
      </Form>
    </div>
  );
}

CustomerQuery.propTypes = {
  onUpdateConditions: PropTypes.func.isRequired,
  conditions: PropTypes.object.isRequired,
  limit: PropTypes.number.isRequired,
  onUpdateLimit: PropTypes.func.isRequired,
};

export default CustomerQuery;
