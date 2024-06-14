import { Button, Chip, Code, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger, Select, SelectItem } from "@nextui-org/react"
import React, { useEffect, useState } from "react"
import PropTypes from "prop-types"
import { LuChevronRight, LuPlus, LuX } from "react-icons/lu"
import { Parser } from "node-sql-parser";

import Container from "../../../components/Container"

const parser = new Parser();

const operations = [
  {
    name: "equals",
    operator: "=",
    types: ["TINYINT", "SMALLINT", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "BOOLEAN", "CHAR", "VARCHAR", "TEXT", "DATE", "TIME", "DATETIME", "TIMESTAMP"]
  },
  {
    name: "not equals",
    operator: "!=",
    types: ["TINYINT", "SMALLINT", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "BOOLEAN", "CHAR", "VARCHAR", "TEXT", "DATE", "TIME", "DATETIME", "TIMESTAMP"]
  },
  {
    name: "greater than",
    operator: ">",
    types: ["TINYINT", "SMALLINT", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "DATE", "TIME", "DATETIME", "TIMESTAMP"]
  },
  {
    name: "less than",
    operator: "<",
    types: ["TINYINT", "SMALLINT", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "DATE", "TIME", "DATETIME", "TIMESTAMP"]
  },
  {
    name: "greater than or equal to",
    operator: ">=",
    types: ["TINYINT", "SMALLINT", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "DATE", "TIME", "DATETIME", "TIMESTAMP"]
  },
  {
    name: "less than or equal to",
    operator: "<=",
    types: ["TINYINT", "SMALLINT", "INT", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "DATE", "TIME", "DATETIME", "TIMESTAMP"]
  },
  {
    name: "contains",
    operator: "LIKE",
    types: ["CHAR", "VARCHAR", "TEXT"]
  },
  {
    name: "not contains",
    operator: "NOT LIKE",
    types: ["CHAR", "VARCHAR", "TEXT"]
  }
];

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
      const leftTable = on.left.table?.value || on.left.table;
      const rightTable = on.right.table?.value || on.right.table;

      const joinCondition = {
        type: "join",
        joinType: join,
        mainTable: mainTable.table,
        mainTableAs: mainTable.as,
        joinTable: table,
        joinTableAs: as,
        on: {
          operator: on.operator,
          left: `${leftTable}.${on.left.column}`,
          right: `${rightTable}.${on.right.column}`
        }
      };
      result.push(joinCondition);
    }
  });

  return result;
};

