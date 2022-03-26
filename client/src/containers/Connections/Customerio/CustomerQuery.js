import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Checkbox, Container, Divider, Dropdown, Form, Icon, Input, Label, List, Loader, Popup
} from "semantic-ui-react";
import { isEqual } from "lodash";

import { runHelperMethod } from "../../../actions/connection";
import { primary, secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";

function CustomerQuery(props) {
  const {
    conditions, onUpdateConditions, limit, onUpdateLimit, projectId, connectionId,
    populateAttributes, onChangeAttributes,
  } = props;

  const [segmentConfig, setSegmentConfig] = useState(null);
  const [attributeConfig, setAttributeConfig] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mainOperation, setMainOperation] = useState("and");

  useEffect(() => {
    // get segments
    setLoading(true);
    runHelperMethod(projectId, connectionId, "getAllSegments")
      .then((segmentData) => {
        const segmentOptions = segmentData.map((segment) => {
          return {
            text: segment.name,
            value: segment.id,
            key: segment.id,
            icon: segment.type === "dynamic" ? "cloud" : "wrench",
          };
        });

        setSegments(segmentOptions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const _onAddSegmentCondition = () => {
    if (!segmentConfig.ids || segmentConfig.ids.length < 1) return;
    let condition;

    if (segmentConfig.ids.length > 1) {
      condition = { or: [] };
      if (segmentConfig.operation === "not") {
        condition = { not: { or: [] } };
      }
      segmentConfig.ids.forEach((segmentId) => {
        if (segmentConfig.operation === "not") {
          condition.not.or = [...condition.not.or, { segment: { id: segmentId } }];
        } else {
          condition.or = [...condition.or, { segment: { id: segmentId } }];
        }
      });
    } else if (segmentConfig.ids.length === 1) {
      if (segmentConfig.operation === "not") {
        condition = { not: { segment: { id: segmentConfig.ids[0] } } };
      } else {
        condition = { segment: { id: segmentConfig.ids[0] } };
      }
    }

    if (!conditions[mainOperation]) {
      onUpdateConditions({ [mainOperation]: [condition] });
      setSegmentConfig(null);
      return;
    }

    onUpdateConditions({ [mainOperation]: [...conditions[mainOperation], condition] });
    setSegmentConfig(null);
  };

  const _onAddAttributeCondition = () => {
    if (!attributeConfig.field) return;
    let condition;

    if (attributeConfig.operator.split(",")[0] === "not") {
      condition = {
        not: {
          attribute: {
            field: attributeConfig.field,
            value: attributeConfig.value,
            operator: attributeConfig.operator.split(",")[1],
          }
        }
      };
    } else {
      condition = { attribute: attributeConfig };
    }

    if (!conditions[mainOperation]) {
      onUpdateConditions({ [mainOperation]: [condition] });
      setAttributeConfig(null);
      return;
    }

    onUpdateConditions({ [mainOperation]: [...conditions[mainOperation], condition] });
    setAttributeConfig(null);
  };

  const _onRemoveCondition = (type, identifier) => {
    const newConditions = [];

    if (determineType(identifier) === "object" || determineType(identifier) === "array") {
      conditions[mainOperation].forEach((condition) => {
        if (!isEqual(condition, identifier)
          && !isEqual(condition.or, identifier)
          && !isEqual(condition.and, identifier)
          && !isEqual(condition.not, identifier)
        ) {
          newConditions.push(condition);
        }
      });
    } else if (type === "segment") {
      conditions[mainOperation].forEach((condition) => {
        if ((!condition.segment && !condition.not)
          || (condition.segment && condition.segment.id !== identifier)
          || (condition.not && !condition.not.segment)
          || (condition.not && condition.not.segment && condition.not.segment.id !== identifier)
        ) {
          newConditions.push(condition);
        }
      });
    } else if (type === "attribute") {
      conditions[mainOperation].forEach((condition) => {
        if ((!condition.attribute && !condition.not)
          || (condition.attribute && condition.attribute.field !== identifier)
          || (condition.not && !condition.not.atribute)
          || (condition.not
            && condition.not.attribute
            && condition.not.attribute.field !== identifier
          )
        ) {
          newConditions.push(condition);
        }
      });
    }

    onUpdateConditions({ [mainOperation]: newConditions });
  };

  const _onConfigureSegment = () => {
    setSegmentConfig({});
    setAttributeConfig(null);
  };

  const _onConfigureAttribute = () => {
    setAttributeConfig({ operator: "eq" });
    setSegmentConfig(null);
  };

  const _onChangeOperation = (operator) => {
    setMainOperation(operator);
    if (conditions.and || conditions.or) {
      const newConditions = { [operator]: conditions.and || conditions.or };
      onUpdateConditions(newConditions);
    }
  };

  const _getSegmentName = (id) => {
    let segmentName = id;
    segments.forEach((segment) => {
      if (`${segment.value}` === `${id}`) segmentName = segment.text;
    });

    return segmentName;
  };

  const _getOperatorName = (operator) => {
    switch (operator) {
      case "eq":
        return "equal";
      case "not,eq":
        return "not equal";
      case "exists":
        return "exists";
      case "not,exists":
        return "does not exist";
      default:
        break;
    }

    return "equals";
  };

  if (loading) {
    return (
      <Container>
        <Loader active={loading} />
      </Container>
    );
  }

  return (
    <div>
      {((conditions.and && conditions.and.length > 0)
        || (conditions.or && conditions.or.length > 0)
      ) && (
        <Form size="small">
          <Form.Group>
            <Form.Field width={8}>
              <Dropdown
                selection
                options={[
                  { text: "All conditions match", key: "and", value: "and" },
                  { text: "At least one condition matches", key: "or", value: "or" },
                ]}
                value={mainOperation}
                onChange={(e, data) => _onChangeOperation(data.value)}
              />
            </Form.Field>
          </Form.Group>
        </Form>
      )}

      {conditions[mainOperation] && (
        <List style={{ marginTop: 20 }}>
          {conditions[mainOperation].map((condition) => {
            return (
              <List.Item
                key={
                  (condition.segment && condition.segment.id)
                  || (condition.not && condition.not.segment && condition.not.segment.id)
                }
              >
                {/** SEGMENTS */}
                {condition.segment && (
                  <Label as="a">
                    <Icon name="folder" />
                    {"in "}
                    <span style={{ color: primary }}>
                      {`${_getSegmentName(condition.segment.id)}`}
                    </span>
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.segment.id)}
                    />
                  </Label>
                )}
                {condition.not && condition.not.segment && (
                  <Label as="a">
                    <Icon name="folder" />
                    {"not in "}
                    <span style={{ color: primary }}>
                      {`${_getSegmentName(condition.not.segment.id)}`}
                    </span>
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.not.segment.id)}
                    />
                  </Label>
                )}
                {condition.or && (
                  <Label as="a">
                    <Icon name="folder" />
                    {"in "}
                    {condition.or.map((sub, index) => {
                      if (sub.segment && sub.segment.id) {
                        return (
                          <span key={sub.segment.id}>
                            <span style={{ color: primary }}>{`${_getSegmentName(sub.segment.id)}`}</span>
                            {`${index < condition.or.length - 1 ? " or " : ""}`}
                          </span>
                        );
                      }
                      return (<span />);
                    })}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.or)}
                    />
                  </Label>
                )}
                {condition.not && condition.not.or && (
                  <Label as="a">
                    <Icon name="folder" />
                    {"not in "}
                    {condition.not.or.map((sub, index) => {
                      if (sub.segment && sub.segment.id) {
                        return (
                          <span key={sub.segment.id}>
                            <span style={{ color: primary }}>{`${_getSegmentName(sub.segment.id)}`}</span>
                            {`${index < condition.not.or.length - 1 ? " or " : ""}`}
                          </span>
                        );
                      }
                      return (<span />);
                    })}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.not)}
                    />
                  </Label>
                )}

                {/** ATTRIBUTES */}
                {condition.attribute && (
                  <Label as="a">
                    <Icon name="address card" />
                    <span style={{ color: primary }}>
                      {`${condition.attribute.field} `}
                    </span>
                    {condition.attribute.operator === "eq" ? "is " : ""}
                    <span style={{ color: secondary }}>
                      {`${_getOperatorName(condition.attribute.operator)}`}
                    </span>
                    {condition.attribute.operator === "eq" && (
                      <span style={{ color: primary }}>
                        {` to ${condition.attribute.value}`}
                      </span>
                    )}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("attribute", condition.attribute.field)}
                    />
                  </Label>
                )}
                {condition.not && condition.not.attribute && (
                  <Label as="a">
                    <Icon name="address card" />
                    <span style={{ color: primary }}>
                      {`${condition.not.attribute.field} `}
                    </span>
                    {condition.not.attribute.operator === "eq" ? "is " : ""}
                    <span style={{ color: secondary }}>
                      {`${_getOperatorName(`not,${condition.not.attribute.operator}`)}`}
                    </span>
                    {condition.not.attribute.operator === "eq" && (
                      <span style={{ color: primary }}>
                        {` to ${condition.not.attribute.value}`}
                      </span>
                    )}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("attribute", condition.not)}
                    />
                  </Label>
                )}
              </List.Item>
            );
          })}
        </List>
      )}

      {!segmentConfig && !attributeConfig && (
        <>
          <Button
            size="tiny"
            icon="folder"
            content="Add segment condition"
            onClick={() => _onConfigureSegment()}
            basic
            color="blue"
          />
          <Button
            size="tiny"
            icon="address card"
            content="Add attribute condition"
            onClick={() => _onConfigureAttribute()}
            basic
            color="blue"
          />
        </>
      )}
      {segmentConfig && (
        <Form size="tiny">
          <Form.Group>
            <Form.Field>
              <Dropdown
                selection
                placeholder="Select operation"
                options={[
                  { text: "in any of", value: "in", key: "in" },
                  { text: "not in any of", value: "not", key: "not" }
                ]}
                defaultValue={"in"}
                value={segmentConfig.operation}
                onChange={(e, data) => {
                  setSegmentConfig({ ...segmentConfig, operation: data.value });
                }}
              />
            </Form.Field>
            <Form.Field>
              <Dropdown
                selection
                multiple
                search
                placeholder="Segments"
                value={segmentConfig.ids}
                options={segments}
                onChange={(e, data) => {
                  setSegmentConfig({ ...segmentConfig, ids: data.value });
                }}
                style={{ minWidth: 300 }}
              />
            </Form.Field>
            <Form.Field>
              <Button
                icon="checkmark"
                onClick={_onAddSegmentCondition}
                primary
                size="tiny"
              />
              <Button
                icon="x"
                onClick={() => setSegmentConfig(null)}
                size="tiny"
              />
            </Form.Field>
          </Form.Group>
        </Form>
      )}
      {attributeConfig && (
        <Form size="tiny">
          <Form.Group>
            <Form.Field>
              <Input
                placeholder="Attribute name"
                value={attributeConfig.field}
                onChange={(e, data) => {
                  setAttributeConfig({ ...attributeConfig, field: data.value });
                }}
              />
            </Form.Field>
            <Form.Field>
              <Dropdown
                selection
                options={[
                  { text: "is equal to", key: "eq", value: "eq" },
                  { text: "is not equal to", key: "neq", value: "not,eq" },
                  { text: "exist", key: "exists", value: "exists" },
                  { text: "does not exist", key: "nexist", value: "not,exists" },
                ]}
                defaultValue={"eq"}
                value={attributeConfig.operator}
                onChange={(e, data) => {
                  setAttributeConfig({ ...attributeConfig, operator: data.value });
                }}
              />
            </Form.Field>
            {(attributeConfig.operator === "eq" || attributeConfig.operator === "not,eq") && (
              <Form.Field>
                <Input
                  placeholder="Value"
                  value={attributeConfig.value}
                  onChange={(e, data) => {
                    setAttributeConfig({ ...attributeConfig, value: data.value });
                  }}
                />
              </Form.Field>
            )}
            <Form.Field>
              <Button
                icon="checkmark"
                onClick={_onAddAttributeCondition}
                primary
                size="tiny"
              />
              <Button
                icon="x"
                onClick={() => setAttributeConfig(null)}
                size="tiny"
              />
            </Form.Field>
          </Form.Group>
        </Form>
      )}
      <Divider hidden />

      <Form>
        <Form.Field>
          <Checkbox
            label="Get customers' attributes"
            toggle
            checked={populateAttributes}
            onChange={onChangeAttributes}
          />
        </Form.Field>
        <Form.Field>
          <Popup
            content={"The total amount of items to get. Leave empty or 0 for unlimited."}
            trigger={(
              <label>
                {"Maximum number of results (0 = unlimited)"}
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
  limit: PropTypes.string.isRequired,
  onUpdateLimit: PropTypes.func.isRequired,
  projectId: PropTypes.number.isRequired,
  connectionId: PropTypes.number.isRequired,
  populateAttributes: PropTypes.bool.isRequired,
  onChangeAttributes: PropTypes.func.isRequired,
};

export default CustomerQuery;
