import { Alert, Autocomplete, AutocompleteItem, Button, Chip, Code, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger, Radio, RadioGroup, Select, SelectItem } from "@heroui/react"
import React, { useEffect, useState } from "react"
import PropTypes from "prop-types"
import { LuPlus, LuX } from "react-icons/lu"
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

function VisualSQL({ schema, query, updateQuery, type }) {
  const [ast, setAst] = useState(null);
  const [viewJoin, setViewJoin] = useState(false);
  const [viewAddColumn, setViewAddColumn] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [viewFilter, setViewFilter] = useState(false);
  const [newFilter, setNewFilter] = useState({
    column: "",
    operator: "",
    value: ""
  });
  const [viewGroupBy, setViewGroupBy] = useState(false);
  const [groupByColumn, setGroupByColumn] = useState("");
  const [viewOrderBy, setViewOrderBy] = useState(false);
  const [orderByColumn, setOrderByColumn] = useState("");
  const [orderByOrder, setOrderByOrder] = useState("ASC");
  const [viewLimit, setViewLimit] = useState(false);
  const [limit, setLimit] = useState(10);
  const [queryError, setQueryError] = useState(false);

  useEffect(() => {
    try {
      const opt = {
        database: type === "mysql" ? "MySQL" : "postgresql",
      };
      const newAst = parser.astify(query, opt);
      const formattedAst = newAst?.[0] || newAst;
      setAst(formattedAst);
    } catch(e) {
      setQueryError(true);
    }
  }, [query]);

  const _onUpdateQuery = (newQuery) => {
    if (!newQuery) {
      updateQuery("");
      return;
    }

    const opt = {
      database: type === "mysql" ? "MySQL" : "postgresql",
    };
    const parsedQuery = parser.sqlify(newQuery, opt);

    // before updating the query, enter new lines after major operations
    // INNER JOIN, WHERE, GROUP BY, ORDER BY, LIMIT
    const formattedQuery = parsedQuery
      .replace(/ INNER JOIN /g, "\nINNER JOIN ")
      .replace(/ WHERE /g, "\nWHERE ")
      .replace(/ GROUP BY /g, "\nGROUP BY ")
      .replace(/ ORDER BY /g, "\nORDER BY ")
      .replace(/ LIMIT /g, "\nLIMIT ");
    
    updateQuery(formattedQuery);
  };

  const _onChangeMainTable = (table) => {
    let newFrom;
    let selects;
    let newAst;

    if (!ast?.from) {
      newFrom = [{
        table,
        as: table,
        db: null,
        join: null,
        on: null
      }];
      selects = [{
        expr: {
          column: "*",
          type: "column_ref",
          table: null
        },
        as: null
      }];
      newAst = {
        from: newFrom,
        type: "select",
        distinct: null,
        groupby: null,
        having: null,
        limit: null,
        orderby: null,
        where: null,
        with: null,
        options: null,
        locking_read: null,
        into: {
          position: null,
        },
      };
    } else {
      newFrom = ast.from.map((fromItem) => {
        if (!fromItem.on) {
          fromItem.table = table;
        }
        return fromItem;
      });
      newAst = { ...ast };
    }

    newAst.from = newFrom;

    if (selects) newAst.columns = selects;

    setAst(newAst);
    _onUpdateQuery(newAst);

    setQueryError(false);
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
    _onUpdateQuery(newAst);

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
          .concat(Object.keys(schema?.description[joinTable])
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
    _onUpdateQuery(newAst);
  };

  const _onRemoveColumn = (column) => {
    const newAst = { ...ast, columns: ast.columns.filter((col) => col.expr.column !== column) };
    setAst(newAst);
    _onUpdateQuery(newAst);
  };

  const _onAddColumn = () => {
    let newColumns = selectedColumns.values().map((selectedColumn) => {
      const table = selectedColumn.split(".")[0];
      const column = selectedColumn.split(".")[1];

      return {
        expr: {
          column,
          type: "column_ref",
          table: { value: table, type: type === "mysql" ? "backticks_quote_string" : "single_quote_string" }
        },
        as: null
      };
    });

    newColumns = Array.from(newColumns);
    newColumns = [
      ...ast.columns,
      ...newColumns
    ];

    // remove the "*" column if present at the start (newColumns is an Iterator)
    if (newColumns[0].expr.column === "*") {
      newColumns = newColumns.slice(1);
    }

    const newAst = {
      ...ast,
      columns: newColumns,
    };

    setAst(newAst);
    _onUpdateQuery(newAst);
    setViewAddColumn(false);
    setSelectedColumns([]);
  };

  const _getAvailableColumns = () => {
    if (!ast?.from || !ast?.columns) return [];
    let availableColumns = [];
    const processedTables = [];
    const selectedColumnNames = ast.columns.map(col => `${col.expr.table?.value}.${col.expr.column}`);

    flattenFrom(ast.from).forEach((fromItem) => {
      if (!processedTables.includes(fromItem.table) && schema?.description[fromItem.table]) {
        processedTables.push(fromItem.table);
        const tableColumns = Object.keys(schema?.description[fromItem.table])
          .map((column) => `${fromItem.as || fromItem.table}.${column}`)
          .filter((fullColumnName) => !selectedColumnNames.includes(fullColumnName));
        availableColumns = availableColumns.concat(tableColumns);
      }
      if (!processedTables.includes(fromItem.joinTable) && schema?.description[fromItem.joinTable]) {
        processedTables.push(fromItem.joinTable);
        const joinTableColumns = Object.keys(schema?.description[fromItem.joinTable])
          .map((column) => `${fromItem.joinTableAs || fromItem.joinTable}.${column}`)
          .filter((fullColumnName) => !selectedColumnNames.includes(fullColumnName));
        availableColumns = availableColumns.concat(joinTableColumns);
      }
    });
    return availableColumns;
  };

  const _determineValueTypeFromSchema = (column) => {
    const columnType = schema[column]?.type;
    if (!columnType) {
      return "double_quote_string";
    }

    if (columnType.includes("CHAR") || columnType.includes("VARCHAR") || columnType.includes("TEXT") || columnType.includes("LONGTEXT")) {
      return "double_quote_string";
    } else if (columnType.includes("INT") || columnType.includes("TINYINT")) {
      return "number";
    } else if (columnType.includes("DATETIME") || columnType.includes("DATE") || columnType.includes("TIMESTAMP")) {
      return "date";
    }

    return "double_quote_string";
  };

  const _getColumnsForFilter = () => {
    if (!ast?.from) return [];

    let allColumns = [];
    flattenFrom(ast.from).forEach((fromItem) => {
      if (schema?.description[fromItem.table]) {
        const tableColumns = Object.keys(schema?.description[fromItem.table])
          .map((column) => ({
            name: `${fromItem.as || fromItem.table}.${column}`,
            type: schema?.description[fromItem.table][column].type,
            table: { value: fromItem.as || fromItem.table, type: type === "mysql" ? "backticks_quote_string" : "single_quote_string" }
          }));
        allColumns = allColumns.concat(tableColumns);
      }
      if (schema?.description[fromItem.joinTable]) {
        const joinTableColumns = Object.keys(schema?.description[fromItem.joinTable])
          .map((column) => ({
            name: `${fromItem.joinTableAs || fromItem.joinTable}.${column}`,
            type: schema?.description[fromItem.joinTable][column].type,
            table: { value: fromItem.joinTableAs || fromItem.joinTable, type: type === "mysql" ? "backticks_quote_string" : "single_quote_string" }
          }));
        allColumns = allColumns.concat(joinTableColumns);
      }
    });
    return allColumns;
  };

  const _onAddFilter = () => {
    const newFilterCondition = {
      type: "binary_expr",
      operator: newFilter.operator,
      left: {
        type: "column_ref",
        table: newFilter.column.table,
        column: newFilter.column.name.indexOf(".") === -1 ? newFilter.column.name : newFilter.column.name.split(".")[1]
      },
      right: {
        type: _determineValueTypeFromSchema(newFilter.column.name),
        value: newFilter.value
      }
    };

    const updatedWhere = ast.where ? {
      type: "binary_expr",
      operator: ast.where.operator === "OR" ? "OR" : "AND",
      left: ast.where,
      right: newFilterCondition
    } : newFilterCondition;

    const newAst = { ...ast, where: updatedWhere };
    setAst(newAst);
    _onUpdateQuery(newAst);

    setViewFilter(false);
    setNewFilter({});
  };

  const _onRemoveFilter = (condition) => {
    const isConditionMatch = (node, condition) => {
      return node.operator === condition.operator &&
        node.left.type === condition.left.type &&
        node.left.column === condition.left.column &&
        ((!condition.left.table && !node.left.table) ||
          (node.left.table && node.left.table.value === condition.left.table.value)) &&
        node.right.type === condition.right.type &&
        node.right.value === condition.right.value;
    };

    const removeConditionRecursively = (node) => {
      if (!node) return null;

      // Check if the node is a binary expression with the condition to remove
      if (node.type === "binary_expr" && isConditionMatch(node, condition)) {
        return null;
      }

      // If the node is a binary expression, recursively process its left and right
      if (node.type === "binary_expr") {
        const newLeft = removeConditionRecursively(node.left);
        const newRight = removeConditionRecursively(node.right);

        // If both left and right are null, this node should be removed
        if (!newLeft && !newRight) return null;

        // If one of them is null, return the other
        if (!newLeft) return newRight;
        if (!newRight) return newLeft;

        return {
          ...node,
          left: newLeft,
          right: newRight
        };
      }

      // If the node is not a binary expression, return it unchanged
      return node;
    };

    const newWhere = removeConditionRecursively(ast.where);
    setAst({ ...ast, where: newWhere });
    _onUpdateQuery({ ...ast, where: newWhere });
  };

  const _onChangeOperator = (operator) => {
    const toggleOperator = (node) => {
      if (node.type === "binary_expr" && (node.operator === "AND" || node.operator === "OR")) {
        node.operator = operator === "AND" ? "OR" : "AND";
        if (node.left) toggleOperator(node.left);
        if (node.right) toggleOperator(node.right);
      }
    };

    const newWhere = { ...ast.where };
    toggleOperator(newWhere);
    const newAst = { ...ast, where: newWhere };
    setAst(newAst);
    _onUpdateQuery(newAst);
  };

  const _filterOperations = () => {
    if (!newFilter.column?.type) return operations;
    return operations.filter(op => {
      return op.types.find(type => newFilter.column?.type.indexOf(type) !== -1);
    });
  };

  const _onAddGroupBy = () => {
    const newColumn = {
      column: groupByColumn.name.split(".")[1] || groupByColumn.name,
      type: "column_ref",
      table: groupByColumn.table
    };

    const newAst = { ...ast, groupby: { columns: [...(ast.groupby?.columns || []), newColumn] } };

    setAst(newAst);
    _onUpdateQuery(newAst);
    setViewGroupBy(false);
    setGroupByColumn("");
  };

  const _onRemoveGroup = (group) => {
    const newAst = { 
      ...ast, 
      groupby: {
        ...ast.groupby,
        columns: ast.groupby?.columns?.filter((g) => {
          if (group.table && g.table) {
            return !(g.table.value === group.table.value && g.column === group.column);
          } else {
            return g.column !== group.column;
          }
        })
      }
    };

    setAst(newAst);
    _onUpdateQuery(newAst);
  };

  const _onRemoveOrder = (order) => {
    const newAst = { 
      ...ast, 
      orderby: ast.orderby.filter((o) => {
        if (order.expr.table && o.expr.table) {
          return !(o.expr.table.value === order.expr.table.value && o.expr.column === order.expr.column);
        } else {
          return o.expr.column !== order.expr.column;
        }
      })
    };
    setAst(newAst);
    _onUpdateQuery(newAst);
  };

  const _onAddOrderBy = () => {
    const newOrder = {
      expr: {
        column: orderByColumn.name.split(".")[1] || orderByColumn.name,
        table: orderByColumn.table,
        type: "column_ref"
      },
      type: orderByOrder
    };

    const newAst = { ...ast, orderby: [...(ast.orderby || []), newOrder] };

    setAst(newAst);
    _onUpdateQuery(newAst);

    setViewOrderBy(false);
    setOrderByColumn("");
    setOrderByOrder("ASC");
  };

  const _onAddLimit = () => {
    const newAst = { ...ast, limit: {
      separator: "",
      value: [{
        type: "number",
        value: limit
      }],
    }};
    setAst(newAst);
    _onUpdateQuery(newAst);
    setViewLimit(false);
    setLimit(10);
  };

  const _onRemoveLimit = () => {
    const newAst = { ...ast, limit: null };
    setAst(newAst);
    _onUpdateQuery(newAst);
  };

  const _onResetQuery = () => {
    setQueryError(false);
    _onUpdateQuery("");
  };

  if (queryError && query) {
    return (
      <Container className={"flex flex-col gap-4"}>
        <Alert
          color="primary"
          title="We could not parse your query"
          description="Modify the query manually or restart the query from here."
          variant="bordered"
        >
          <Button
            color="primary"
            size="sm"
            onPress={() => _onResetQuery()}
            className="mt-2"
          >
            Restart query
          </Button>
        </Alert>
      </Container>
    );
  }

  if (!ast?.from || !schema) {
    return (
      <Container className={"flex flex-col gap-4"}>
        <Autocomplete
          label="Select a table to get started"
          size="sm"
          variant="bordered"
          selectedKey={""}
          aria-label="Select main database table"
          onSelectionChange={(key) => _onChangeMainTable(key)}
          className="max-w-[300px]"
        >
          {schema?.tables.map((table) => (
            <AutocompleteItem
              key={table}
              textValue={table}
            >
              {table}
            </AutocompleteItem>
          ))}
        </Autocomplete>
      </Container>
    );
  }

  return (
    <Container className={"flex flex-col gap-4"}>
      {!ast?.from && (
        <div className="flex flex-col gap-2">
          <Select
            label="Select a table to get started"
            size="sm"
            variant="bordered"
            selectedKeys={[]}
            selectionMode="single"
            aria-label="Select main database table"
            onSelectionChange={(keys) => _onChangeMainTable(keys.currentKey)}
            className="max-w-[300px]"
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
      )}
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
              className="max-w-[300px]"
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
                  {col.expr.column === "*" ? "All" : col.expr.column}
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
        <Code variant="flat">Filter</Code>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onClick={() => setViewFilter(true)}
        >
          <LuPlus />
        </Button>
      </div>
      {ast?.where && flattenConditions(ast.where).map((condition, index) => (
        <div key={index} className="flex gap-1 items-center ml-4">
          {index > 0 && ast?.where?.operator && (
            <Chip size="sm" variant="faded" color="primary" radius="sm" className="cursor-pointer" onClick={() => _onChangeOperator(ast?.where?.operator)}>
              {ast?.where?.operator}
            </Chip>
          )}
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {condition.left?.column}
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
            {condition.right?.value}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => _onRemoveFilter(condition)}
          >
            <LuX />
          </Button>
        </div>
      ))}

      {ast?.groupby?.columns && ast.groupby.columns.map((group) => (
        <div key={`${group?.table?.value}.${group.column}`} className="flex flex-wrap gap-1 items-center">
          <Code variant="flat">Group by</Code>
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {`${group.table.value ? `${group.table.value}.` : ""}${group.column}`}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => _onRemoveGroup(group)}
          >
            <LuX />
          </Button>
        </div>
      ))}

      {ast?.orderby && ast.orderby.map((order) => (
        <div key={`${order.expr?.table?.value}.${order.expr.column}`} className="flex gap-1 items-center">
          <Code variant="flat">Order by</Code>
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {`${order.expr?.table?.value ? `${order.expr.table.value}.` : ""}${order.expr.column} ${order.type}`}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => _onRemoveOrder(order)}
          >
            <LuX />
          </Button>
        </div>
      ))}

      {ast?.limit && ast.limit?.value?.[0]?.value && (
        <div className="flex gap-1 items-center">
          <Code variant="flat">Limit</Code>
          <Button
            size="sm"
            color="primary"
            variant="flat"
          >
            {ast.limit.value[0]?.value}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => _onRemoveLimit()}
          >
            <LuX />
          </Button>
        </div>
      )}

      <div>
        Add additional steps
      </div>

      <div className="flex gap-1 items-center">
        <Button variant="flat" size="sm" onClick={() => setViewGroupBy(true)}>group</Button>
        <Button variant="flat" size="sm" onClick={() => setViewOrderBy(true)}>order</Button>
        <Button variant="flat" size="sm" onClick={() => setViewLimit(true)}>limit</Button>
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
                    {Object.keys(schema?.description?.[viewJoin.joinTable] || {}).map((column) => (
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

      <Modal isOpen={viewFilter} onClose={() => setViewFilter(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Filter data</div>
          </ModalHeader>
          <ModalBody className="flex flex-col gap-2">
            <Select
              label="Column"
              placeholder="Select column"
              variant="bordered"
              selectedKeys={[newFilter.column?.name || ""]}
              aria-label="Select column to filter on"
              onSelectionChange={(keys) => {
                const selectedColumn = _getColumnsForFilter().find(col => col.name === keys.currentKey);
                setNewFilter({ ...newFilter, column: selectedColumn });
              }}
            >
              {_getColumnsForFilter().map((column) => (
                <SelectItem
                  key={column.name}
                  textValue={column.name}
                >
                  {column.name}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Operator"
              placeholder="Select operator"
              variant="bordered"
              selectedKeys={[newFilter.operator]}
              aria-label="Select operator"
              onSelectionChange={(keys) => setNewFilter({ ...newFilter, operator: keys.currentKey })}
            >
              {_filterOperations().map((operation) => (
                <SelectItem
                  key={operation.operator}
                  textValue={operation.name}
                >
                  {operation.name}
                </SelectItem>
              ))}
            </Select>
            <Input
              label="Value"
              placeholder="Enter value"
              variant="bordered"
              value={newFilter.value}
              onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setViewFilter(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onAddFilter(newFilter)}
              isDisabled={!newFilter.column || !newFilter.operator || !newFilter.value}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={viewGroupBy} onClose={() => setViewGroupBy(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Group by</div>
          </ModalHeader>
          <ModalBody>
            <Select
              placeholder="Select column"
              variant="bordered"
              selectedKeys={[groupByColumn?.name || ""]}
              aria-label="Select column to group by"
              onSelectionChange={(keys) => setGroupByColumn(_getColumnsForFilter().find(col => col.name === keys.currentKey))}
              selectionMode="single"
            >
              {_getColumnsForFilter().map((column) => (
                <SelectItem
                  key={column.name}
                  textValue={column.name}
                >
                  {column.name}
                </SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setViewGroupBy(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onAddGroupBy()}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={viewOrderBy} onClose={() => setViewOrderBy(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Order by</div>
          </ModalHeader>
          <ModalBody>
            <Select
              placeholder="Select column"
              variant="bordered"
              selectedKeys={[orderByColumn?.name || ""]}
              selectionMode="single"
              onSelectionChange={(keys) => setOrderByColumn(_getColumnsForFilter().find(col => col.name === keys.currentKey))}
              aria-label="Select column to order by"
            >
              {_getColumnsForFilter().map((column) => (
                <SelectItem
                  key={column.name}
                  textValue={column.name}
                >
                  {column.name}
                </SelectItem>
              ))}
            </Select>
            <RadioGroup
              label="Order"
              value={orderByOrder}
              onChange={(e) => setOrderByOrder(e.target.value)}
            >
              <Radio value="ASC">Ascending</Radio>
              <Radio value="DESC">Descending</Radio>
            </RadioGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setViewOrderBy(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onAddOrderBy()}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={viewLimit} onClose={() => setViewLimit(false)} size="xl">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Limit</div>
          </ModalHeader>
          <ModalBody>
            <Input
              type="number"
              label="Limit"
              placeholder="Enter limit"
              variant="bordered"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setViewLimit(false)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onClick={() => _onAddLimit()}
            >
              Save limit
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
  updateQuery: PropTypes.func.isRequired,
  type: PropTypes.string.isRequired,
}

export default VisualSQL
