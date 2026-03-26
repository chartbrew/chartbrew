import React, { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import PropTypes from "prop-types";
import {
  Dropdown, Link as LinkNext, Table, Popover, Chip, ProgressBar,
  Button,
  Tooltip,
} from "@heroui/react";
import { LuArrowDown, LuArrowUp, LuChevronDown, LuExpand } from "react-icons/lu";

import Row from "../../../../components/Row";
import HeroPaginationNav from "../../../../components/HeroPaginationNav";
import Text from "../../../../components/Text";
import { cn } from "../../../../modules/utils";

const paginationOptions = [5, 10, 20, 30, 40, 50].map((pageSize) => ({
  key: pageSize,
  value: pageSize,
  text: `Show ${pageSize}`,
}));

/** Maps legacy table column button settings (v2) to HeroUI v3 Button variant. */
const tableDisplayButtonVariant = (buttonSettings) => {
  const color = buttonSettings.color || "primary";
  const legacy = buttonSettings.variant || "solid";
  if (legacy === "flat") return "tertiary";
  if (legacy === "bordered") return "outline";
  if (legacy === "light") return "tertiary";
  if (color === "danger") return "danger";
  if (color === "secondary") return "secondary";
  return "primary";
};

/** Convert react-table v7-style column defs from the server to TanStack Table v8 defs. */
function toTanStackColumnDefinition(col) {
  if (Array.isArray(col.columns) && col.columns.length > 0) {
    return {
      header: col.Header,
      columns: col.columns.map(toTanStackColumnDefinition),
    };
  }
  const accessor = col.accessor;
  const id = typeof accessor === "string" ? accessor : `col_${String(col.Header)}`;
  return {
    id,
    ...(typeof accessor === "string" ? { accessorKey: accessor } : { accessorFn: accessor }),
    header: col.Header,
    enableSorting: true,
  };
}

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
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
            <Button
              size="sm"
              variant={tableDisplayButtonVariant(buttonSettings)}
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
            className="text-sm text-accent hover:underline"
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
                      variant="tertiary"
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
        <Chip size="sm" variant="soft" className="rounded-sm" style={{ backgroundColor: matchRule.color, color: "#fff" }}>
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

function formatHeaderLabel(header) {
  const def = header.column.columnDef.header;
  if (typeof def === "string") {
    return def.replace("__cb_group", "");
  }
  const rendered = flexRender(def, header.getContext());
  return typeof rendered === "string" ? rendered.replace("__cb_group", "") : rendered;
}

function TableComponent({
  columns, data, embedded, dataset, defaultRowsPerPage = 10,
}) {
  const columnsFormatting = dataset?.configuration?.columnsFormatting;

  const columnDefs = useMemo(
    () => (columns || []).map(toTanStackColumnDefinition),
    [columns]
  );

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: defaultRowsPerPage,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultRowsPerPage }));
  }, [defaultRowsPerPage]);

  const table = useReactTable({
    data: data || [],
    columns: columnDefs,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const leafHeaderGroup = headerGroups[headerGroups.length - 1];
  const headerCount = leafHeaderGroup?.headers?.length ?? 0;
  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const { pageIndex, pageSize } = table.getState().pagination;

  const mergedTableStyle = { ...styles.table };

  return (
    <div style={styles.mainBody(embedded)}>
      {(!leafHeaderGroup || !leafHeaderGroup.headers?.length) && (
        <Text i>No results in this table</Text>
      )}

      {leafHeaderGroup?.headers?.length > 0 && (
        <>
          <Table className="bg-content1 w-full min-w-0">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Table data"
                className="min-w-full"
                style={mergedTableStyle}
              >
                <Table.Header>
                  {leafHeaderGroup.headers.map((header, colIdx) => {
                    const sorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    const toggleHandler = header.column.getToggleSortingHandler();
                    return (
                      <Table.Column
                        key={header.id}
                        id={header.column.id}
                        isRowHeader={colIdx === 0}
                        style={{ whiteSpace: "unset" }}
                        className="max-w-[300px]"
                      >
                        <div className="flex items-center gap-1">
                          {canSort ? (
                            <LinkNext
                            className="cursor-pointer hover:text-secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleHandler(e);
                            }}
                            >
                              <Text className={"text-sm text-foreground-500"}>
                                {formatHeaderLabel(header)}
                              </Text>
                            </LinkNext>
                          ) : (
                            <Text className={"text-sm text-foreground-500"}>
                              {formatHeaderLabel(header)}
                            </Text>
                          )}
                          {sorted === "desc" && (<LuArrowDown size={14} />)}
                          {sorted === "asc" && (<LuArrowUp size={14} />)}
                        </div>
                      </Table.Column>
                    );
                  })}
                </Table.Header>
                <Table.Body>
                  {rows.length < 1 && (
                    <Table.Row id="no-results">
                      <Table.Cell colSpan={Math.max(1, headerCount)}>
                        No Results
                      </Table.Cell>
                    </Table.Row>
                  )}
                  {rows.map((row) => (
                    <Table.Row key={row.id} id={row.id}>
                      {row.getVisibleCells().map((cell) => {
                        const value = cell.getValue();
                        const strValue = value == null ? "" : String(value);
                        const isObject = (strValue && strValue.indexOf && strValue.indexOf("__cb_object") > -1) || false;
                        const isArray = (strValue && strValue.indexOf && strValue.indexOf("__cb_array") > -1) || false;
                        const objDetails = (isObject || isArray)
                          && JSON.parse(strValue.replace("__cb_object", "").replace("__cb_array", ""));

                        const isShort = isObject && Object.keys(objDetails).length === 1;

                        const accessorKey = cell.column.id;
                        return (
                          <Table.Cell
                            key={cell.id}
                            className={cn(
                              "max-w-[300px] truncate select-text",
                            )}
                            title={strValue}
                          >
                            {(!isObject && !isArray) && (
                              <div
                                title={strValue}
                                className="text-sm truncate"
                              >
                                <span
                                  style={{ cursor: "text", WebkitUserSelect: "text", whiteSpace: "nowrap" }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  role="presentation"
                                >
                                  {renderCellContent(value, accessorKey, columnsFormatting)}
                                </span>
                              </div>
                            )}
                            {(isObject || isArray) && (
                              <Popover aria-label="Object details">
                                <Popover.Trigger>
                                  <LinkNext>
                                    <Chip variant="primary">{(isShort && `${Object.values(objDetails)[0]}`) || "Collection"}</Chip>
                                  </LinkNext>
                                </Popover.Trigger>
                                <Popover.Content>
                                  <Popover.Dialog>
                                    <pre><code>{JSON.stringify(objDetails, null, 4)}</code></pre>
                                  </Popover.Dialog>
                                </Popover.Content>
                              </Popover>
                            )}
                          </Table.Cell>
                        );
                      })}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer>
              <div>
                <Row align="center">
                  <HeroPaginationNav
                    page={pageIndex + 1}
                    totalPages={Math.max(1, pageCount)}
                    onPageChange={(p) => table.setPageIndex(p - 1)}
                    size="sm"
                    ariaLabel="Table pagination"
                  />
                  <div className="w-1" />
                  <Dropdown aria-label="Select a page size">
                    <Dropdown.Trigger>
                      <Button variant="secondary" size="sm">
                        {(paginationOptions.find((option) => option.value === pageSize) || { text: `Show ${pageSize}` }).text}
                        <LuChevronDown size={16} />
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        variant="secondary"
                        selectionMode="single"
                        selectedKeys={[`${pageSize}`]}
                        onSelectionChange={(selection) => {
                          const next = Number(Object.values(selection)[0]);
                          table.setPageSize(next);
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
