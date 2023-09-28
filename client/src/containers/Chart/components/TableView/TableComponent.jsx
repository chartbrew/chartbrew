import React from "react";
import { usePagination, useSortBy, useTable } from "react-table";
import PropTypes from "prop-types";
import {
  Dropdown, Spacer, Link as LinkNext, Table, Popover, Pagination, Chip,
  TableHeader, TableColumn, TableBody, TableRow, TableCell, PopoverTrigger,
  PopoverContent,
  DropdownTrigger,
  DropdownMenu,
  Button,
  DropdownItem,
} from "@nextui-org/react";
import { LuChevronDownCircle, LuChevronUpCircle } from "react-icons/lu";

import Row from "../../../../components/Row";
import Text from "../../../../components/Text";

const paginationOptions = [5, 10, 20, 30, 40, 50].map((pageSize) => ({
  key: pageSize,
  value: pageSize,
  text: `Show ${pageSize}`,
}));

function TableComponent(props) {
  const {
    columns, data, height, embedded,
  } = props;

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
            isStriped
            shadow="none"
            classNames={{ wrapper: "bg-content1" }}
            bottomContent={(
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
                    <DropdownTrigger>
                      <Button variant="bordered" size="sm">
                        {paginationOptions.find((option) => option.value === pageSize).text}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      variant="bordered"
                      selectionMode="single"
                      selectedKeys={[`${pageSize}`]}
                      onSelectionChange={(selection) => {
                        setPageSize(Number(Object.values(selection)[0]));
                      }}
                    >
                      {paginationOptions.map((option) => (
                        <DropdownItem key={`${option.value}`}>
                          <Text>{option.text}</Text>
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </Row>
              </div>
            )}
          >
            <TableHeader>
              {headerGroups[headerGroups.length - 1].headers.map((column) => {
                return (
                  <TableColumn
                    key={column.getHeaderProps(column.getSortByToggleProps()).key}
                    style={{ whiteSpace: "unset" }}
                    justify="center"
                    className={"pl-10 pr-10 max-w-[400px]"}
                  >
                    <Row align="center">
                      {column.isSorted
                        ? column.isSortedDesc
                          ? (<LuChevronDownCircle />)
                          : (<LuChevronUpCircle />)
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
                  </TableColumn>
                );
              })}
            </TableHeader>
            <TableBody {...getTableBodyProps()}>
              {page.length < 1 && (
                <TableRow>
                  <TableCell key="noresult">No Results</TableCell>
                </TableRow>
              )}
              {page.map((row) => {
                prepareRow(row);
                return (
                  <TableRow key={row.getRowProps().key} {...row.getRowProps()}>
                    {row.cells.map((cell, cellIndex) => {
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
                        <TableCell
                          key={`${row.id}-${cell.column.Header}`}
                          {...cell.getCellProps()}
                          className={"max-w-[300px] pr-10 pl-10"}
                          css={{
                            userSelect: "text",
                            borderRight: cellIndex === row.cells.length - 1 ? "none" : "$accents3 solid 1px",
                          }}
                        >
                          {(!isObject && !isArray) && (
                            <Text
                              size={"sm"}
                              title={cellObj.props.value}
                              className="whitespace-nowrap overflow-ellipsis overflow-hidden"
                            >
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
                              <PopoverTrigger>
                                <LinkNext>
                                  <Chip color="primary" variant={"flat"}>{(isShort && `${Object.values(objDetails)[0]}`) || "Collection"}</Chip>
                                </LinkNext>
                              </PopoverTrigger>
                              <PopoverContent>
                                <pre><code>{JSON.stringify(objDetails, null, 4)}</code></pre>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
