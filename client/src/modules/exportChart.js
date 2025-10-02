import { utils, writeFile } from "xlsx";

export function exportChartToExcel(chart, filename) {
  if (!chart?.chartData) {
    throw new Error("No chart data available for export");
  }

  const workbook = utils.book_new();
  const chartType = chart.type;
  let sheetName = chart.name || "Chart Data";
  
  // Sanitize sheet name (Excel has a 31 character limit and doesn't allow special characters)
  sheetName = sheetName.substring(0, 31).replace(/[^a-zA-Z0-9 ]/g, "");
  
  try {
    if (chartType === "table") {
      _addTableChartToWorkbook(workbook, chart.chartData, sheetName);
    } else if (chartType === "matrix") {
      _addMatrixChartToWorkbook(workbook, chart.chartData, sheetName);
    } else {
      _addRegularChartToWorkbook(workbook, chart.chartData, sheetName, chartType);
    }

    // Download the file
    const fileName = filename || `${chart.name || "chart"}-export.xlsx`;
    writeFile(workbook, fileName);
    
    return true;
  } catch (error) {
    console.error("Error exporting chart:", error);
    throw new Error(`Failed to export chart: ${error.message}`);
  }
}

function _addTableChartToWorkbook(workbook, chartData, sheetName) {
  // Table charts have a different structure: { "Table Name": { columns: [], data: [] } }
  const tableKeys = Object.keys(chartData);
  
  if (tableKeys.length === 0) {
    throw new Error("No table data found");
  }

  tableKeys.forEach((tableKey, index) => {
    const tableData = chartData[tableKey];
    if (!tableData.columns || !tableData.data) {
      return; // Skip invalid table data
    }

    // Create sheet name for multiple tables
    const currentSheetName = tableKeys.length > 1 
      ? `${sheetName.substring(0, 25)} ${index + 1}` 
      : sheetName;

    // Extract headers from columns
    const headers = tableData.columns.map(col => col.Header || col.accessor);
    
    // Create worksheet data starting with headers
    const worksheetData = [headers];
    
    // Add data rows
    tableData.data.forEach(row => {
      const rowData = tableData.columns.map(col => {
        const value = row[col.accessor];
        return value !== undefined && value !== null ? value : "";
      });
      worksheetData.push(rowData);
    });

    // Create worksheet and add to workbook
    const worksheet = utils.aoa_to_sheet(worksheetData);
    utils.book_append_sheet(workbook, worksheet, currentSheetName);
  });
}

function _addRegularChartToWorkbook(workbook, chartData, sheetName) {
  const { data, growth, goals } = chartData;
  
  if (!data || !data.labels || !data.datasets) {
    throw new Error("Invalid chart data structure");
  }

  // Prepare the main data
  const worksheetData = [];
  
  // Add headers
  const headers = ["Label"];
  data.datasets.forEach(dataset => {
    headers.push(dataset.label || "Data");
  });
  worksheetData.push(headers);

  // Add data rows
  data.labels.forEach((label, index) => {
    const row = [label];
    data.datasets.forEach(dataset => {
      const value = dataset.data[index];
      row.push(value !== undefined && value !== null ? value : "");
    });
    worksheetData.push(row);
  });

  // Add growth data if available
  if (growth && Array.isArray(growth) && growth.length > 0) {
    worksheetData.push([]); // Empty row for separation
    worksheetData.push(["Growth Analysis"]);
    worksheetData.push(["Metric", "Value", "Comparison (%)", "Status"]);
    
    growth.forEach(growthItem => {
      worksheetData.push([
        growthItem.label || "",
        growthItem.value || "",
        growthItem.comparison || "",
        growthItem.status || ""
      ]);
    });
  }

  // Add goals data if available
  if (goals && Array.isArray(goals) && goals.length > 0) {
    worksheetData.push([]); // Empty row for separation
    worksheetData.push(["Goals"]);
    worksheetData.push(["Goal", "Target", "Current", "Progress"]);
    
    goals.forEach(goal => {
      worksheetData.push([
        goal.label || "",
        goal.target || "",
        goal.current || "",
        goal.progress || ""
      ]);
    });
  }

  // Create worksheet and add to workbook
  const worksheet = utils.aoa_to_sheet(worksheetData);
  
  // Auto-size columns
  const colWidths = [];
  if (worksheetData.length > 0) {
    for (let i = 0; i < worksheetData[0].length; i++) {
      let maxWidth = 10;
      for (let j = 0; j < worksheetData.length; j++) {
        if (worksheetData[j][i]) {
          const cellLength = String(worksheetData[j][i]).length;
          maxWidth = Math.max(maxWidth, Math.min(cellLength, 50));
        }
      }
      colWidths.push({ wch: maxWidth });
    }
    worksheet["!cols"] = colWidths;
  }

  utils.book_append_sheet(workbook, worksheet, sheetName);
}

