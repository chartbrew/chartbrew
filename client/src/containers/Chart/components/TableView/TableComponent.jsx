import React, { useEffect } from "react";
import { usePagination, useSortBy, useTable } from "react-table";
import PropTypes from "prop-types";
import {
  Dropdown, Link as LinkNext, Table, Popover, Pagination, Chip, ProgressBar,
  TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button,
  Tooltip,
} from "@heroui/react";
import { LuChevronDown, LuCircleChevronDown, LuCircleChevronUp, LuExpand } from "react-icons/lu";

import Row from "../../../../components/Row";
import Text from "../../../../components/Text";
import { cn } from "../../../../modules/utils";

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
      // Check if column format is button - if so, render as button instead of link
      const columnConfig = columnsFormatting?.[columnKey];
      if (columnConfig?.display?.format === "button") {
        const buttonSettings = columnConfig.display.button || { color: "primary", variant: "solid" };
        baseContent = (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            <Button
              size="sm"
              color={buttonSettings.color || "primary"}
              variant={buttonSettings.variant || "solid"}
            >
              {buttonSettings.text || "View"}
            </Button>
          </a>
        );
      } else {
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
      }
    } else if (isLongText(value)) {
      baseContent = (
        <div className="flex flex-row items-center gap-1">
          <Popover>
            <Popover.Trigger
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-default-100 text-default-600 hover:bg-default-200"
              aria-label="Show full text"
            >
              <LuExpand size={16} />
            </Popover.Trigger>
            <Popover.Content>
              <Popover.Dialog>
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
              </Popover.Dialog>
            </Popover.Content>
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
        <Chip size="sm" variant="flat" className="rounded-sm" style={{ backgroundColor: matchRule.color, color: "#fff" }}>
          {baseContent}
        </Chip>
      );
    }
  }

  if (columnConfig?.display?.format === "image" && value) {
    if (columnConfig.display?.image?.variant === "inline") {
      return (
        <div style={{ width: `${columnConfig.display?.image?.size}px` }}>
          <img
            src={value}
            alt=""
            width={columnConfig.display?.image?.size}
            className="h-auto max-w-full object-contain"
          />
        </div>
      );
    } else if (columnConfig.display?.image?.variant === "popup") {
      return (
        <Popover>
          <Popover.Trigger className="inline-flex max-w-full items-center justify-center rounded-md bg-default-100 p-1 hover:bg-default-200">
            <img src={value} alt="" width={columnConfig.display?.image?.size} className="h-auto max-w-full object-contain" />
          </Popover.Trigger>
          <Popover.Content>
            <Popover.Dialog>
              <img
                src={value}
                alt=""
                className="max-w-lg object-contain"
              />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      );
    }
  }

  if (columnConfig?.display?.format === "progress") {
    const progressValue = Number(value);
    const safeProgressValue = Number.isFinite(progressValue) ? progressValue : 0;
    return (
      <Tooltip>
        <Tooltip.Trigger>
          <ProgressBar
            aria-label="Progress"
            value={safeProgressValue}
            maxValue={columnConfig.display.progress.max}
            minValue={0}
            size="sm"
            className="min-w-[80px]"
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Tooltip.Trigger>
        <Tooltip.Content>{`${value} / ${columnConfig.display.progress.max}`}</Tooltip.Content>
      </Tooltip>
    );
  }

  return baseContent;
};

function TableComponent({
  columns, data, embedded, dataset, defaultRowsPerPage = 10,
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
    initialState: { pageIndex: 0, pageSize: defaultRowsPerPage }
  },
  useSortBy,
  usePagination);

  useEffect(() => {
    setPageSize(defaultRowsPerPage);
  }, [defaultRowsPerPage]);

  const tableProps = getTableProps();
  const {
    className: tablePropsClassName,
    style: tablePropsStyle,
    ...tablePropsRest
  } = tableProps;
  const mergedTableStyle = { ...styles.table, ...tablePropsStyle };

  const headerGroup = headerGroups && headerGroups[headerGroups.length - 1];
  const headerCount = headerGroup?.headers?.length ?? 0;

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
          <Table className="bg-content1 w-full min-w-0">
            <Table.ScrollContainer>
              <Table.Content
                {...tablePropsRest}
                aria-label="Table data"
                className={cn(
                  "min-w-full shadow-none even:[&_tbody>tr]:bg-default-100/40",
                  tablePropsClassName
                )}
                style={mergedTableStyle}
              >
                <TableHeader>
                  {headerGroups[headerGroups.length - 1].headers.map((column, colIdx) => {
                return (
                  <TableColumn
                    key={column.getHeaderProps(column.getSortByToggleProps()).key}
                    isRowHeader={colIdx === 0}
                    style={{ whiteSpace: "unset" }}
                    className="pl-10 pr-10 max-w-[400px]"
                  >
                    <Row align="center">
                      {column.isSorted
                        ? column.isSortedDesc
                          ? (<LuCircleChevronDown size={16} />)
                          : (<LuCircleChevronUp size={16} />)
                        : ""}

                      {(column.isSorted || column.isSortedDesc) && <div className="w-2" />}
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
                  <TableCell key="noresult" colSpan={Math.max(1, headerCount)}>
                    No Results
                  </TableCell>
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

                      const { className: cellPropsClassName, ...cellPropsRest } = cell.getCellProps();
                      return (
                        <TableCell
                          key={`${row.id}-${cell.column.Header}`}
                          {...cellPropsRest}
                          className={cn(
                            "max-w-[300px] pr-10 pl-10 truncate select-text",
                            cellIndex !== row.cells.length - 1 && "border-e border-content3",
                            cellPropsClassName
                          )}
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
                              <Popover.Trigger>
                                <LinkNext>
                                  <Chip color="primary" variant={"flat"}>{(isShort && `${Object.values(objDetails)[0]}`) || "Collection"}</Chip>
                                </LinkNext>
                              </Popover.Trigger>
                              <Popover.Content>
                                <Popover.Dialog>
                                  <pre><code>{JSON.stringify(objDetails, null, 4)}</code></pre>
                                </Popover.Dialog>
                              </Popover.Content>
                            </Popover>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
                </TableBody>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer>
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
                  <div className="w-1" />
                  <Dropdown aria-label="Select a page size">
                    <Dropdown.Trigger>
                      <Button variant="secondary" size="sm" endContent={<LuChevronDown size={16} />}>
                        {paginationOptions.find((option) => option.value === pageSize).text}
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        variant="secondary"
                        selectionMode="single"
                        selectedKeys={[`${pageSize}`]}
                        onSelectionChange={(selection) => {
                          setPageSize(Number(Object.values(selection)[0]));
                        }}
                      >
                        {paginationOptions.map((option) => (
                          <Dropdown.Item id={`${option.value}`} key={option.value} textValue={option.text}>
                            <Text>{option.text}</Text>
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </Row>
              </div>
            </Table.Footer>
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
  defaultRowsPerPage: PropTypes.number,
};

export default TableComponent;
