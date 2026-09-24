export function getChartStudioMode(width) {
  if (width >= 1600) return "wide";
  if (width <= 900) return "mobile";
  return "compact";
}

export function getChartStudioPreviewState(width, selectedView) {
  const mode = getChartStudioMode(width);
  return {
    mode,
    settingsPlacement: mode === "wide" ? "right" : "bottom",
    showChart: mode === "wide" || selectedView === "chart",
    showData: mode === "wide" || selectedView === "data",
    showTabs: mode !== "wide",
  };
}

function flattenColumns(columns = []) {
  return columns.flatMap((column) => {
    if (Array.isArray(column?.columns) && column.columns.length > 0) {
      return flattenColumns(column.columns);
    }
    const key = column?.accessor ?? column?.id ?? column?.Header;
    if (key === undefined || key === null) return [];
    return [{ key: `${key}`, label: `${column?.Header ?? key}` }];
  });
}

function columnsFromRows(rows) {
  const keys = [];
  const seen = new Set();
  rows.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    Object.keys(row).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      keys.push(key);
    });
  });
  return keys.map((key) => ({ key, label: key }));
}

export function normalizeChartTables(tabularData) {
  if (tabularData === undefined || tabularData === null) {
    return { available: false, tables: [] };
  }
  if (typeof tabularData !== "object" || Array.isArray(tabularData)) {
    return { available: true, tables: [] };
  }

  const tables = Object.entries(tabularData).flatMap(([name, table]) => {
    const rows = Array.isArray(table) ? table : table?.data;
    if (!Array.isArray(rows)) return [];
    const columns = Array.isArray(table?.columns)
      ? flattenColumns(table.columns)
      : columnsFromRows(rows);
    return [{ name, rows, columns }];
  });

  return { available: true, tables };
}

export function didAiUpdateActiveChart(orchestration, chartId) {
  const updated = orchestration?.workSummary?.some((operation) => (
    operation.name === "update_chart" && operation.status === "complete"
  ));
  if (!updated) return false;
  return orchestration.chartPreviews?.some((preview) => `${preview.chartId}` === `${chartId}`) ?? false;
}
