import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Dropdown, Form, Icon, Input, Label, List, Loader, Popup
} from "semantic-ui-react";
import { isEqual } from "lodash";

import { runHelperMethod } from "../../../actions/connection";
import { primary } from "../../../config/colors";
import determineType from "../../../modules/determineType";

function CustomerQuery(props) {
  const {
    conditions, onUpdateConditions, limit, onUpdateLimit, projectId, connectionId,
  } = props;

  const [segmentConfig, setSegmentConfig] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);

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

    if (determineType(identifier) === "object" || determineType(identifier) === "array") {
      conditions[selector].forEach((condition) => {
        if (!isEqual(condition, identifier)
          && !isEqual(condition.or, identifier)
          && !isEqual(condition.and, identifier)
          && !isEqual(condition.not, identifier)
        ) {
          newConditions.push(condition);
        }
      });
    } else if (type === "segment") {
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

  const _getSegmentName = (id) => {
    let segmentName = id;
    segments.forEach((segment) => {
      if (`${segment.value}` === `${id}`) segmentName = segment.text;
    });

    return segmentName;
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
                  || (condition.not && condition.not.segment && condition.not.segment.id)
                }
              >
                {condition.segment && (
                  <Label as="a">
                    {`in ${_getSegmentName(condition.segment.id)}`}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.segment.id)}
                    />
                  </Label>
                )}
                {condition.not && condition.not.segment && (
                  <Label as="a">
                    {`not in ${_getSegmentName(condition.not.segment.id)}`}
                    <Icon
                      name="delete"
                      color="red"
                      onClick={() => _onRemoveCondition("segment", condition.not.segment.id)}
                    />
                  </Label>
                )}
                {condition.or && (
                  <Label as="a">
                    {"in "}
                    {condition.or.map((sub, index) => {
                      if (sub.segment && sub.segment.id) {
                        return (
                          <span key={sub.segment.id}>
                            <span style={{ color: primary }}>{`${_getSegmentName(sub.segment.id)}`}</span>
                            <small>{`${index < condition.or.length - 1 ? " or " : ""}`}</small>
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
                    {"not in "}
                    {condition.not.or.map((sub, index) => {
                      if (sub.segment && sub.segment.id) {
                        return (
                          <span key={sub.segment.id}>
                            <span style={{ color: primary }}>{`${_getSegmentName(sub.segment.id)}`}</span>
                            <small>{`${index < condition.not.or.length - 1 ? " or " : ""}`}</small>
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
  projectId: PropTypes.number.isRequired,
  connectionId: PropTypes.number.isRequired,
};

export default CustomerQuery;
