const db = require("../models");

module.exports.up = () => {
  return db.Chart.findAll({
    include: [{ model: db.Dataset, include: [{ model: db.DataRequest }] }],
  })
    .then((charts) => {
      const updatePromises = [];
      charts.map((chart) => {
        // get all datasets and then create a request object or update an existing apiRequest
        if (chart.Datasets && chart.Datasets.length > 0) {
          chart.Datasets.map((dataset) => {
            updatePromises.push(
              db.DataRequest.findOrCreate({
                where: { chart_id: chart.id },
                defaults: {
                  dataset_id: dataset.id,
                  query: chart.query,
                  pagination: chart.pagination,
                  items: chart.items,
                  itemsLimit: chart.itemsLimit,
                  offset: chart.offset,
                }
              })
                .then(() => {
                  return db.DataRequest.update({
                    dataset_id: dataset.id,
                    query: chart.query,
                    pagination: chart.pagination,
                    items: chart.items,
                    itemsLimit: chart.itemsLimit,
                    offset: chart.offset,
                  }, { where: { chart_id: chart.id } });
                }),
            );

            return dataset;
          });
        }

        return chart;
      });

      return Promise.all(updatePromises);
    })
    .then((results) => {
      return results;
    })
    .catch((err) => {
      return err;
    });
};

module.exports.down = () => {
  return db.Chart.findAll({
    include: [{ model: db.Dataset, include: [{ model: db.DataRequest }] }],
  })
    .then((charts) => {
      const updatePromises = [];
      charts.map((chart) => {
        if (chart.Datasets && chart.Datasets[0]) {
          updatePromises.push(
            db.Chart.update({ where: { id: chart.id } }, {
              query: chart.Datasets[0].query,
              pagination: chart.Datasets[0].pagination,
              items: chart.Datasets[0].items,
              itemsLimit: chart.Datasets[0].itemsLimit,
              offset: chart.Datasets[0].offset,
            })
          );

          updatePromises.push(
            db.DataRequest.update({
              chart_id: chart.id,
            }, { where: { dataset_id: chart.Datasets[0].id } }),
          );
        }
        return chart;
      });

      return Promise.all(updatePromises);
    })
    .then((results) => {
      return results;
    })
    .catch((err) => err);
};
