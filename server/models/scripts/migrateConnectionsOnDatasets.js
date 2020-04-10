const db = require("../models");

module.exports.up = () => {
  return db.Chart.findAll()
    .then((charts) => {
      if (!charts || charts.length < 1) return Promise.resolve("done");

      // update all the datasets with their corresponding chart's connection
      const updatePromises = [];
      charts.map((chart) => {
        const updatePromise = db.Dataset.update(
          { connection_id: chart.connection_id },
          { where: { chart_id: chart.id } }
        );

        updatePromises.push(updatePromise);
        return chart;
      });

      return Promise.all(updatePromises);
    })
    .catch((err) => {
      return err;
    });
};

module.exports.down = () => {
  return db.Dataset.findAll()
    .then((datasets) => {
      if (!datasets || datasets.length < 1) return Promise.resolve("done");

      const updatePromises = [];
      datasets.map((dataset) => {
        const updatePromise = db.Chart.update(
          { connection_id: dataset.connection_id },
          { where: { id: dataset.chart_id } },
        );
        updatePromises.push(updatePromise);
        return dataset;
      });

      return Promise.all(updatePromises);
    })
    .catch((err) => {
      return err;
    });
};
