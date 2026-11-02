import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  EmptyState, Skeleton, Table, Tabs,
} from "@heroui/react";

import HeroPaginationNav from "../../../components/HeroPaginationNav";
import { normalizeChartTables } from "../chartStudioState";

const ROWS_PER_PAGE = 25;

function CellValue({ value }) {
  if (value === null) return <span className="text-muted">Null</span>;
  if (value === undefined) return <span aria-label="No value">&nbsp;</span>;
  if (value === "") return <span aria-label="Empty value">&nbsp;</span>;
  if (typeof value === "object") {
    return <span className="block max-w-80 truncate" title={JSON.stringify(value)}>{JSON.stringify(value)}</span>;
  }
  return `${value}`;
}

CellValue.propTypes = {
  value: PropTypes.any,
};

function ChartDataView({ loading, tabularData }) {
  const normalized = useMemo(() => normalizeChartTables(tabularData), [tabularData]);
  const [activeTable, setActiveTable] = useState(normalized.tables[0]?.name || "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!normalized.tables.some((table) => table.name === activeTable)) {
      setActiveTable(normalized.tables[0]?.name || "");
    }
  }, [activeTable, normalized.tables]);

  useEffect(() => {
    setPage(1);
  }, [activeTable, tabularData]);

  if (loading) {
    return (
      <div className="flex h-full min-h-56 flex-col gap-3 p-4" aria-label="Updating chart data" role="status">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="min-h-48 flex-1 rounded-2xl" />
      </div>
    );
  }

  if (!normalized.available) {
    return (
      <EmptyState className="flex h-full min-h-56 items-center justify-center p-6 text-center">
        <span className="text-sm text-muted">Data is not available for this chart.</span>
      </EmptyState>
    );
  }

  if (normalized.tables.length === 0) {
    return (
      <EmptyState className="flex h-full min-h-56 items-center justify-center p-6 text-center">
        <span className="text-sm text-muted">No chart data was returned.</span>
      </EmptyState>
    );
  }

  const table = normalized.tables.find((item) => item.name === activeTable) || normalized.tables[0];
  const totalPages = Math.max(1, Math.ceil(table.rows.length / ROWS_PER_PAGE));
  const visibleRows = table.rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {normalized.tables.length > 1 ? (
          <Tabs
            aria-label="Chart data tables"
            selectedKey={table.name}
            onSelectionChange={(key) => setActiveTable(`${key}`)}
            size="sm"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Chart data tables">
                {normalized.tables.map((item) => (
                  <Tabs.Tab id={item.name} key={item.name}>
                    <span className="max-w-56 truncate" title={item.name}>{item.name}</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        ) : (
          <h2 className="min-w-0 truncate text-sm font-semibold" title={table.name}>{table.name}</h2>
        )}
        <span className="text-xs text-muted">{`${table.rows.length} rows`}</span>
      </div>

      <Table className="min-h-0 overflow-hidden rounded-3xl border border-divider shadow-none">
        <Table.ScrollContainer className="min-h-0 overflow-auto">
          <Table.Content aria-label={`${table.name} chart data`} className="min-w-full">
            <Table.Header>
              {table.columns.map((column, index) => (
                <Table.Column
                  id={column.key}
                  isRowHeader={index === 0}
                  key={column.key}
                  textValue={column.label}
                >
                  {column.label}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body renderEmptyState={() => (
              <EmptyState className="flex h-full min-h-40 items-center justify-center text-center">
                <span className="text-sm text-muted">No rows were returned.</span>
              </EmptyState>
            )}>
              {visibleRows.map((row, rowIndex) => (
                <Table.Row id={`${page}-${rowIndex}`} key={`${page}-${rowIndex}`}>
                  {table.columns.map((column) => (
                    <Table.Cell key={column.key}>
                      <CellValue value={row?.[column.key]} />
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {totalPages > 1 ? (
        <div className="shrink-0">
          <HeroPaginationNav
            ariaLabel={`${table.name} data pagination`}
            onPageChange={setPage}
            page={page}
            size="sm"
            totalPages={totalPages}
          />
        </div>
      ) : null}
    </div>
  );
}

ChartDataView.propTypes = {
  loading: PropTypes.bool,
  tabularData: PropTypes.object,
};

ChartDataView.defaultProps = {
  loading: false,
  tabularData: undefined,
};

export default ChartDataView;
