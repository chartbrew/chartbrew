class TableView {
  getTableData(rawData) {
    const tabularData = {};

    Object.keys(rawData).forEach((key) => {
      const tab = { columns: [], data: [] };
      const dataset = rawData[key];
      dataset.forEach((item, index) => {
        if (index === 0) {
          Object.keys(item).forEach((k) => {
            tab.columns.push({ Header: k, accessor: k });
          });
        }
        tab.data.push(item);
      });

      tabularData[key] = tab;
    });

    return tabularData;
  }
}

module.exports = TableView;
