function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports.up = async (queryInterface) => {
  const dialect = queryInterface.sequelize.getDialect();
  let cdcs;

  if (dialect === "mysql") {
    cdcs = await queryInterface.sequelize.query(
      "SELECT id, dataset_id FROM ChartDatasetConfig",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
  } else if (dialect === "postgres") {
    cdcs = await queryInterface.sequelize.query(
      "SELECT id, dataset_id FROM \"ChartDatasetConfig\"",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
  }

  let alerts = [];
  try {
    if (dialect === "mysql") {
      alerts = await queryInterface.sequelize.query(
        "SELECT id, dataset_id FROM Alert",
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
    } else if (dialect === "postgres") {
      alerts = await queryInterface.sequelize.query(
        "SELECT id, dataset_id FROM \"Alert\"",
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
    }
  } catch (e) {
    // do nothing
  }

  // populate cdc_id for all alerts where dataset_id matches
  const updatePromises = [];

  alerts.forEach((alert) => {
    const cdc = cdcs.find((cdc) => cdc.dataset_id === alert.dataset_id);

    if (cdc) {
      if (dialect === "mysql") {
        updatePromises.push(
          queryInterface.sequelize.query(
            `UPDATE Alert SET cdc_id = '${cdc.id}' WHERE id = '${alert.id}'`
          )
        );
      } else if (dialect === "postgres") {
        updatePromises.push(
          queryInterface.sequelize.query(
            `UPDATE "Alert" SET cdc_id = '${cdc.id}' WHERE id = '${alert.id}'`
          )
        );
      }
    }
  });

  return throttlePromises(updatePromises, 5, 0);
};

module.exports.down = async () => {
  // no need to do anything here because the columns will be dropped
};
