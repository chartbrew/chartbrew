/* eslint-disable react/jsx-props-no-spreading */

import React from "react";
import { usePagination, useSortBy, useTable } from "react-table";
import PropTypes from "prop-types";
import {
  Button, Dropdown, Form, Icon, Input, Label, Popup, Table
} from "semantic-ui-react";

const paginationOptions = [5, 10, 20, 30, 40, 50].map((pageSize) => ({
  key: pageSize,
  value: pageSize,
  text: `Show ${pageSize}`,
}));

function TableComponent(props) {
  const {
    columns, data, height, embedded
  } = props;

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = useTable({
    columns,
    data,
    initialState: { pageIndex: 0 }
  },
  useSortBy,
  usePagination);

  const getColumnsRealSize = () => {
    let realSize = 0;
    columns.forEach((column) => {
      realSize++;
      if (column.columns) realSize += column.columns.length;
    });

    return realSize;
  };

  return (
    <div style={styles.mainBody(height, embedded)}>
      <Table sortable celled striped unstackable fixed {...getTableProps()} style={styles.table}>
        <Table.Header>
          {headerGroups.map(headerGroup => (
            <Table.Row {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <Table.HeaderCell
                  {...column.getHeaderProps(column.getSortByToggleProps())}
                  style={{ maxWidth: 400, whiteSpace: "unset" }}
                >
                  {typeof column.render("Header") === "object"
                    ? column.render("Header") : column.render("Header").replace("__cb_group", "")}
                  <span>
                    {" "}
                    {column.isSorted
                      ? column.isSortedDesc
                        ? (<Icon name="chevron down" />)
                        : (<Icon name="chevron up" />)
                      : ""}
                  </span>
                </Table.HeaderCell>
              ))}
            </Table.Row>
          ))}
        </Table.Header>
        <Table.Body {...getTableBodyProps()}>
          {page.length < 1 && (
            <Table.Row>
              <Table.Cell>No Results</Table.Cell>
            </Table.Row>
          )}
          {page.map((row) => {
            prepareRow(row);
            return (
              <Table.Row {...row.getRowProps()}>
                {row.cells.map((cell) => {
                  // identify collections to render them differently
                  const cellObj = cell.render("Cell");

                  const isObject = (cellObj.props.value && cellObj.props.value.indexOf && cellObj.props.value.indexOf("__cb_object") > -1) || false;
                  const isArray = (cellObj.props.value && cellObj.props.value.indexOf && cellObj.props.value.indexOf("__cb_array") > -1) || false;
                  const objDetails = (isObject || isArray)
                    && JSON.parse(cellObj.props.value.replace("__cb_object", "").replace("__cb_array", ""));

                  // this is to check if the object has only one key to display the value directly
                  const isShort = isObject && Object.keys(objDetails).length === 1;

                  return (
                    <Table.Cell collapsing {...cell.getCellProps()} style={{ maxWidth: 300 }}>
                      {(!isObject && !isArray) && (
                        <span title={cellObj.props.value}>{cellObj}</span>
                      )}
                      {(isObject || isArray) && (
                        <Popup
                          trigger={(<Label as="a">{(isShort && `${Object.values(objDetails)[0]}`) || "Collection"}</Label>)}
                          content={(<pre><code>{JSON.stringify(objDetails, null, 4)}</code></pre>)}
                          on="click"
                        />
                      )}
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            );
          })}
        </Table.Body>
        <Table.Footer className="pagination">
          <Table.Row>
            <Table.HeaderCell colSpan={getColumnsRealSize()} style={{ overflow: "visible" }}>
              <Form size="small">
                <Form.Group style={{ marginBottom: 0 }}>
                  <Form.Field>
                    <Button icon="angle double left" onClick={() => gotoPage(0)} disabled={!canPreviousPage} />
                    <Button icon="angle left" onClick={() => previousPage()} disabled={!canPreviousPage} />
                    <Button icon="angle right" onClick={() => nextPage()} disabled={!canNextPage} />
                    <Button icon="angle double right" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage} />
                  </Form.Field>
                  <Form.Field>
                    <span>
                      {"Page "}
                      <strong>
                        {pageIndex + 1}
                        {" of "}
                        {pageOptions.length}
                      </strong>
                    </span>
                    <span>
                      {" "}
                      <Input
                        type="number"
                        defaultValue={pageIndex + 1}
                        onChange={e => {
                          const page = e.target.value ? Number(e.target.value) - 1 : 0;
                          gotoPage(page);
                        }}
                        style={{ width: 70 }}
                      />
                    </span>
                    {" "}
                  </Form.Field>
                  <Form.Field>
                    <Dropdown
                      value={pageSize}
                      onChange={(e, data) => {
                        setPageSize(Number(data.value));
                      }}
                      options={paginationOptions}
                      selection
                      compact
                      upward
                      style={styles.itemsDropdown}
                    />
                  </Form.Field>
                </Form.Group>
              </Form>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
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
};

export default TableComponent;
