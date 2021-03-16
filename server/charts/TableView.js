const _ = require("lodash");

const determineType = require("../modules/determineType");

class TableView {
  getTableData(rawData) {
    const tabularData = {};

    Object.keys(rawData).forEach((key) => {
      const tab = { columns: [], data: [] };
      const dataset = rawData[key];
      dataset.forEach((item, index) => {
        if (index === 0) {
          Object.keys(item).forEach((k) => {
            if (determineType(item[k]) === "object") {
              // handle nested objects (only one level)
              const nested = item[k];
              Object.keys(nested).forEach((n) => {
                const headerIndex = _.findIndex(tab.columns, { Header: k });
                if (headerIndex === -1) {
                  tab.columns.push({ Header: k, columns: [{ Header: n, accessor: `${k}?${n}` }] });
                } else {
                  tab.columns[headerIndex].columns.push({ Header: n, accessor: `${k}?${n}` });
                }
              });
            } else {
              tab.columns.push({ Header: k, accessor: k });
            }
          });
        }

        const dataItem = {};
        Object.keys(item).forEach((k) => {
          if (determineType(item[k]) === "object") {
            Object.keys(item[k]).forEach((n) => {
              const nestedType = determineType(item[k][n]);
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

      tabularData[key] = tab;
    });

    return tabularData;
  }
}

module.exports = TableView;
