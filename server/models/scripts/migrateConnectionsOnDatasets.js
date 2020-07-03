const { QueryTypes } = require("sequelize");

const db = require("../models");

module.exports.up = () => {
  // when querying using the models, the fields you get back are only the ones in the current schema
  // so use raw queries to make sure that you get all the fields (from previous migration as well)
  return db.sequelize.query("SELECT id, connection_id FROM Chart", { type: QueryTypes.SELECT })
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
  return db.sequelize.query("SELECT * FROM Dataset", { type: QueryTypes.SELECT })
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
