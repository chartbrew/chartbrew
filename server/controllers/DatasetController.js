const db = require("../models/models");
const ConnectionController = require("./ConnectionController");
const DataRequestController = require("./DataRequestController");

class DatasetController {
  constructor() {
    this.connectionController = new ConnectionController();
    this.dataRequestController = new DataRequestController();
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
    return db.Dataset.findOne({
      where: { id },
      include: [
        { model: db.DataRequest, include: [{ model: db.Connection, attributes: ["id", "type"] }] },
      ],
    })
      .then((dataset) => {
        gDataset = dataset;

        const drPromises = [];
        // go through all data requests
        dataset.DataRequests.forEach((dataRequest) => {
          const connection = dataRequest.Connection;

          if (!dataRequest || (dataRequest && dataRequest.length === 0)) {
            drPromises.push(
              new Promise((resolve, reject) => reject(new Error("404")))
            );
          }

          if (!connection) {
            drPromises.push(
              new Promise((resolve, reject) => reject(new Error("404")))
            );
          }

          if (noSource === true) {
            drPromises.push(new Promise((resolve) => resolve({})));
          }

          if (connection.type === "mongodb") {
            drPromises.push(
              this.connectionController.runMongo(connection.id, dataRequest, getCache)
            );
          } else if (connection.type === "api") {
            drPromises.push(
              this.connectionController.runApiRequest(
                connection.id, chartId, dataRequest, getCache,
              )
            );
          } else if (connection.type === "postgres" || connection.type === "mysql") {
            drPromises.push(
              this.connectionController.runMysqlOrPostgres(connection.id, dataRequest)
            );
          } else if (connection.type === "firestore") {
            drPromises.push(
              this.connectionController.runFirestore(connection.id, dataRequest, getCache)
            );
          } else if (connection.type === "googleAnalytics") {
            drPromises.push(
              this.connectionController.runGoogleAnalytics(connection, dataRequest)
            );
          } else if (connection.type === "realtimedb") {
            drPromises.push(
              this.connectionController.runRealtimeDb(connection.id, dataRequest, getCache)
            );
          } else if (connection.type === "customerio") {
            drPromises.push(
              this.connectionController.runCustomerio(connection, dataRequest, getCache)
            );
          } else {
            drPromises.push(
              new Promise((resolve, reject) => reject(new Error("Invalid connection type")))
            );
          }
        });

        return Promise.all(drPromises);
      })
      .then(async (promisedRequests) => {
        const filteredRequests = promisedRequests.filter((request) => request !== undefined);
        const dataRequests = [];
        const drUpdates = [];

        filteredRequests.forEach((fr) => {
          const processedRequest = fr;
          if (fr?.dataRequest?.Connection.type === "mongodb") {
            processedRequest.responseData = JSON.parse(
              JSON.stringify(processedRequest.responseData)
            );
          }

          if (fr?.dataRequest?.Connection.type === "firestore") {
            let newConfiguration = {};
            if (fr.dataRequest.configuration && typeof fr.dataRequest.configuration === "object") {
              newConfiguration = { ...fr.dataRequest.configuration };
            }

            if (fr?.responseData?.configuration) {
              newConfiguration = { ...newConfiguration, ...fr.responseData.configuration };
            }

            if (newConfiguration && Object.keys(newConfiguration).length === 0) {
              processedRequest.dataRequest.configuration = newConfiguration;

              drUpdates.push(db.DataRequest.update(
                { configuration: newConfiguration },
                { where: { id: fr.dataRequest.id } },
              ));
            }
          }

          dataRequests.push(processedRequest);
        });

        // process any updates to data requests (e.g. firestore)
        try {
          await Promise.all(drUpdates);
        } catch (e) {
          console.log("e", e); // eslint-disable-line
        }

        return Promise.resolve({
          options: gDataset,
          dataRequests,
        });
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }
}

module.exports = DatasetController;
