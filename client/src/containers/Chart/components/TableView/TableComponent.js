/* eslint-disable react/jsx-props-no-spreading */

import React from "react";
import { usePagination, useTable } from "react-table";
import PropTypes from "prop-types";
import {
  Button, Dropdown, Input, Table
} from "semantic-ui-react";

const paginationOptions = [5, 10, 20, 30, 40, 50].map((pageSize) => ({
  key: pageSize,
  value: pageSize,
  text: `Show ${pageSize}`,
}));

function TableComponent(props) {
  const { columns, data, height } = props;

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
  usePagination);

  return (
    <div style={styles.mainBody(height)}>
      <Table sortable celled striped structured selectable unstackable {...getTableProps()}>
        <Table.Header>
          {headerGroups.map(headerGroup => (
            <Table.Row {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <Table.HeaderCell {...column.getHeaderProps()}>{column.render("Header")}</Table.HeaderCell>
              ))}
            </Table.Row>
          ))}
        </Table.Header>
        <Table.Body {...getTableBodyProps()}>
          {page.map((row) => {
            prepareRow(row);
            return (
              <Table.Row {...row.getRowProps()}>
                {row.cells.map(cell => {
                  return <Table.Cell collapsing {...cell.getCellProps()}>{cell.render("Cell")}</Table.Cell>;
                })}
              </Table.Row>
            );
          })}
        </Table.Body>
        <Table.Footer className="pagination">
          <Table.Row>
            <Table.HeaderCell colSpan={columns.length}>
              <Button size="small" icon="angle double left" onClick={() => gotoPage(0)} disabled={!canPreviousPage} />
              <Button size="small" icon="angle left" onClick={() => previousPage()} disabled={!canPreviousPage} />
              <Button size="small" icon="angle right" onClick={() => nextPage()} disabled={!canNextPage} />
              <Button size="small" icon="angle double right" onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage} />
              <span>
                {"Page "}
                <strong>
                  {pageIndex + 1}
                  {" of "}
                  {pageOptions.length}
                </strong>
              </span>
              <span>
                {" | Go to page: "}
                <Input
                  type="number"
                  size="small"
                  defaultValue={pageIndex + 1}
                  onChange={e => {
                    const page = e.target.value ? Number(e.target.value) - 1 : 0;
                    gotoPage(page);
                  }}
                  style={{ width: 100 }}
                />
              </span>
              {" "}
              <Dropdown
                value={pageSize}
                onChange={(e, data) => {
                  setPageSize(Number(data.value));
                }}
                options={paginationOptions}
                selection
                compact
                size="small"
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </div>
  );
}

const styles = {
  mainBody: (height) => ({
    overflowY: "auto",
    overflowX: "auto",
    height,
    transition: "height .5s ease-in",
  }),
};

TableComponent.defaultProps = {
  height: 300,
};

TableComponent.propTypes = {
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  height: PropTypes.number,
};

export default TableComponent;
