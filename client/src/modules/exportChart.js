import { utils, writeFile } from "xlsx";

function sanitizeSheetName(value, fallback = "Chart Data") {
  return `${value || fallback}`.slice(0, 31).replace(/[\\/?*[\]:]/g, "").trim() || fallback;
}

function getUniqueSheetName(workbook, requestedName) {
  const base = sanitizeSheetName(requestedName);
  let name = base;
  let suffix = 2;
  while (workbook.SheetNames.includes(name)) {
    name = sanitizeSheetName(`${base.slice(0, 27)} ${suffix}`);
    suffix += 1;
  }
  return name;
}

function tableToWorksheet(table) {
  if (Array.isArray(table)) return utils.json_to_sheet(table);
  if (Array.isArray(table?.data) && Array.isArray(table?.columns)) {
    const headers = table.columns.map((column) => column.Header || column.accessor);
    const rows = table.data.map((row) => {
      return table.columns.map((column) => row[column.accessor] ?? "");
    });
    return utils.aoa_to_sheet([headers, ...rows]);
  }
  return null;
}

function appendChart(workbook, chart, namePrefix = "") {
  const tables = chart?.render?.tabularData || {};
  Object.entries(tables).forEach(([name, table]) => {
    const worksheet = tableToWorksheet(table);
    if (!worksheet) return;
    const requestedName = namePrefix ? `${namePrefix} ${name}` : name;
    utils.book_append_sheet(
      workbook,
      worksheet,
      getUniqueSheetName(workbook, requestedName || chart.name)
    );
  });
}

export function exportChartToExcel(chart, filename) {
  if (!canExportChart(chart)) throw new Error("No chart data available for export");
  const workbook = utils.book_new();
  appendChart(workbook, chart);
  writeFile(workbook, filename || `${chart.name || "chart"}-export.xlsx`);
  return true;
}

export function exportMultipleChartsToExcel(charts, filename = "charts-export.xlsx") {
  if (!Array.isArray(charts) || charts.length === 0) {
    throw new Error("No charts provided for export");
  }

  const workbook = utils.book_new();
  charts.forEach((chart) => appendChart(workbook, chart, chart.name));
  if (workbook.SheetNames.length === 0) {
    throw new Error("No valid chart data was found for export");
  }
  writeFile(workbook, filename);
  return true;
}

export function canExportChart(chart) {
  return Object.values(chart?.render?.tabularData || {}).some((table) => {
    return Array.isArray(table) || Array.isArray(table?.data);
  });
}
