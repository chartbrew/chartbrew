const TableView = require("../../charts/TableView");
const { applyLegacyTabularOptions } = require("../tabular");

function compileChartJsTable({
  chart,
  conditionsOptions,
  preparedData,
  timezone,
  visualization,
}) {
  const rawData = {};
  const selectedDatasets = [];
  const configs = [];

  preparedData.results.forEach((result, index) => {
    const layer = visualization.layers.find((item) => item.id === result.id);
    const sourceOptions = result.sourceOptions || {};
    const baseName = layer.name || sourceOptions.legend || `Dataset ${index + 1}`;
    let name = baseName;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(rawData, name)) {
      name = `${baseName} ${suffix}`;
      suffix += 1;
    }

    rawData[name] = applyLegacyTabularOptions(result.rows, sourceOptions);
    selectedDatasets.push({ options: sourceOptions });
    configs.push({
      columnsOrder: layer.options?.columnsOrder || sourceOptions.columnsOrder || [],
      configuration: layer.options?.configuration || sourceOptions.configuration || {},
      excludedFields: layer.options?.excludedFields || sourceOptions.excludedFields || [],
      id: layer.bindingId,
      legend: name,
    });
  });

  const tableView = new TableView();
  const compiled = tableView.getTableData({
    conditionsOptions,
    configuration: rawData,
  }, {
    chart: {
      ...chart,
      ChartDatasetConfigs: configs,
    },
    datasets: selectedDatasets,
  }, timezone);

  return {
    ...compiled,
    preparedData,
    isTimeseries: false,
  };
}

module.exports = {
  compileChartJsTable,
};
