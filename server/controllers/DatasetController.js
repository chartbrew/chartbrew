const db = require("../models/models");

class DatasetController {
  findById(id) {
    return db.Dataset.findByPk(id)
      .then((dataset) => {
        if (!dataset) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return dataset;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByChart(chartId) {
    return db.Dataset.findAll({
      where: { project_id: chartId },
    })
      .then((datasets) => {
        return datasets;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  create(data) {
    return db.Dataset.create(data)
      .then((dataset) => {
        return dataset;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    if (!id) {
      return db.Dataset.create(data)
        .then((dataset) => {
          return this.findById(dataset.id);
        })
        .catch((error) => {
          return new Promise((resolve, reject) => reject(error));
        });
    }

    return db.Dataset.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  remove(id) {
    return db.Dataset.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = DatasetController;
