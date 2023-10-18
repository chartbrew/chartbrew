const uuid = require("uuid/v4");
const db = require("../models");

module.exports.up = async (queryInterface) => {
  const [datasets] = await queryInterface.sequelize.query(`
    SELECT d.*, c.id as c_id
    FROM Dataset AS d
    JOIN Chart AS c ON c.id = d.chart_id
  `);

  const chartDatasests = [];
  datasets.forEach((dataset) => {
    chartDatasests.push({
      id: uuid(),
      chart_id: dataset.c_id,
      dataset_id: dataset.id,
      formula: dataset.formula,
      datasetColor: dataset.datasetColor,
      fillColor: dataset.fillColor,
      fill: dataset.fill,
      multiFill: dataset.multiFill,
      legend: dataset.legend,
      pointRadius: dataset.pointRadius,
      excludedFields: dataset.excludedFields,
      sort: dataset.sort,
      columnsOrder: dataset.columnsOrder,
      order: dataset.order,
      maxRecords: dataset.maxRecords,
      goal: dataset.goal,
    });
  });

  await db.ChartDataset.bulkCreate(chartDatasests);
};

module.exports.down = async () => {
  // do nothing
};
