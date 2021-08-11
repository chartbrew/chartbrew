const _ = require("lodash");

const determineType = require("../modules/determineType");

class TableView {
  getTableData(rawData, datasets) {
    const tabularData = {};

    const finalData = {};
    // transform the object in case there are any groupings
    Object.keys(rawData).forEach((key) => {
      const dataset = rawData[key];
      finalData[key] = [];

      dataset.forEach((item) => {
        const newItem = item;
        if (newItem.questions
          && newItem.questions.title
          && newItem.questions.response
          && newItem.questions.response.text
        ) {
          newItem[`__cb_group${newItem.questions.title}`] = newItem.questions.response.text;
        }

        finalData[key].push(newItem);
      });
    });

    Object.keys(finalData).forEach((key, datasetIndex) => {
      const tab = { columns: [], data: [] };
      const dataset = finalData[key];
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

      tabularData[key] = tab;
    });

    return tabularData;
  }
}

module.exports = TableView;
