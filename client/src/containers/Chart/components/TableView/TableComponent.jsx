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
  Progress,
  Tooltip,
} from "@heroui/react";
import { LuChevronDown, LuCircleChevronDown, LuCircleChevronUp, LuExpand } from "react-icons/lu";

import Row from "../../../../components/Row";
import Text from "../../../../components/Text";

const paginationOptions = [5, 10, 20, 30, 40, 50].map((pageSize) => ({
  key: pageSize,
  value: pageSize,
  text: `Show ${pageSize}`,
}));

// Add URL detection function
const isUrl = (str) => {
  if (typeof str !== "string") return false;
  
  // Check for common URL patterns
  const urlPatterns = [
    /^https?:\/\//i,  // http:// or https://
    /^www\./i,        // www.
    /^ftp:\/\//i,     // ftp://
    /^mailto:/i,      // mailto:
  ];

  // Check if string matches any URL pattern
  if (urlPatterns.some(pattern => pattern.test(str))) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
};

// Add long text detection function
const isLongText = (str) => {
  if (typeof str !== "string") return false;
  return str.length > 50; // Consider text longer than 50 characters as "long" for text-sm in 300px width
};

// Add text rendering rules
const renderCellContent = (value, columnKey, columnsFormatting) => {
  // 1) Compute base content (type-aware rendering)
  let baseContent = value;

  if (value === true || value === false) {
    baseContent = `${value}`;
  } else if (typeof value === "string") {
    if (isUrl(value)) {
      baseContent = (
        <LinkNext
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          {value}
        </LinkNext>
      );
    } else if (isLongText(value)) {
      baseContent = (
        <div className="flex flex-row items-center gap-1">
          <Popover>
            <PopoverTrigger>
              <Button isIconOnly variant="flat" size="sm">
                <LuExpand size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="p-4 max-w-[500px] max-h-[300px] overflow-auto">
                <div className="flex justify-between items-center mb-2">
                  <Text className="text-sm font-medium">Full Text</Text>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => navigator.clipboard.writeText(value)}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap">{value}</pre>
              </div>
            </PopoverContent>
          </Popover>
          <span>{value}</span>
        </div>
      );
    }
  }

  // 2) Apply mapping wrapper if configured and rule with color matches
  const columnConfig = columnsFormatting?.[columnKey];
  if (
    columnConfig?.display?.format === "mapping"
    && Array.isArray(columnConfig.display.rules)
  ) {
    const matchRule = columnConfig.display.rules.find((rule) => (
      (rule?.label === value || rule?.value === value) && !!rule?.color
    ));

    if (matchRule) {
      return (
        <Chip size="sm" radius="sm" variant="flat" style={{ backgroundColor: matchRule.color, color: "#fff" }}>
          {baseContent}
        </Chip>
      );
    }
  }

  if (columnConfig?.display?.format === "progress") {
    return (
      <Tooltip content={`${value} / ${columnConfig.display.progress.max}`}>
        <Progress
          aria-label="Progress"
          value={value}
          maxValue={columnConfig.display.progress.max}
        />
      </Tooltip>
    );
  }

  return baseContent;
};

function TableComponent({
  columns, data, embedded, dataset,
}) {
  const columnsFormatting = dataset?.configuration?.columnsFormatting;
  
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
    <div style={styles.mainBody(embedded)}>
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
            aria-label="Table data"
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
                    aria-label="Pagination"
                  />
                  <Spacer x={0.5} />
                  <Dropdown aria-label="Select a page size">
                    <DropdownTrigger>
                      <Button variant="bordered" size="sm" endContent={<LuChevronDown size={16} />}>
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
                        <DropdownItem key={`${option.value}`} textValue={option.text}>
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
                    className={"pl-10 pr-10 max-w-[400px]"}
                  >
                    <Row align="center">
                      {column.isSorted
                        ? column.isSortedDesc
                          ? (<LuCircleChevronDown size={16} />)
                          : (<LuCircleChevronUp size={16} />)
                        : ""}

                      {(column.isSorted || column.isSortedDesc) && <Spacer x={1} />}
                      <LinkNext
                        className="text-sm cursor-pointer hover:text-secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          column.getSortByToggleProps().onClick(e);
                        }}
                      >
                        <Text className={"text-foreground-500"}>
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
                          className={"max-w-[300px] pr-10 pl-10 truncate"}
                          css={{
                            userSelect: "text",
                            borderRight: cellIndex === row.cells.length - 1 ? "none" : "$accents3 solid 1px",
                          }}
                          title={cellObj.props.value}
                        >
                          {(!isObject && !isArray) && (
                            <div
                              title={cellObj.props.value}
                              className="text-sm truncate"
                            >
                              <span
                                style={{ cursor: "text", WebkitUserSelect: "text", whiteSpace: "nowrap" }}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                role="presentation"
                              >
                                {(() => {
                                  const accessorKey = cell?.column?.id || cell?.column?.accessor || cell?.column?.Header;
                                  return renderCellContent(cellObj.props.value, accessorKey, columnsFormatting);
                                })()}
                              </span>
                            </div>
                          )}
                          {(isObject || isArray) && (
                            <Popover aria-label="Object details">
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
  mainBody: (embedded) => ({
    overflowY: "auto",
    overflowX: "auto",
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
  embedded: false,
};

TableComponent.propTypes = {
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  embedded: PropTypes.bool,
  dataset: PropTypes.object.isRequired,
};

export default TableComponent;
