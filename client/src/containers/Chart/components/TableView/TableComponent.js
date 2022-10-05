/* eslint-disable react/jsx-props-no-spreading */

import React, { useEffect, useState } from "react";
import { usePagination, useSortBy, useTable } from "react-table";
import PropTypes from "prop-types";
import {
  Dropdown, Row, Spacer, Text, Link as LinkNext, Table,
  Popover, Pagination, Badge,
} from "@nextui-org/react";
import {
  ChevronDownCircle, ChevronUpCircle
} from "react-iconly";

const paginationOptions = [5, 10, 20, 30, 40, 50].map((pageSize) => ({
  key: pageSize,
  value: pageSize,
  text: `Show ${pageSize}`,
}));

function TableComponent(props) {
  const {
    columns, data, height, embedded, dataset,
  } = props;

  const [totalValue, setTotalValue] = useState(0);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    pageCount,
    gotoPage,
    setPageSize,
    state: { pageSize },
  } = useTable({
    columns,
    data,
    initialState: { pageIndex: 0 }
  },
  useSortBy,
  usePagination);

  useEffect(() => {
    if (data && dataset?.configuration?.sum) {
      setTotalValue(0);
      data.forEach((d) => {
        if (d[dataset.configuration.sum]) {
          try {
            setTotalValue((prev) => prev + parseFloat(d[dataset.configuration.sum]));
          } catch (e) {
            // console.log("e", e);
          }
        }
      });
    }
  }, [dataset]);

  return (
    <div style={styles.mainBody(height, embedded)}>
      {(!headerGroups
        || !headerGroups[headerGroups.length - 1]
        || !headerGroups[headerGroups.length - 1].headers
      ) && (
        <Text i>No results in this table</Text>
      )}

      {headerGroups
        && headerGroups[headerGroups.length - 1]
        && headerGroups[headerGroups.length - 1].headers
        && (
        <>
          <Table
            {...getTableProps()}
            shadow={false}
            lined
          >
            <Table.Header>
              {headerGroups[headerGroups.length - 1].headers.map((column) => {
                return (
                  <Table.Column
                    key={column.getHeaderProps(column.getSortByToggleProps()).key}
                    style={{ maxWidth: 400, whiteSpace: "unset" }}
                    justify="center"
                    css={{ pl: 10, pr: 10 }}
                  >
                    <Row align="center">
                      {column.isSorted
                        ? column.isSortedDesc
                          ? (<ChevronDownCircle />)
                          : (<ChevronUpCircle />)
                        : ""}
                      <LinkNext
                        onClick={column.getHeaderProps(column.getSortByToggleProps()).onClick}
                      >
                        <Text>
                          {typeof column.render("Header") === "object"
                            ? column.render("Header") : column.render("Header").replace("__cb_group", "")}
                        </Text>
                      </LinkNext>
                    </Row>
                  </Table.Column>
                );
              })}
            </Table.Header>
            <Table.Body {...getTableBodyProps()}>
              {page.length < 1 && (
                <Table.Row>
                  <Table.Cell key="noresult">No Results</Table.Cell>
                </Table.Row>
              )}
              {page.map((row) => {
                prepareRow(row);
                return (
                  <Table.Row {...row.getRowProps()}>
                    {row.cells.map((cell) => {
                      // identify collections to render them differently
                      const cellObj = cell.render("Cell");
                      // console.log("cellObj.key", cellObj.props.column.Header);

                      const isObject = (cellObj.props.value && cellObj.props.value.indexOf && cellObj.props.value.indexOf("__cb_object") > -1) || false;
                      const isArray = (cellObj.props.value && cellObj.props.value.indexOf && cellObj.props.value.indexOf("__cb_array") > -1) || false;
                      const objDetails = (isObject || isArray)
                        && JSON.parse(cellObj.props.value.replace("__cb_object", "").replace("__cb_array", ""));

                      // this is to check if the object has only one key
                      // to display the value directly
                      const isShort = isObject && Object.keys(objDetails).length === 1;

                      return (
                        <Table.Cell
                          {...cell.getCellProps()}
                          css={{
                            userSelect: "text",
                            maxWidth: 300,
                            pr: 10,
                            pl: 10,
                            borderBottom: "$accents3 solid 1px",
                            borderRight: "$accents3 solid 1px",
                          }}
                        >
                          {(!isObject && !isArray) && (
                            <Text size={"0.9em"} title={cellObj.props.value} css={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                              <span
                                style={{ cursor: "text", WebkitUserSelect: "text", whiteSpace: "nowrap" }}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                role="presentation"
                              >
                                {cellObj.props.value === true || cellObj.props.value === false
                                  ? `${cellObj.props.value}` : cellObj}
                              </span>
                            </Text>
                          )}
                          {(isObject || isArray) && (
                            <Popover>
                              <Popover.Trigger>
                                <LinkNext><Badge color="primary" variant={"flat"}>{(isShort && `${Object.values(objDetails)[0]}`) || "Collection"}</Badge></LinkNext>
                              </Popover.Trigger>
                              <Popover.Content>
                                <pre><code>{JSON.stringify(objDetails, null, 4)}</code></pre>
                              </Popover.Content>
                            </Popover>
                          )}
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
          {dataset?.configuration?.sum && (
            <div>
              <Row justify="flex-end" align="center" css={{ pl: 20, pr: 20 }}>
                <Text>{`Total ${dataset.configuration.sum}:`}</Text>
                <Spacer x={0.3} />
                <Text b>{totalValue.toLocaleString()}</Text>
              </Row>
              <Spacer y={0.5} />
            </div>
          )}
          <div>
            <Row align="center">
              <Pagination
                total={pageCount}
                initialPage={1}
                onChange={(page) => {
                  gotoPage(page - 1);
                }}
                size="sm"
              />
              <Spacer x={0.5} />
              <Dropdown>
                <Dropdown.Button bordered size="sm">
                  {paginationOptions.find((option) => option.value === pageSize).text}
                </Dropdown.Button>
                <Dropdown.Menu
                  selectionMode="single"
                  selectedKeys={[`${pageSize}`]}
                  onSelectionChange={(selection) => {
                    setPageSize(Number(Object.values(selection)[0]));
                  }}
                >
                  {paginationOptions.map((option) => (
                    <Dropdown.Item key={`${option.value}`}>
                      <Text css={{ color: "$text" }}>{option.text}</Text>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Row>
          </div>
        </>
        )}
    </div>
  );
}

const styles = {
  mainBody: (height, embedded) => ({
    overflowY: "auto",
    overflowX: "auto",
    height,
    transition: "height .5s ease-in",
    paddingBottom: embedded ? 30 : 0,
  }),
  table: {
    tableLayout: "auto",
  },
  itemsDropdown: {
    maxWidth: 200,
  }
};

TableComponent.defaultProps = {
  height: 300,
  embedded: false,
};

TableComponent.propTypes = {
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  height: PropTypes.number,
  embedded: PropTypes.bool,
  dataset: PropTypes.object.isRequired,
};

export default TableComponent;
