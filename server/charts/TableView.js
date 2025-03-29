const moment = require("moment-timezone");
const determineType = require("../modules/determineType");

// Cache regex pattern
const checkNumbersOnly = /^\d+$/;

function formatValue(value, config, timezone) {
  if (!config || !config.type || !value) return value;

  if (config.type === "date" && determineType(value) === "date" && config.format) {
    const isTimestamp = value.toString().length === 10 && `${value}`.match(checkNumbersOnly);
    const momentObj = isTimestamp ? moment.utc(value, "X") : moment.utc(value);
    return timezone
      ? momentObj.tz(timezone).format(config.format)
      : momentObj.format(config.format);
  } else if ((config.type === "number" || config.type === "currency")
    && (determineType(value) === "number" || `${value}`.match(checkNumbersOnly))
  ) {
    let finalNumber = value;
    if (config.decimals > -1) {
      finalNumber = Number(value).toFixed(config.decimals);
    }
    if (config.thousandsSeparator) {
      finalNumber = finalNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    if (config.type === "currency" && config.symbol) {
      finalNumber = `${config.symbol}${finalNumber}`;
    }
    return finalNumber;
  }

  return value;
}

class TableView {
  getTableData(data, chartData, timezone = "") {
    const rawData = data.configuration;
    const tabularData = {};
    const datasetConfigs = chartData.chart?.ChartDatasetConfigs;

    Object.keys(rawData).forEach((key, datasetIndex) => {
      const tab = { columns: [], data: [] };
      const dataset = rawData[key];

      // Pre-compute dataset config and excluded fields
      const datasetConfig = datasetConfigs?.[datasetIndex];
      const baseExcludedFields = chartData.datasets[datasetIndex].options.excludedFields || [];
      const excludedFields = datasetConfig?.excludedFields?.length > 0
        ? [...baseExcludedFields, ...datasetConfig.excludedFields]
        : baseExcludedFields;

      const excludedSet = new Set(excludedFields);
      const columnMap = new Map(); // Header -> index
      const nestedColumnMap = new Set(); // `${k}?${n}`
      const columnsFormatting = datasetConfig?.configuration?.columnsFormatting;

      // Process items in chunks to avoid blocking the event loop
      const chunkSize = 1000;
      for (let i = 0; i < dataset.length; i += chunkSize) {
        const chunk = dataset.slice(i, i + chunkSize);

        chunk.forEach((item) => {
          const dataItem = {};

          Object.entries(item).forEach(([k, val]) => {
            if (excludedSet.has(k)) return;

            const type = determineType(val);

            if (type === "object" && val && !Array.isArray(val)) {
              Object.entries(val).forEach(([n, nestedVal]) => {
                const headerKey = `${k}?${n}`;
                if (excludedSet.has(headerKey)) return;

                const nestedType = determineType(nestedVal);

                if (!columnMap.has(k)) {
                  columnMap.set(k, tab.columns.length);
                  tab.columns.push({ Header: k, accessor: k, columns: [] });
                }

                const colIndex = columnMap.get(k);
                if (!nestedColumnMap.has(headerKey)) {
                  nestedColumnMap.add(headerKey);
                  if (!tab.columns[colIndex].columns) tab.columns[colIndex].columns = [];
                  tab.columns[colIndex].columns.push({ Header: n, accessor: headerKey });
                }

                const columnConfig = columnsFormatting?.[headerKey];
                if (nestedType === "object") {
                  dataItem[headerKey] = `__cb_object${JSON.stringify(nestedVal)}`;
                } else if (nestedType === "array") {
                  dataItem[headerKey] = `__cb_array${JSON.stringify(nestedVal)}`;
                } else {
                  dataItem[headerKey] = formatValue(nestedVal, columnConfig, timezone);
                }
              });
            } else if (type === "array") {
              dataItem[k] = `__cb_array${JSON.stringify(val)}`;

              if (!columnMap.has(k)) {
                columnMap.set(k, tab.columns.length);
                tab.columns.push({ Header: k, accessor: k });
              }
            } else {
              const columnConfig = columnsFormatting?.[k];
              dataItem[k] = formatValue(val, columnConfig, timezone);

              if (!columnMap.has(k)) {
                columnMap.set(k, tab.columns.length);
                tab.columns.push({ Header: k, accessor: k });
              }
            }
          });

          tab.data.push(dataItem);
        });
      }

      // Column order sorting
      const columnsOrder = datasetConfig?.columnsOrder?.length > 0
        ? datasetConfig.columnsOrder
        : chartData.datasets[datasetIndex].options.columnsOrder;

      if (columnsOrder?.length > 0) {
        const columnMapByHeader = new Map(tab.columns.map((col) => [col.Header, col]));
        const orderedColumns = [];

        columnsOrder.forEach((column) => {
          if (columnMapByHeader.has(column)) {
            orderedColumns.push(columnMapByHeader.get(column));
            columnMapByHeader.delete(column);
          }
        });

        tab.columns = orderedColumns.concat(Array.from(columnMapByHeader.values()));
      }

      tabularData[key] = tab;
    });

    return {
      configuration: tabularData,
      conditionsOptions: data.conditionsOptions,
    };
  }
}

module.exports = TableView;