function VisualSQL({ schema, query, updateQuery }) {
  const [ast, setAst] = useState(null);
  const [viewJoin, setViewJoin] = useState(false);
  const [viewAddColumn, setViewAddColumn] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);

  // useEffect(() => {
  //   console.log(schema)
  // }, [schema]);

  useEffect(() => {
    const newAst = parser.astify(query);
    setAst(newAst);
  }, [query]);

  const _onChangeMainTable = (table) => {
    const newFrom = ast.from.map((fromItem) => {
      if (!fromItem.on) {
        fromItem.table = table;
      }
      return fromItem;
    });

    const newAst = { ...ast, from: newFrom };
    setAst(newAst);
    updateQuery(parser.sqlify(newAst));
  };

  const _onChangeJoin = () => {
    const newFrom = {
      as: viewJoin.joinTableAs || viewJoin.joinTable,
      db: viewJoin.db,
      join: viewJoin.joinType,
      table: viewJoin.joinTable,
      on: {
        operator: viewJoin.on.operator,
        left: {
          table: viewJoin.joinTableAs || viewJoin.joinTable,
          column: _getColumnName(viewJoin.on.left),
          type: "column_ref"
        },
        right: {
          table: viewJoin.mainTableAs || viewJoin.table,
          column: _getColumnName(viewJoin.on.right),
          type: "column_ref"
        },
        type: "binary_expr"
      }
    };

    let newAstFroms;
    if (!viewJoin.index) {
      newAstFroms = [...ast.from, newFrom];
    } else {
      newAstFroms = ast.from.map((fromItem, index) => {
        if (index === viewJoin.index) {
          return newFrom;
        }

        return fromItem;
      });
    }

    const newAst = { ...ast, from: newAstFroms };
    setAst(newAst);
    updateQuery(parser.sqlify(newAst));

    setViewJoin(false);
  };

  const _onAddJoin = () => {
    const newJoin = {
      joinTableAs: "",
      joinTable: "",
      joinType: "INNER JOIN",
      mainTable: "",
      mainTableAs: "",
      db: null,
      on: {
        operator: "=",
        left: "",
        right: "",
      }
    };

    setViewJoin(newJoin);
  };

  const _getColumnName = (column, table) => {
    if (!column || column === null) return "";
    if (table) {
      const newColumn = column.lastIndexOf(".") === -1 ? column : column.substring(column.lastIndexOf(".") + 1);
      return `${table}.${newColumn}`;
    }
    if (column.indexOf(".") === -1) return column;

    return column.substring(column.indexOf(".") + 1);
  };

  const _getJoinColumns = (withTable) => {
    const flatFrom = flattenFrom(ast.from);
    let joinColumns = [];
    const processedTables = [];
    flatFrom.forEach((fromItem) => {
      const joinTable = fromItem.joinTable || fromItem.table;
      if (joinTable && joinTable !== withTable && !processedTables.includes(joinTable)) {
        processedTables.push(joinTable);
        joinColumns = joinColumns
          .concat(Object.keys(schema.description[joinTable])
          .map((column) => ({
            table: joinTable,
            column
          })));
      }
    });

    return joinColumns;
  };

  const _onSelectJoinTable = (join) => {
    const table = join.split(".")[0];
    const column = join.split(".")[1];

    let rightAlias = viewJoin?.mainTableAs;
    // get the right alias for the main table
    if (!viewJoin?.mainTableAs) {
      const mainTable = ast.from.find(item => item.table === table);
      if (mainTable?.as) {
        rightAlias = mainTable.as;
      }
    }

    const newViewJoin = {
      ...viewJoin,
      mainTable: table,
      mainTableAs: rightAlias,
      on: { ...viewJoin.on, right: `${rightAlias || table}.${column}` }
    };

    setViewJoin(newViewJoin);
  };

  const _onRemoveJoin = (index) => {
    const newAst = { ...ast, from: ast.from.filter((_, i) => i !== index) };
    setAst(newAst);
    updateQuery(parser.sqlify(newAst));
  };

  const _onRemoveColumn = (column) => {
    const newAst = { ...ast, columns: ast.columns.filter((col) => col.expr.column !== column) };
    setAst(newAst);
    updateQuery(parser.sqlify(newAst));
  };

  const _onAddColumn = () => {
    const newColumns = selectedColumns.values().map((selectedColumn) => {
      const table = selectedColumn.split(".")[0];
      const column = selectedColumn.split(".")[1];

      return {
        expr: {
          column,
          type: "column_ref",
          table: { value: table, type: "backticks_quote_string" }
        },
        as: null
      };
    });

    const newAst = {
      ...ast,
      columns: [
        ...ast.columns,
        ...newColumns
      ]
    };

    setAst(newAst);
    updateQuery(parser.sqlify(newAst));
    setViewAddColumn(false);
    setSelectedColumns([]);
  };

  const _getAvailableColumns = () => {
    if (!ast?.from) return [];
    let availableColumns = [];
    const processedTables = [];
    const selectedColumnNames = ast.columns.map(col => `${col.expr.table.value}.${col.expr.column}`);

    flattenFrom(ast.from).forEach((fromItem) => {
      if (!processedTables.includes(fromItem.table) && schema.description[fromItem.table]) {
        processedTables.push(fromItem.table);
        const tableColumns = Object.keys(schema.description[fromItem.table])
          .map((column) => `${fromItem.as || fromItem.table}.${column}`)
          .filter((fullColumnName) => !selectedColumnNames.includes(fullColumnName));
        availableColumns = availableColumns.concat(tableColumns);
      }
      if (!processedTables.includes(fromItem.joinTable) && schema.description[fromItem.joinTable]) {
        processedTables.push(fromItem.joinTable);
        const joinTableColumns = Object.keys(schema.description[fromItem.joinTable])
          .map((column) => `${fromItem.joinTableAs || fromItem.joinTable}.${column}`)
          .filter((fullColumnName) => !selectedColumnNames.includes(fullColumnName));
        availableColumns = availableColumns.concat(joinTableColumns);
      }
    });
    return availableColumns;
  };

  return (
    <Container className={"flex flex-col gap-4"}>
      {ast?.from && flattenFrom(ast.from).map((fromItem, index) => (
        <div key={index} className="flex gap-1 items-center">
          {fromItem.type === "main" && <Code variant="flat">Get data from</Code>}
          {fromItem.type === "join" && <Code variant="flat">Join</Code>}
          {fromItem.table && (
            <Select
              size="sm"
              color="primary"
              variant="flat"
              selectedKeys={fromItem.table ? [fromItem.table] : []}
              selectionMode="single"
              aria-label="Select main database table"
              onSelectionChange={(keys) => _onChangeMainTable(keys.currentKey)}
            >
              {schema?.tables.map((table) => (
                <SelectItem
                  key={table}
                  textValue={table}
                >
                  {table}
                </SelectItem>
              ))}
            </Select>
          )}
          {fromItem.joinTable && (
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onClick={() => setViewJoin({ ...fromItem, index })}
            >
              {`${fromItem.joinTable} on ${fromItem.on.left} ${fromItem.on.operator} ${fromItem.on.right}`}
            </Button>
          )}
          {fromItem.joinTable && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onClick={() => _onRemoveJoin(index)}
            >
              <LuX />
            </Button>
          )}
        </div>
      ))}
      {ast?.columns && (
        <div className="flex flex-wrap gap-1 items-center">
          <Code variant="flat">Select columns</Code>
          {ast.columns.map((col) => (
            <Popover key={col.expr.column}>
              <PopoverTrigger>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                >
                  {col.expr.column}
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  endContent={<LuX />}
                  onClick={() => _onRemoveColumn(col.expr.column)}
                >
                  Remove
                </Button>
              </PopoverContent>
            </Popover>
          ))}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => setViewAddColumn(true)}
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
        <Button
          variant="flat"
          size="sm"
          onClick={() => _onAddJoin()}
        >
          join
        </Button>
      </div>

      <Modal isOpen={viewJoin} onClose={() => setViewJoin(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Join data</div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div>
                <Select
                  label="Select a table to join"
                  variant="bordered"
                  selectedKeys={viewJoin?.joinTable ? [viewJoin.joinTable] : []}
                  selectionMode="single"
                  aria-label="Select table to join"
                  autoFocus
                  placeholder="Click to select a table"
                  onSelectionChange={(keys) => setViewJoin({ ...viewJoin, joinTable: keys.currentKey })}
                >
                  {schema?.tables.map((table) => (
                    <SelectItem
                      key={table}
                      textValue={table}
                    >
                      {table}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {viewJoin?.joinTable && (
                <div className="flex flex-row gap-2 items-center">
                  <div>On</div>
                  <Select
                    placeholder="Select column"
                    variant="bordered"
                    selectedKeys={[_getColumnName(viewJoin.on?.left)]}
                    aria-label="Select column to join on"
                    onSelectionChange={(keys) => setViewJoin({ ...viewJoin, on: { ...viewJoin.on, left: keys.currentKey } })}
                    selectionMode="single"
                    size="sm"
                    disallowEmptySelection
                  >
                    {Object.keys(schema.description?.[viewJoin.joinTable] || {}).map((column) => (
                      <SelectItem
                        key={column}
                        textValue={column}
                        startContent={<Chip size="sm" variant="flat">{viewJoin.joinTable}</Chip>}
                      >
                        {column}
                      </SelectItem>
                    ))}
                  </Select>
                  <div>=</div>
                  <Select
                    placeholder="Select column"
                    variant="bordered"
                    selectedKeys={[_getColumnName(viewJoin?.on?.right, viewJoin.mainTable)]}
                    aria-label="Select table to join"
                    onSelectionChange={(keys) => _onSelectJoinTable(keys.currentKey)}
                    selectionMode="single"
                    size="sm"
                    disallowEmptySelection
                  >
                    {_getJoinColumns(viewJoin.joinTable).map((column) => (
                      <SelectItem
                        key={`${column.table}.${column.column}`}
                        textValue={column.column}
                        startContent={<Chip size="sm" variant="flat">{column.table}</Chip>}
                      >
                        {column.column}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setViewJoin(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onChangeJoin(viewJoin)}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={viewAddColumn} onClose={() => setViewAddColumn(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Add column</div>
          </ModalHeader>
          <ModalBody>
            <Select
              placeholder="Select column"
              variant="bordered"
              selectedKeys={selectedColumns}
              aria-label="Select column to join on"
              onSelectionChange={(keys) => setSelectedColumns(keys)}
              disallowEmptySelection
              selectionMode="multiple"
            >
              {_getAvailableColumns().map((column) => (
                <SelectItem
                  key={column}
                  textValue={column}
                >
                  {column}
                </SelectItem>
              ))}
            </Select>
            <div className="flex flex-row gap-1">
              <Button
                variant="flat"
                size="sm"
                onClick={() => setSelectedColumns(_getAvailableColumns())}
              >
                Select all
              </Button>
              <Button
                variant="flat"
                size="sm"
                onClick={() => setSelectedColumns([])}
              >
                Select none
              </Button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setViewAddColumn(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onAddColumn()}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  )
}

VisualSQL.propTypes = {
  query: PropTypes.string.isRequired,
  schema: PropTypes.object.isRequired,
  updateQuery: PropTypes.func.isRequired
}

export default VisualSQL
