function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = async (queryInterface) => {
  const dialect = queryInterface.sequelize.getDialect();
  const tableNames = {
    dataset: dialect === "postgres" ? "\"Dataset\"" : "Dataset",
    cdc: dialect === "postgres" ? "\"ChartDatasetConfig\"" : "ChartDatasetConfig",
  };

  const datasets = await queryInterface.sequelize.query(
    `SELECT id, name, legend, xAxis, xAxisOperation, yAxis, yAxisOperation, dateField, dateFormat, conditions, formula
     FROM ${tableNames.dataset}`,
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  );

  const cdcs = await queryInterface.sequelize.query(
    `SELECT id, dataset_id, xAxis, xAxisOperation, yAxis, yAxisOperation, dateField, dateFormat, conditions, formula, legend
     FROM ${tableNames.cdc}`,
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  );

  const datasetMap = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const updatePromises = [];

  datasets.forEach((dataset) => {
    if (isBlank(dataset.name) && !isBlank(dataset.legend)) {
      updatePromises.push(
        queryInterface.bulkUpdate("Dataset", { name: dataset.legend }, { id: dataset.id })
      );
    }
  });

  cdcs.forEach((cdc) => {
    const dataset = datasetMap.get(cdc.dataset_id);

    if (!dataset) return;

    const updates = {};

    if (isBlank(cdc.xAxis) && !isBlank(dataset.xAxis)) {
      updates.xAxis = dataset.xAxis;
    }
    if (isBlank(cdc.xAxisOperation) && !isBlank(dataset.xAxisOperation)) {
      updates.xAxisOperation = dataset.xAxisOperation;
    }
    if (isBlank(cdc.yAxis) && !isBlank(dataset.yAxis)) {
      updates.yAxis = dataset.yAxis;
    }
    if (isBlank(cdc.yAxisOperation) && !isBlank(dataset.yAxisOperation)) {
      updates.yAxisOperation = dataset.yAxisOperation;
    }
    if (isBlank(cdc.dateField) && !isBlank(dataset.dateField)) {
      updates.dateField = dataset.dateField;
    }
    if (isBlank(cdc.dateFormat) && !isBlank(dataset.dateFormat)) {
      updates.dateFormat = dataset.dateFormat;
    }
    if (isBlank(cdc.conditions) && !isBlank(dataset.conditions)) {
      updates.conditions = dataset.conditions;
    }
    if (isBlank(cdc.formula) && !isBlank(dataset.formula)) {
      updates.formula = dataset.formula;
    }
    if (isBlank(cdc.legend) && !isBlank(dataset.legend)) {
      updates.legend = dataset.legend;
    }

    if (Object.keys(updates).length > 0) {
      updatePromises.push(
        queryInterface.bulkUpdate("ChartDatasetConfig", updates, { id: cdc.id })
      );
    }
  });

  return throttlePromises(updatePromises, 20, 0);
};

module.exports.down = async () => {
  // no-op; the schema rollback removes the columns
};
