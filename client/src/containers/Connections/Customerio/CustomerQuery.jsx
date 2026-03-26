import React, { Fragment, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Chip, Checkbox, Separator,
  ProgressCircle, ListBox, Select, Label,
} from "@heroui/react";
import { isEqual } from "lodash";
import { LuCheck, LuCloud, LuFolder, LuUser, LuWrench, LuX } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

import { runHelperMethod } from "../../../slices/connection";
import determineType from "../../../modules/determineType";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import { selectTeam } from "../../../slices/team";

const customerOperations = [
  { text: "All conditions match", key: "and", value: "and" },
  { text: "At least one condition matches", key: "or", value: "or" },
];

const filterOperations = [
  { text: "in any of", value: "in", key: "in" },
  { text: "not in any of", value: "not", key: "not" }
];

const attributeOperations = [
  { text: "is equal to", key: "eq", value: "eq" },
  { text: "is not equal to", key: "neq", value: "not,eq" },
  { text: "exist", key: "exists", value: "exists" },
  { text: "does not exist", key: "nexist", value: "not,exists" },
];

function CustomerQuery(props) {
  const {
    conditions, onUpdateConditions, limit, onUpdateLimit, connectionId,
    populateAttributes, onChangeAttributes,
  } = props;

  const [segmentConfig, setSegmentConfig] = useState(null);
  const [attributeConfig, setAttributeConfig] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mainOperation, setMainOperation] = useState("and");

  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current && team?.id) {
      initRef.current = true;
      // get segments
      setLoading(true);
      dispatch(runHelperMethod({
        team_id: team?.id,
        connection_id: connectionId,
        methodName: "getAllSegments"
      }))
        .then((data) => {
          const segmentData = data.payload;
          const segmentOptions = segmentData.map((segment) => {
            return {
              text: segment.name,
              value: segment.id,
              key: segment.id,
              icon: segment.type === "dynamic" ? <LuCloud /> : <LuWrench />,
            };
          });

          setSegments(segmentOptions);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [team]);

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
        <Row>
          <ProgressCircle size="xl" aria-label="Loading segments" />
        </Row>
      </Container>
    );
  }

  return (
    <div className="w-full">
      {((conditions.and && conditions.and.length > 0)
        || (conditions.or && conditions.or.length > 0)
      ) && (
        <Row>
          <Select
            variant="secondary"
            placeholder="Select an operation"
            selectionMode="single"
            value={mainOperation}
            onChange={(value) => _onChangeOperation(value)}
            aria-label="Select an operation"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {customerOperations.map((operation) => (
                  <ListBox.Item key={operation.key} id={operation.key} textValue={operation.text}>
                    {operation.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Row>
      )}
      <div className="h-2" />

      <Row wrap="wrap" align="center" className={"gap-1"}>
        {conditions[mainOperation] && conditions[mainOperation].map((condition) => {
          return (
            <Fragment
              key={
                (condition.segment && condition.segment.id)
                || (condition.not && condition.not.segment && condition.not.segment.id)
              }
            >
              {/** SEGMENTS */}
              {condition.segment && (
                <Chip
                  variant={"bordered"}
                >
                  <LuFolder />
                  <span className="text-accent">
                    {`in ${_getSegmentName(condition.segment.id)}`}
                  </span>
                  <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.segment.id)} />
                </Chip>
              )}
              {condition.not && condition.not.segment && (
                <Chip
                  variant={"bordered"}
                >
                  <LuFolder />
                  <span className="text-accent">
                    {`not in  ${_getSegmentName(condition.not.segment.id)}`}
                  </span>
                  <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.not.segment.id)} />
                </Chip>
              )}
              {condition.or && (
                <Chip
                  variant={"bordered"}
                >
                  <LuFolder />
                  <span className="mr-1">{"in"}</span>
                  {condition.or.map((sub, index) => {
                    if (sub.segment && sub.segment.id) {
                      return (
                        <span key={sub.segment.id}>
                          <span className="text-accent">{`${_getSegmentName(sub.segment.id)} `}</span>
                          {index < condition.or.length - 1 && (
                            <span className="mr-1">or</span>
                          )}
                        </span>
                      );
                    }
                    return (<span />); // eslint-disable-line
                  })}
                  <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.or)} />
                </Chip>
              )}
              {condition.not && condition.not.or && (
                <Chip
                  variant={"bordered"}
                >
                  <LuFolder />
                  <span className="mr-1">{"not in"}</span>
                  {condition.not.or.map((sub, index) => {
                    if (sub.segment && sub.segment.id) {
                      return (
                        <span key={sub.segment.id}>
                          <span className="text-accent">{`${_getSegmentName(sub.segment.id)}`}</span>
                          {`${index < condition.not.or.length - 1 ? " or- " : ""}`}
                        </span>
                      );
                    }
                    return (<span />); // eslint-disable-line
                  })}
                  <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.not)} />
                </Chip>
              )}

              {/** ATTRIBUTES */}
              {condition.attribute && (
                <Chip
                  variant={"bordered"}
                >
                  <LuUser />
                  <span className="text-accent mr-1">
                    {`${condition.attribute.field}`}
                  </span>
                  {condition.attribute.operator === "eq" && (
                    <>
                      <span className="mr-1">is</span>
                    </>
                  )}
                  <span className="text-secondary mr-1">
                    {`${_getOperatorName(condition.attribute.operator)}`}
                  </span>
                  {condition.attribute.operator === "eq" && (
                    <>
                      <span className="text-accent">
                        {`to ${condition.attribute.value}`}
                      </span>
                    </>
                  )}
                  <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("attribute", condition.attribute.field)} />
                </Chip>
              )}
              {condition.not && condition.not.attribute && (
                <Chip
                  variant="secondary"
                >
                  <LuUser />
                  <span className="text-accent mr-1">
                    {`${condition.not.attribute.field}`}
                  </span>
                  {condition.not.attribute.operator === "eq" && (
                    <>
                      <span className="mr-1">is</span>
                    </>
                  )}
                  <span className="text-secondary mr-1">
                    {`${_getOperatorName(`not,${condition.not.attribute.operator}`)}`}
                  </span>
                  {condition.not.attribute.operator === "eq" && (
                    <>
                      <span className="text-accent">
                        {`to ${condition.not.attribute.value}`}
                      </span>
                    </>
                  )}
                  <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("attribute", condition.not)} />
                </Chip>
              )}
            </Fragment>
          );
        })}
      </Row>

      {conditions[mainOperation]?.length > 0 &&(
        <>
          <div className="h-4" />
          <Separator />
          <div className="h-2" />
        </>
      )}

      <div className="h-2" />
      {!segmentConfig && !attributeConfig && (
        <Row align="center">
          <Button
            size="sm"
            onPress={() => _onConfigureSegment()}
            variant="secondary" >
            <LuFolder />
            Add segment condition
          </Button>
          <div className="w-0.5" />
          <Button
            size="sm"
            onPress={() => _onConfigureAttribute()}
            variant="secondary" >
            <LuUser />
            Add attribute condition
          </Button>
        </Row>
      )}
      {segmentConfig && (
        <Row align={"center"}>
          <Select
            variant="secondary"
            placeholder="Select an operation"
            selectionMode="single"
            value={segmentConfig.operation || "in"}
            onChange={(value) => setSegmentConfig({ ...segmentConfig, operation: value })}
            aria-label="Select an operation"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {filterOperations.map((operation) => (
                  <ListBox.Item key={operation.value} id={operation.value} textValue={operation.text}>
                    {operation.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <div className="w-1" />
          <Select
            variant="secondary"
            placeholder="Select segments"
            selectionMode="multiple"
            value={segmentConfig.ids || []}
            onChange={(value) => {
              setSegmentConfig({
                ...segmentConfig,
                ids: value || [],
              });
            }}
            aria-label="Select segments"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox selectionMode="multiple">
                {segments.map((segment) => (
                  <ListBox.Item
                    key={segment.key}
                    id={segment.key}
                    textValue={segment.text}
                  >
                    {segment.icon}
                    <span>{segment.text}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <div className="w-2" />
          <Button
            isIconOnly
            onClick={_onAddSegmentCondition}
            size="sm" variant="ghost"
          >
            <LuCheck />
          </Button>
          <div className="w-1" />
          <Button
            isIconOnly variant="ghost"
            onClick={() => setSegmentConfig(null)}
            size="sm"
          >
            <LuX />
          </Button>
        </Row>
      )}
      {attributeConfig && (
        <Row align="center">
          <Input
            placeholder="Attribute name"
            value={attributeConfig.field}
            onChange={(e) => {
              setAttributeConfig({ ...attributeConfig, field: e.target.value });
            }}
            variant="secondary"
          />
          <div className="w-1" />
          <Select
            variant="secondary"
            placeholder="Select an operation"
            selectionMode="single"
            value={attributeConfig.operator || "eq"}
            onChange={(value) => setAttributeConfig({ ...attributeConfig, operator: value })}
            labelPlacement="outsite"
            aria-label="Select an operation"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {attributeOperations.map((operation) => (
                  <ListBox.Item key={operation.value} id={operation.value} textValue={operation.text}>
                    {operation.text}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {(attributeConfig.operator === "eq" || attributeConfig.operator === "not,eq") && (
            <>
              <div className="w-1" />
              <Input
                placeholder="Value"
                value={attributeConfig.value}
                onChange={(e) => {
                  setAttributeConfig({ ...attributeConfig, value: e.target.value });
                }}
                variant="secondary"
              />
            </>
          )}
          <div className="w-2" />
          <Button
            isIconOnly
            onPress={_onAddAttributeCondition}
            size="sm"
            variant="primary"
          >
            <LuCheck />
          </Button>
          <div className="w-1" />
          <Button
            isIconOnly
            onPress={() => setAttributeConfig(null)}
            size="sm"
            variant="danger-soft"
          >
            <LuX />
          </Button>
        </Row>
      )}

      <div className="h-4" />
      <Separator />
      <div className="h-4" />

      <Row>
        <Checkbox
          id="cio-customer-populate-attributes"
          isSelected={populateAttributes}
          onChange={onChangeAttributes}
        >
          <Checkbox.Control className="size-4 shrink-0">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content>
            <Label htmlFor="cio-customer-populate-attributes" className="text-sm">{"Get customers' attributes"}</Label>
          </Checkbox.Content>
        </Checkbox>
      </Row>
      <div className="h-2" />
      <Row>
        <Input
          label="Maximum number of results (0 = unlimited)"
          type="number"
          placeholder="Limit the number of records to return"
          value={limit}
          onChange={(e) => onUpdateLimit(e.target.value)}
          variant="secondary"
        />
      </Row>
    </div>
  );
}

CustomerQuery.propTypes = {
  onUpdateConditions: PropTypes.func.isRequired,
  conditions: PropTypes.object.isRequired,
  limit: PropTypes.string.isRequired,
  onUpdateLimit: PropTypes.func.isRequired,
  connectionId: PropTypes.number.isRequired,
  populateAttributes: PropTypes.bool.isRequired,
  onChangeAttributes: PropTypes.func.isRequired,
};

export default CustomerQuery;
