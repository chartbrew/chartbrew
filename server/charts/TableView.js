const _ = require("lodash");
const moment = require("moment-timezone");

const determineType = require("../modules/determineType");

function formatValue(value, config, timezone) {
  if (!config || !config.type || !value) return value;

  const checkNumbersOnly = /^\d+$/;

  if (config.type === "date" && determineType(value) === "date") {
    if (value.toString().length === 10 && `${value}`.match(checkNumbersOnly)) {
      return timezone ? moment.utc(value, "X").tz(timezone).format(config.format || "")
        : moment.utc(value, "X").format(config.format);
    } else {
      return timezone ? moment.utc(value).tz(timezone).format(config.format || "")
        : moment.utc(value).format(config.format);
    }
  } else if ((config.type === "number" || config.type === "currency")
    && (determineType(value) === "number" || `${value}`.match(checkNumbersOnly))
  ) {
    let finalNumber = value;
    // check if decimals are needed
    if (config.decimals > -1) {
      finalNumber = Number(value).toFixed(config.decimals);
    }

    // add thousands separator
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
      let excludedFields = chartData.datasets[datasetIndex].options.excludedFields || [];

      if (datasetConfigs[datasetIndex]?.excludedFields?.length > 0) {
        excludedFields = excludedFields.concat(
          datasetConfigs[datasetIndex].excludedFields,
        );
      }

      dataset.forEach((item) => {
        Object.keys(item).forEach((k) => {
          if (_.indexOf(excludedFields, k) !== -1) return;
          if (determineType(item[k]) === "object") {
            // handle nested objects (only one level)
            const nested = item[k];
            Object.keys(nested).forEach((n) => {
              const headerIndex = _.findIndex(tab.columns, { Header: k });
              const headerKey = `${k}?${n}`;

              if (_.indexOf(excludedFields, headerKey) !== -1) return;

              if (headerIndex === -1) {
                tab.columns.push({
                  Header: k, accessor: k, columns: [{ Header: n, accessor: headerKey }]
                });
              } else if (_.findIndex(tab.columns[headerIndex].columns, { Header: n }) === -1) {
                if (!tab.columns[headerIndex].columns) {
                  tab.columns[headerIndex].columns = [];
                }
                tab.columns[headerIndex].columns.push({ Header: n, accessor: headerKey });
              }
            });
          } else if (_.findIndex(tab.columns, { Header: k }) === -1) {
            tab.columns.push({ Header: k, accessor: k });
          }
        });

        const dataItem = {};
        Object.keys(item).forEach((k) => {
          let columnConfig = datasetConfigs[datasetIndex]?.Dataset
            ?.configuration?.columnsFormatting?.[k];

          if (_.indexOf(excludedFields, k) !== -1) return;

          if (determineType(item[k]) === "object") {
            Object.keys(item[k]).forEach((n) => {
              columnConfig = datasetConfigs[datasetIndex]?.Dataset
                ?.configuration?.columnsFormatting?.[`${k}?${n}`];

              const nestedType = determineType(item[k][n]);
              const headerKey = `${k}?${n}`;

              if (_.indexOf(excludedFields, headerKey) !== -1) return;

              if (nestedType === "object") {
                dataItem[`${k}?${n}`] = `__cb_object${JSON.stringify(item[k][n])}`;
              } else if (nestedType === "array") {
                dataItem[`${k}?${n}`] = `__cb_array${JSON.stringify(item[k][n])}`;
              } else {
                dataItem[`${k}?${n}`] = formatValue(item[k][n], columnConfig, timezone);
              }
            });
          } else if (determineType(item[k]) === "array") {
            dataItem[k] = `__cb_array${JSON.stringify(item[k])}`;
          } else {
            dataItem[k] = formatValue(item[k], columnConfig, timezone);
          }
        });
        tab.data.push(dataItem);
      });

      let { columnsOrder } = chartData.datasets[datasetIndex].options;

      if (datasetConfigs[datasetIndex]?.columnsOrder?.length > 0) {
        columnsOrder = datasetConfigs[datasetIndex].columnsOrder;
      }

      if (columnsOrder && columnsOrder.length > 0) {
        const orderedColumns = [];
        const notFoundColumns = [];
        columnsOrder.forEach((column) => {
          const columnIndex = _.findIndex(tab.columns, { Header: column });
          if (columnIndex !== -1) {
            orderedColumns.push(tab.columns[columnIndex]);
          }
        });

        // now check if which columns from tab.columns are not in columnsOrder
        tab.columns.forEach((column) => {
          if (_.indexOf(columnsOrder, column.Header) === -1) {
            notFoundColumns.push(column);
          }
        });

        tab.columns = orderedColumns.concat(notFoundColumns);
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
