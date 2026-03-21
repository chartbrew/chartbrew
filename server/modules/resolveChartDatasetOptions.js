const CDC_OPTION_FIELDS = [
  "xAxis",
  "xAxisOperation",
  "yAxis",
  "yAxisOperation",
  "dateField",
  "dateFormat",
  "conditions",
  "legend",
  "formula",
  "excludedFields",
  "sort",
  "columnsOrder",
  "order",
  "maxRecords",
  "goal",
  "datasetColor",
  "fillColor",
  "fill",
  "multiFill",
  "pointRadius",
  "configuration",
];

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toJSON === "function") return value.toJSON();
  return { ...value };
}

function getDatasetName(dataset) {
  const plainDataset = toPlainObject(dataset);
  return plainDataset.name || plainDataset.legend || null;
}

function resolveChartDatasetOptions(cdc, datasetOptions) {
  const plainDataset = toPlainObject(datasetOptions || cdc?.Dataset);
  const plainCdc = toPlainObject(cdc);
  const mergedOptions = { ...plainDataset };

  CDC_OPTION_FIELDS.forEach((field) => {
    if (plainCdc[field] !== undefined && plainCdc[field] !== null) {
      mergedOptions[field] = plainCdc[field];
    }
  });

  mergedOptions.id = plainCdc.id || mergedOptions.id;
  mergedOptions.cdc_id = plainCdc.id || mergedOptions.cdc_id || null;
  mergedOptions.dataset_id = plainCdc.dataset_id
    || mergedOptions.dataset_id || plainDataset.id || null;
  mergedOptions.name = getDatasetName(plainDataset);

  if ((plainCdc.legend === undefined || plainCdc.legend === null) && !mergedOptions.legend) {
    mergedOptions.legend = mergedOptions.name;
  }

  return mergedOptions;
}

module.exports = {
  getDatasetName,
  resolveChartDatasetOptions,
};
