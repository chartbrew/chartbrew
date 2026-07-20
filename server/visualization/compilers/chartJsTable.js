const TableView = require("../../charts/TableView");
const { applyLegacyTabularOptions } = require("../tabular");

function getBindingId(dataset) {
  return dataset?.options?.cdc_id ?? dataset?.options?.id ?? dataset?.bindingId ?? null;
}

function compileChartJsTable({
  chart,
  conditionsOptions,
  datasets,
  frame,
  timezone,
  visualization,
}) {
  const rawData = {};
  const selectedDatasets = [];
  const configs = [];

  frame.layers.forEach((layerFrame, index) => {
    const layer = visualization.layers.find((item) => item.id === layerFrame.id);
    const dataset = datasets.find((item) => `${getBindingId(item)}` === `${layer.bindingId}`);
    const baseName = layer.name || dataset?.options?.legend || `Dataset ${index + 1}`;
    let name = baseName;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(rawData, name)) {
      name = `${baseName} ${suffix}`;
      suffix += 1;
    }

    rawData[name] = applyLegacyTabularOptions(layerFrame.rows, dataset?.options);
    selectedDatasets.push(dataset || { options: {} });
    configs.push({
      columnsOrder: layer.options?.columnsOrder || dataset?.options?.columnsOrder || [],
      configuration: layer.options?.configuration || dataset?.options?.configuration || {},
      excludedFields: layer.options?.excludedFields || dataset?.options?.excludedFields || [],
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
    frame,
    isTimeseries: false,
  };
}

module.exports = {
  compileChartJsTable,
};
