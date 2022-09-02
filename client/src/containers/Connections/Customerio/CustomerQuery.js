import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Container, Dropdown, Input, Loading, Row, Spacer, Badge,
  Link, Checkbox, Divider,
} from "@nextui-org/react";
import { isEqual } from "lodash";

import {
  ChevronDown, CloseSquare, Folder, TickSquare, User
} from "react-iconly";
import { FaCloud, FaWrench } from "react-icons/fa";
import { runHelperMethod } from "../../../actions/connection";
import { primary, secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";

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
            icon: segment.type === "dynamic" ? <FaCloud size={18} /> : <FaWrench size={18} />,
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
          <Loading type="spinner" color="primary" size="xl" />
        </Row>
      </Container>
    );
  }

  return (
    <Container css={{ pr: 0, pl: 0 }}>
      {((conditions.and && conditions.and.length > 0)
        || (conditions.or && conditions.or.length > 0)
      ) && (
        <Row>
          <Dropdown>
            <Dropdown.Trigger>
              <Input
                bordered
                placeholder="Select an operation"
                contentRight={<ChevronDown />}
                value={
                  (mainOperation
                  && customerOperations
                    .find((operation) => operation.value === mainOperation)?.text)
                  || "Select an operation"
                }
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => _onChangeOperation(key)}
              selectedKeys={[mainOperation]}
              selectionMode="single"
              css={{ minWidth: "max-content" }}
            >
              {customerOperations.map((operation) => (
                <Dropdown.Item key={operation.key}>{operation.text}</Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Row>
      )}
      <Spacer y={1} />

      <Row wrap="wrap" align="center">
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
                <Badge as="a" variant={"bordered"}>
                  <Folder size="small" />
                  <Spacer x={0.1} />
                  <span style={{ color: primary }}>
                    {`in ${_getSegmentName(condition.segment.id)}`}
                  </span>
                  <Spacer x={0.1} />
                  <Link onClick={() => _onRemoveCondition("segment", condition.segment.id)} color="secondary">
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              )}
              {condition.not && condition.not.segment && (
                <Badge as="a" variant={"bordered"}>
                  <Folder size="small" />
                  <Spacer x={0.1} />
                  <span style={{ color: primary }}>
                    {`not in  ${_getSegmentName(condition.not.segment.id)}`}
                  </span>
                  <Spacer x={0.1} />
                  <Link onClick={() => _onRemoveCondition("segment", condition.not.segment.id)} color="secondary">
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              )}
              {condition.or && (
                <Badge as="a" variant={"bordered"}>
                  <Folder size="small" />
                  <Spacer x={0.1} />
                  <span>{"in"}</span>
                  <Spacer x={0.1} />
                  {condition.or.map((sub, index) => {
                    if (sub.segment && sub.segment.id) {
                      return (
                        <span key={sub.segment.id}>
                          <span style={{ color: primary }}>{`${_getSegmentName(sub.segment.id)} `}</span>
                          {index < condition.or.length - 1 && (
                            <span style={{ marginRight: 3 }}>or</span>
                          )}
                        </span>
                      );
                    }
                    return (<span />);
                  })}
                  <Spacer x={0.1} />
                  <Link onClick={() => _onRemoveCondition("segment", condition.or)} color="secondary">
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              )}
              {condition.not && condition.not.or && (
                <Badge as="a" variant={"bordered"}>
                  <Folder size="small" />
                  <Spacer x={0.1} />
                  <span>{"not in"}</span>
                  <Spacer x={0.1} />
                  {condition.not.or.map((sub, index) => {
                    if (sub.segment && sub.segment.id) {
                      return (
                        <span key={sub.segment.id}>
                          <span style={{ color: primary }}>{`${_getSegmentName(sub.segment.id)}`}</span>
                          {`${index < condition.not.or.length - 1 ? " or- " : ""}`}
                        </span>
                      );
                    }
                    return (<span />);
                  })}
                  <Spacer x={0.1} />
                  <Link onClick={() => _onRemoveCondition("segment", condition.not)} color="secondary">
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              )}

              {/** ATTRIBUTES */}
              {condition.attribute && (
                <Badge as="a" variant={"bordered"}>
                  <User size="small" />
                  <Spacer x={0.1} />
                  <span style={{ color: primary }}>
                    {`${condition.attribute.field}`}
                  </span>
                  <Spacer x={0.1} />
                  {condition.attribute.operator === "eq" && (
                    <>
                      <Spacer x={0.1} />
                      <span>is</span>
                      <Spacer x={0.1} />
                    </>
                  )}
                  <span style={{ color: secondary }}>
                    {`${_getOperatorName(condition.attribute.operator)}`}
                  </span>
                  <Spacer x={0.1} />
                  {condition.attribute.operator === "eq" && (
                    <>
                      <Spacer x={0.1} />
                      <span style={{ color: primary }}>
                        {`to ${condition.attribute.value}`}
                      </span>
                      <Spacer x={0.1} />
                    </>
                  )}
                  <Link onClick={() => _onRemoveCondition("attribute", condition.attribute.field)} color="secondary">
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              )}
              {condition.not && condition.not.attribute && (
                <Badge as="a" isSquared>
                  <User size="small" />
                  <Spacer x={0.1} />
                  <span style={{ color: primary }}>
                    {`${condition.not.attribute.field}`}
                  </span>
                  <Spacer x={0.1} />
                  {condition.not.attribute.operator === "eq" && (
                    <>
                      <Spacer x={0.1} />
                      <span>is</span>
                      <Spacer x={0.1} />
                    </>
                  )}
                  <span style={{ color: secondary }}>
                    {`${_getOperatorName(`not,${condition.not.attribute.operator}`)}`}
                  </span>
                  <Spacer x={0.1} />
                  {condition.not.attribute.operator === "eq" && (
                    <>
                      <Spacer x={0.1} />
                      <span style={{ color: primary }}>
                        {`to ${condition.not.attribute.value}`}
                      </span>
                      <Spacer x={0.1} />
                    </>
                  )}
                  <Link onClick={() => _onRemoveCondition("attribute", condition.not)} color="secondary">
                    <CloseSquare size="small" />
                  </Link>
                </Badge>
              )}
              <Spacer x={0.2} />
            </Fragment>
          );
        })}
      </Row>

      <Spacer y={1} />
      {!segmentConfig && !attributeConfig && (
        <Row align="center">
          <Button
            size="sm"
            icon={<Folder />}
            onClick={() => _onConfigureSegment()}
            bordered
            auto
          >
            Add segment condition
          </Button>
          <Spacer x={0.2} />
          <Button
            size="sm"
            icon={<User />}
            onClick={() => _onConfigureAttribute()}
            bordered
            auto
          >
            Add attribute condition
          </Button>
        </Row>
      )}
      {segmentConfig && (
        <Row>
          <Dropdown>
            <Dropdown.Trigger>
              <Input
                size="sm"
                bordered
                contentRight={<ChevronDown />}
                animated={false}
                value={
                  (segmentConfig.operation
                  && filterOperations.find((op) => op.value === segmentConfig.operation)?.text)
                  || "Select operation"
                }
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => setSegmentConfig({ ...segmentConfig, operation: key })}
              selectedKeys={[segmentConfig.operation]}
              selectionMode="single"
              defaultSelectedKeys={["in"]}
            >
              {filterOperations.map((operation) => (
                <Dropdown.Item key={operation.value}>
                  {operation.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Spacer x={0.2} />
          <Dropdown>
            <Dropdown.Button size="sm" flat>
              Segments
              <Spacer x={0.2} />
              {segmentConfig.ids && segmentConfig.ids.length > 0 && (
                <Badge variant="default" color="secondary" size="sm">
                  {segmentConfig.ids.length}
                </Badge>
              )}
              {(!segmentConfig.ids || (segmentConfig.ids && segmentConfig.ids.length === 0)) && (
                <Badge color="secondary" size="sm" variant="flat">
                  None
                </Badge>
              )}
            </Dropdown.Button>
            <Dropdown.Menu
              selectionMode="multiple"
              selectedKeys={segmentConfig.ids || []}
              onAction={(key) => {
                // add to the list if not already in it
                if (!segmentConfig.ids || !segmentConfig.ids.includes(key)) {
                  setSegmentConfig({
                    ...segmentConfig,
                    ids: !segmentConfig.ids ? [key] : [...segmentConfig.ids, key]
                  });
                } else {
                  setSegmentConfig({
                    ...segmentConfig, ids: segmentConfig.ids.filter((t) => t !== key)
                  });
                }
              }}
              css={{ minWidth: "max-content" }}
            >
              {segments.map((segment) => (
                <Dropdown.Item
                  key={segment.value}
                  icon={segment.icon}
                >
                  {segment.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Spacer x={0.5} />
          <Button
            icon={<TickSquare />}
            onClick={_onAddSegmentCondition}
            size="sm"
            color="success"
            css={{ minWidth: "fit-content" }}
          />
          <Spacer x={0.2} />
          <Button
            icon={<CloseSquare />}
            color="error"
            flat
            onClick={() => setSegmentConfig(null)}
            size="sm"
            css={{ minWidth: "fit-content" }}
          />
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
            bordered
            size="sm"
          />
          <Spacer x={0.5} />
          <Dropdown>
            <Dropdown.Trigger>
              <Input
                size="sm"
                bordered
                contentRight={<ChevronDown />}
                animated={false}
                value={
                  (attributeConfig.operator
                  && attributeOperations.find((op) => op.value === attributeConfig.operator)?.text)
                  || "Select operation"
                }
              />
            </Dropdown.Trigger>
            <Dropdown.Menu
              onAction={(key) => setAttributeConfig({ ...attributeConfig, operator: key })}
              selectedKeys={[attributeConfig.operator]}
              selectionMode="single"
              defaultSelectedKeys={["eq"]}
            >
              {attributeOperations.map((operation) => (
                <Dropdown.Item key={operation.value}>
                  {operation.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          {(attributeConfig.operator === "eq" || attributeConfig.operator === "not,eq") && (
            <>
              <Spacer x={0.5} />
              <Input
                placeholder="Value"
                value={attributeConfig.value}
                onChange={(e) => {
                  setAttributeConfig({ ...attributeConfig, value: e.target.value });
                }}
                size="sm"
                bordered
              />
            </>
          )}
          <Spacer x={0.5} />
          <Button
            icon={<TickSquare />}
            onClick={_onAddAttributeCondition}
            size="sm"
            color="success"
            css={{ minWidth: "fit-content" }}
          />
          <Spacer x={0.2} />
          <Button
            icon={<CloseSquare />}
            onClick={() => setAttributeConfig(null)}
            size="sm"
            color="error"
            flat
            css={{ minWidth: "fit-content" }}
          />
        </Row>
      )}

      <Spacer y={1} />
      <Divider />
      <Spacer y={1} />

      <Row>
        <Checkbox
          label="Get customers' attributes"
          isSelected={populateAttributes}
          onChange={onChangeAttributes}
          size="sm"
        />
      </Row>
      <Spacer y={1} />
      <Row>
        <Input
          label="Maximum number of results (0 = unlimited)"
          type="number"
          placeholder="Limit the number of records to return"
          value={limit}
          onChange={(e) => onUpdateLimit(e.target.value)}
          bordered
        />
      </Row>
    </Container>
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
