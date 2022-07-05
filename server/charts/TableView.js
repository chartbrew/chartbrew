const _ = require("lodash");

const determineType = require("../modules/determineType");

class TableView {
  getTableData(data, datasets) {
    const rawData = data.configuration;
    const tabularData = {};

    Object.keys(rawData).forEach((key, datasetIndex) => {
      const tab = { columns: [], data: [] };
      const dataset = rawData[key];
      const excludedFields = datasets[datasetIndex].options.excludedFields || [];

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
          if (_.indexOf(excludedFields, k) !== -1) return;

          if (determineType(item[k]) === "object") {
            Object.keys(item[k]).forEach((n) => {
              const nestedType = determineType(item[k][n]);
              const headerKey = `${k}?${n}`;

              if (_.indexOf(excludedFields, headerKey) !== -1) return;

              if (nestedType === "object") {
                dataItem[`${k}?${n}`] = `__cb_object${JSON.stringify(item[k][n])}`;
              } else if (nestedType === "array") {
                dataItem[`${k}?${n}`] = `__cb_array${JSON.stringify(item[k][n])}`;
              } else {
                dataItem[`${k}?${n}`] = item[k][n];
              }
            });
          } else if (determineType(item[k]) === "array") {
            dataItem[k] = `__cb_array${JSON.stringify(item[k])}`;
          } else {
            dataItem[k] = item[k];
          }
        });
        tab.data.push(dataItem);
      });

      const { columnsOrder } = datasets[datasetIndex].options;

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

    // console.log("tabularData", tabularData);

    return {
      configuration: tabularData,
      conditionsOptions: data.conditionsOptions,
    };
  }
}

module.exports = TableView;
