const db = require("../models");

module.exports.up = () => {
  return db.Chart.findAll({
    attributes: ["id"],
    include: [{ model: db.Dataset, attributes: ["id"] }],
  })
    .then((charts) => {
      const updatePromises = [];
      charts.forEach((chart) => {
        if (chart.Datasets) {
          chart.Datasets.forEach((dataset, index) => {
            updatePromises.push(
              db.Dataset.update({ order: index }, { where: { id: dataset.id } }),
            );
          });
        }
      });

      return Promise.all(updatePromises);
    });
};
