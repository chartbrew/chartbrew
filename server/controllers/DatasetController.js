const db = require("../models/models");
const ConnectionController = require("./ConnectionController");

class DatasetController {
  constructor() {
    this.connectionController = new ConnectionController();
  }

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
      where: { chart_id: chartId },
      order: [["order", "ASC"]],
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
        return this.findById(dataset.id);
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

  runRequest(id, chartId, noSource, getCache) {
    let gDataset;
    let gConnection;
    return db.Dataset.findOne({
      where: { id },
      include: [{ model: db.DataRequest }, { model: db.Connection }],
    })
      .then((dataset) => {
        gDataset = dataset;
        const connection = dataset.Connection;
        gConnection = connection;
        const dataRequest = dataset.DataRequest;

        if (!dataRequest || (dataRequest && dataRequest.length === 0)) {
          return new Promise((resolve, reject) => reject(new Error("404")));
        }

        if (!connection) {
          return new Promise((resolve, reject) => reject(new Error("404")));
        }

        if (noSource === true) {
          return new Promise((resolve) => resolve({}));
        }

        if (connection.type === "mongodb") {
          return this.connectionController.runMongo(connection.id, dataRequest, getCache);
        } else if (connection.type === "api") {
          return this.connectionController.runApiRequest(
            connection.id, chartId, dataRequest, getCache,
          );
        } else if (connection.type === "postgres" || connection.type === "mysql") {
          return this.connectionController.runMysqlOrPostgres(connection.id, dataRequest);
        } else if (connection.type === "firestore") {
          return this.connectionController.runFirestore(connection.id, dataRequest, getCache);
        } else if (connection.type === "googleAnalytics") {
          return this.connectionController.runGoogleAnalytics(connection, dataRequest);
        } else if (connection.type === "realtimedb") {
          return this.connectionController.runRealtimeDb(connection.id, dataRequest, getCache);
        } else if (connection.type === "customerio") {
          return this.connectionController.runCustomerio(connection, dataRequest, getCache);
        } else {
          return new Promise((resolve, reject) => reject(new Error("Invalid connection type")));
        }
      })
      .then(async (rawData) => {
        let data = rawData;
        if (gConnection.type === "mongodb") {
          data = JSON.parse(JSON.stringify(data));
        }
        if (gConnection.type === "firestore") {
          data = rawData.data;

          let newConfiguration = {};
          if (gDataset.DataRequest.configuration && typeof gDataset.DataRequest.configuration === "object") {
            newConfiguration = { ...gDataset.DataRequest.configuration };
          }

          if (rawData.configuration) {
            newConfiguration = { ...newConfiguration, ...rawData.configuration };
          }

          const newDr = await db.DataRequest.update(
            { configuration: newConfiguration },
            { where: { id: gDataset.DataRequest.id } },
          )
            .then(() => db.DataRequest.findByPk(gDataset.DataRequest.id));

          gDataset.DataRequest = newDr;
        }

        return Promise.resolve({
          options: gDataset,
          data,
        });
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
}

module.exports = DatasetController;
