/* eslint-disable react/jsx-props-no-spreading */

import React from "react";
import { useTable } from "react-table";
import PropTypes from "prop-types";
import { Table } from "semantic-ui-react";

function TableComponent(props) {
  const { columns, data, height } = props;

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns,
    data,
  });

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
          {rows.map((row) => {
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
