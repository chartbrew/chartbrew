const db = require("../models");

function throttlePromises(promises, chunkSize, index) {
  if (index >= promises.length) return Promise.resolve();

  const promisesChunk = promises.slice(index, index + chunkSize);

  return Promise.all(promisesChunk)
    .then(() => throttlePromises(promises, chunkSize, index + chunkSize))
    .catch(() => throttlePromises(promises, chunkSize, index + chunkSize));
}

module.exports = {
  async up() {
    const chartDatasetConfigs = await db.ChartDatasetConfig.findAll();

    const updates = [];
    chartDatasetConfigs.forEach((chartDatasetConfig) => {
      let newExcludedFields = chartDatasetConfig.excludedFields;
      let newFillColor = chartDatasetConfig.fillColor;
      let newColumnsOrder = chartDatasetConfig.columnsOrder;

      try {
        newExcludedFields = JSON.parse(chartDatasetConfig.excludedFields);
      } catch (e) {
        //
      }

      try {
        newFillColor = JSON.parse(chartDatasetConfig.fillColor);
      } catch (e) {
        //
      }

      try {
        newColumnsOrder = JSON.parse(chartDatasetConfig.columnsOrder);
      } catch (e) {
        //
      }

      updates.push(
        db.ChartDatasetConfig.update(
          {
            excludedFields: newExcludedFields,
            fillColor: newFillColor,
            columnsOrder: newColumnsOrder,
          },
          { where: { id: chartDatasetConfig.id } },
        ),
      );
    });

    return throttlePromises(updates, 5, 0);
  },

  async down() {
    //
  }
};