function _addMatrixChartToWorkbook(workbook, chartData, sheetName) {
  const { data } = chartData;
  if (!data || !data.datasets || !Array.isArray(data.datasets) || !data.datasets[0]) {
    throw new Error("Invalid matrix chart data structure");
  }

  const dataset = data.datasets[0];
  const points = dataset.data || [];
  const xLabels = data.labels || [];

  // Attempt to read y labels from options if provided
  // We export as a flat table: Column (x), Row (y), Value
  const worksheetData = [["Column", "Row", "Value"]];

  points.forEach((p) => {
    // x and y are indices in category scales for matrix
    const xLabel = xLabels[p.x] !== undefined ? xLabels[p.x] : p.x;
    const yLabel = p.y;
    worksheetData.push([xLabel, yLabel, p.v]);
  });

  const worksheet = utils.aoa_to_sheet(worksheetData);
  utils.book_append_sheet(workbook, worksheet, sheetName);
}

/**
 * Exports multiple charts to a single Excel file with multiple sheets
 * @param {Array} charts - Array of chart objects
 * @param {string} filename - Filename for the Excel file
 */
export function exportMultipleChartsToExcel(charts, filename = "charts-export.xlsx") {
  if (!Array.isArray(charts) || charts.length === 0) {
    throw new Error("No charts provided for export");
  }

  const workbook = utils.book_new();
  
  charts.forEach((chart, index) => {
    if (!chart?.chartData) {
      console.warn(`Chart ${index + 1} has no data, skipping`);
      return;
    }

    let sheetName = chart.name || `Chart ${index + 1}`;
    sheetName = sheetName.substring(0, 31).replace(/[^a-zA-Z0-9 ]/g, "");
    
    // Ensure unique sheet names
    let finalSheetName = sheetName;
    let counter = 1;
    while (workbook.SheetNames.includes(finalSheetName)) {
      finalSheetName = `${sheetName.substring(0, 28)} ${counter}`;
      counter++;
    }

    try {
      if (chart.type === "table") {
        _addTableChartToWorkbook(workbook, chart.chartData, finalSheetName);
      } else {
        _addRegularChartToWorkbook(workbook, chart.chartData, finalSheetName, chart.type);
      }
    } catch (error) {
      console.error(`Error adding chart ${finalSheetName} to workbook:`, error);
    }
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("No valid chart data was found for export");
  }

  writeFile(workbook, filename);
  return true;
}

/**
 * Validates if a chart can be exported
 * @param {Object} chart - Chart object to validate
 * @returns {boolean} - Whether the chart can be exported
 */
export function canExportChart(chart) {
  if (!chart || !chart.chartData) {
    return false;
  }

  if (chart.type === "table") {
    const tableKeys = Object.keys(chart.chartData);
    return tableKeys.length > 0 && 
           tableKeys.some(key => chart.chartData[key].columns && chart.chartData[key].data);
  }

  return !!(chart.chartData.data && chart.chartData.data.labels && chart.chartData.data.datasets);
}
