const db = require("../models/models");

function findById(id) {
  return db.Alert.findByPk(id);
}

function create(data) {
  return db.Alert.create(data);
}

function update(id, data) {
  return db.Alert.update(data, {
    where: {
      id,
    },
  })
    .then(() => findById(id));
}

function remove(id) {
  return db.Alert.destroy({
    where: {
      id,
    },
  });
}

function getByChartId(chartId) {
  return db.Alert.findAll({
    where: {
      chart_id: chartId,
    },
  });
}

function getByDatasetId(datasetId) {
  return db.Alert.findAll({
    where: {
      dataset_id: datasetId,
    },
  });
}

module.exports = {
  findById,
  create,
  update,
  remove,
  getByChartId,
  getByDatasetId,
};
