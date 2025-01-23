import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Input, Spacer, Chip, Checkbox, Divider,
  CircularProgress, Select, SelectItem,
} from "@heroui/react";
import { isEqual } from "lodash";
import { LuCheck, LuCloud, LuFolder, LuUser, LuWrench, LuX } from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useParams } from "react-router";

import { runHelperMethod } from "../../../slices/connection";
import determineType from "../../../modules/determineType";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

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
  const params = useParams();

  useEffect(() => {
    // get segments
    setLoading(true);
    dispatch(runHelperMethod({
      team_id: params.teamId,
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
        <Row>
          <CircularProgress size="xl" aria-label="Loading segments" />
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
            variant="bordered"
            placeholder="Select an operation"
            onSelectionChange={(keys) => _onChangeOperation(keys.currentKey)}
            selectedKeys={[mainOperation]}
            selectionMode="single"
            aria-label="Select an operation"
          >
            {customerOperations.map((operation) => (
              <SelectItem key={operation.key} textValue={operation.text}>
                {operation.text}
              </SelectItem>
            ))}
          </Select>
        </Row>
      )}
      <Spacer y={2} />

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
                  startContent={<LuFolder />}
                  endContent={(
                    <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.segment.id)} />
                  )}
                >
                  <span className="text-primary">
                    {`in ${_getSegmentName(condition.segment.id)}`}
                  </span>
                </Chip>
              )}
              {condition.not && condition.not.segment && (
                <Chip
                  variant={"bordered"}
                  startContent={<LuFolder />}
                  endContent={(
                    <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.not.segment.id)} />
                  )}
                >
                  <span className="text-primary">
                    {`not in  ${_getSegmentName(condition.not.segment.id)}`}
                  </span>
                </Chip>
              )}
              {condition.or && (
                <Chip
                  variant={"bordered"}
                  startContent={<LuFolder />}
                  endContent={(
                    <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.or)} />
                  )}
                >
                  <span className="mr-1">{"in"}</span>
                  {condition.or.map((sub, index) => {
                    if (sub.segment && sub.segment.id) {
                      return (
                        <span key={sub.segment.id}>
                          <span className="text-primary">{`${_getSegmentName(sub.segment.id)} `}</span>
                          {index < condition.or.length - 1 && (
                            <span className="mr-1">or</span>
                          )}
                        </span>
                      );
                    }
                    return (<span />); // eslint-disable-line
                  })}
                </Chip>
              )}
              {condition.not && condition.not.or && (
                <Chip
                  variant={"bordered"}
                  startContent={<LuFolder />}
                  endContent={(
                    <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("segment", condition.not)} />
                  )}
                >
                  <span className="mr-1">{"not in"}</span>
                  {condition.not.or.map((sub, index) => {
                    if (sub.segment && sub.segment.id) {
                      return (
                        <span key={sub.segment.id}>
                          <span className="text-primary">{`${_getSegmentName(sub.segment.id)}`}</span>
                          {`${index < condition.not.or.length - 1 ? " or- " : ""}`}
                        </span>
                      );
                    }
                    return (<span />); // eslint-disable-line
                  })}
                </Chip>
              )}

              {/** ATTRIBUTES */}
              {condition.attribute && (
                <Chip
                  variant={"bordered"}
                  startContent={<LuUser />}
                  endContent={(
                    <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("attribute", condition.attribute.field)} />
                  )}
                >
                  <span className="text-primary mr-1">
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
                      <span className="text-primary">
                        {`to ${condition.attribute.value}`}
                      </span>
                    </>
                  )}
                </Chip>
              )}
              {condition.not && condition.not.attribute && (
                <Chip
                  variant="bordered"
                  startContent={<LuUser />}
                  endContent={(
                    <LuX size={16} className="text-danger cursor-pointer" onClick={() => _onRemoveCondition("attribute", condition.not)} />
                  )}
                >
                  <span className="text-primary mr-1">
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
                      <span className="text-primary">
                        {`to ${condition.not.attribute.value}`}
                      </span>
                    </>
                  )}
                </Chip>
              )}
            </Fragment>
          );
        })}
      </Row>

      {conditions[mainOperation]?.length > 0 &&(
        <>
          <Spacer y={4} />
          <Divider />
          <Spacer y={2} />
        </>
      )}

      <Spacer y={2} />
      {!segmentConfig && !attributeConfig && (
        <Row align="center">
          <Button
            size="sm"
            startContent={<LuFolder />}
            onClick={() => _onConfigureSegment()}
            variant="bordered"
            color="primary"
          >
            Add segment condition
          </Button>
          <Spacer x={0.5} />
          <Button
            size="sm"
            startContent={<LuUser />}
            onClick={() => _onConfigureAttribute()}
            variant="bordered"
            color="primary"
          >
            Add attribute condition
          </Button>
        </Row>
      )}
      {segmentConfig && (
        <Row align={"center"}>
          <Select
            variant="bordered"
            placeholder="Select an operation"
            onSelectionChange={(keys) => setSegmentConfig({ ...segmentConfig, operation: keys.currentKey })}
            selectedKeys={[segmentConfig.operation || "in"]}
            selectionMode="single"
            defaultSelectedKeys={["in"]}
            aria-label="Select an operation"
          >
            {filterOperations.map((operation) => (
              <SelectItem key={operation.value} textValue={operation.text}>
                {operation.text}
              </SelectItem>
            ))}
          </Select>
          <Spacer x={1} />
          <Select
            variant="bordered"
            placeholder="Select segments"
            onSelectionChange={(keys) => {
              setSegmentConfig({
                ...segmentConfig,
                ids: [...keys],
              });
            }}
            selectedKeys={segmentConfig.ids || []}
            selectionMode="multiple"
            renderValue={(items) => (
              <div className="flex flex-row flex-wrap gap-2">
                <Chip size="sm" variant="flat">
                  {items.length === 1 ? `${items[0].textValue}` : `${items.length} selected`}
                </Chip>
              </div>
            )}
            aria-label="Select segments"
          >
            {segments.map((segment) => (
              <SelectItem
                key={segment.key}
                startContent={segment.icon}
                textValue={segment.text}
              >
                {segment.text}
              </SelectItem>
            ))}
          </Select>
          <Spacer x={2} />
          <Button
            isIconOnly
            onClick={_onAddSegmentCondition}
            size="sm"
            color="success"
            variant="light"
          >
            <LuCheck />
          </Button>
          <Spacer x={1} />
          <Button
            isIconOnly
            color="danger"
            variant="light"
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
            variant="bordered"
          />
          <Spacer x={1} />
          <Select
            variant="bordered"
            placeholder="Select an operation"
            onSelectionChange={(keys) => setAttributeConfig({ ...attributeConfig, operator: keys.currentKey })}
            selectedKeys={[attributeConfig.operator]}
            selectionMode="single"
            renderValue={(
              <Text>
                {(attributeConfig.operator
                  && attributeOperations.find((op) => op.value === attributeConfig.operator)?.text)
                || "Select operation"}
              </Text>
            )}
            defaultSelectedKeys={["eq"]}
            labelPlacement="outsite"
            aria-label="Select an operation"
          >
            {attributeOperations.map((operation) => (
              <SelectItem key={operation.value} textValue={operation.text}>
                {operation.text}
              </SelectItem>
            ))}
          </Select>
          {(attributeConfig.operator === "eq" || attributeConfig.operator === "not,eq") && (
            <>
              <Spacer x={1} />
              <Input
                placeholder="Value"
                value={attributeConfig.value}
                onChange={(e) => {
                  setAttributeConfig({ ...attributeConfig, value: e.target.value });
                }}
                variant="bordered"
              />
            </>
          )}
          <Spacer x={2} />
          <Button
            isIconOnly
            onClick={_onAddAttributeCondition}
            size="sm"
            variant="light"
            color="success"
          >
            <LuCheck />
          </Button>
          <Spacer x={1} />
          <Button
            isIconOnly
            onClick={() => setAttributeConfig(null)}
            size="sm"
            color="danger"
            variant="light" 
          >
            <LuX />
          </Button>
        </Row>
      )}

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <Row>
        <Checkbox
          isSelected={populateAttributes}
          onChange={onChangeAttributes}
          size="sm"
        >
          {"Get customers' attributes"}
        </Checkbox>
      </Row>
      <Spacer y={2} />
      <Row>
        <Input
          label="Maximum number of results (0 = unlimited)"
          type="number"
          placeholder="Limit the number of records to return"
          value={limit}
          onChange={(e) => onUpdateLimit(e.target.value)}
          variant="bordered"
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
