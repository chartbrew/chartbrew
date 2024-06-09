import { Button, Code } from "@nextui-org/react"
import React from "react"
import PropTypes from "prop-types"
import { LuChevronRight, LuPlus, LuX } from "react-icons/lu"

import Container from "../../../components/Container"

const flattenConditions = (condition, result = []) => {
  if (condition.type === "binary_expr") {
    if (condition.left.type === "binary_expr") {
      flattenConditions(condition.left, result);
    } else {
      result.push({
        operator: condition.operator,
        left: condition.left,
        right: condition.right
      });
    }

    if (condition.right.type === "binary_expr") {
      flattenConditions(condition.right, result);
    } else {
      // Check if the right condition is not a duplicate before adding
      const isDuplicate = result.some(r =>
        r.left === condition.left && r.right === condition.right && r.operator === condition.operator
      );
      if (!isDuplicate) {
        result.push({
          operator: condition.operator,
          left: condition.left.type === "binary_expr" ? condition.right.left : condition.left,
          right: condition.right
        });
      }
    }
  }
  return result;
};

const flattenFrom = (fromArray, result = []) => {
  let mainTable = null;

  fromArray.forEach((fromItem, index) => {
    const { db, table, as, join, on } = fromItem;

    if (index === 0) { // Assuming the first item is the main table
      mainTable = { db, table, as, type: "main" };
      result.push(mainTable);
    } else if (join && on) {
      const joinCondition = {
        type: "join",
        joinType: join,
        mainTable: mainTable.table,
        joinTable: table,
        on: {
          operator: on.operator,
          left: `${on.left.table}.${on.left.column}`,
          right: `${on.right.table}.${on.right.column}`
        }
      };
      result.push(joinCondition);
    }
  });

  return result;
};

function VisualSQL({ ast }) {
  return (
    <Container className={"flex flex-col gap-2"}>
      {ast?.from && flattenFrom(ast.from).map((fromItem, index) => (
        <div key={index} className="flex gap-1 items-center">
          {fromItem.type === "main" && <Code variant="flat">Get data from</Code>}
          {fromItem.type === "join" && <Code variant="flat">Join</Code>}
          {fromItem.table && (
            <Button
              size="sm"
              color="primary"
              variant="flat"
            >
              {fromItem.table}
            </Button>
          )}
          {fromItem.joinTable && (
            <Button
              size="sm"
              color="primary"
              variant="flat"
            >
              {`${fromItem.joinTable} on ${fromItem.on.left} ${fromItem.on.operator} ${fromItem.on.right}`}
            </Button>
          )}
        </div>
      ))}
      {ast?.columns && (
        <div className="flex gap-1 items-center">
          <Code variant="flat">Select columns</Code>
          {ast.columns.map((col) => (
            <Button
              key={col.expr.column}
              size="sm"
              color="primary"
              variant="flat"
            >
              {col.expr.column}
            </Button>
          ))}
          <Button
            isIconOnly
            size="sm"
            variant="light"
          >
            <LuPlus />
          </Button>
        </div>
      )}
      <div className="flex gap-1 items-center">
        <Code variant="flat">Filter data</Code>
        <Button
          isIconOnly
          size="sm"
          variant="light"
        >
          <LuPlus />
        </Button>
      </div>
      {ast?.where && flattenConditions(ast.where).map((condition, index) => (
        <div key={index} className="flex gap-1 items-center ml-4">
          <LuChevronRight />
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {condition.left.column}
          </Button>
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {condition.operator}
          </Button>
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {condition.right.value}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
          >
            <LuX />
          </Button>
        </div>
      ))}

      <div>
        Add additional steps
      </div>

      <div className="flex gap-1 items-center">
        <Button variant="flat" size="sm">sort</Button>
        <Button variant="flat" size="sm">group</Button>
        <Button variant="flat" size="sm">limit</Button>
      </div>
    </Container>
  )
}

VisualSQL.propTypes = {
  ast: PropTypes.object.isRequired
}

export default VisualSQL
