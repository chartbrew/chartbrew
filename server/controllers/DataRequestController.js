const ConnectionController = require("./ConnectionController");
const drCacheController = require("./DataRequestCacheController");
const db = require("../models/models");
const { generateSqlQuery } = require("../modules/ai/generateSqlQuery");

class RequestController {
  constructor() {
    this.connectionController = new ConnectionController();
  }

  create(data) {
    return db.DataRequest.create(data)
      .then((dataRequest) => {
        return this.findById(dataRequest.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findById(id) {
    return db.DataRequest.findOne({
      where: { id },
      include: [{ model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] }],
    })
      .then((dataRequest) => {
        if (!dataRequest) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return new Promise((resolve) => resolve(dataRequest));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByChart(chartId) {
    return db.DataRequest.findOne({
      where: { chart_id: chartId },
      include: [{ model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] }]
    })
      .then((dataRequest) => {
        if (!dataRequest) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return new Promise((resolve) => resolve(dataRequest));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByDataset(datasetId) {
    return db.DataRequest.findAll({
      where: { dataset_id: datasetId },
      include: [{ model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] }]
    })
      .then((dataRequests) => {
        if (!dataRequests || dataRequests.length === 0) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return Promise.resolve(dataRequests);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  update(id, data) {
    return db.DataRequest.update(data, {
      where: { id },
    })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  sendRequest(chartId) {
    let gDataRequest;
    return this.findByChart(chartId)
      .then((dataRequest) => {
        if (!dataRequest) return new Promise((resolve, reject) => reject(new Error(404)));
        gDataRequest = JSON.parse(JSON.stringify(dataRequest));

        return db.Chart.findByPk(chartId);
      })
      .then((chart) => {
        const jsChart = chart.get({ plain: true });
        return this.connectionController.testApiRequest({ ...jsChart, dataRequest: gDataRequest });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runRequest(id, chartId, noSource, getCache) {
    let gDataset;
    let dataRequest;
    return this.findById(id)
      .then((dr) => {
        dataRequest = dr;
        return db.Dataset.findOne({ where: { id: dataRequest.dataset_id } });
      })
      .then((dataset) => {
        gDataset = dataset;

        // go through all data requests
        const connection = dataRequest.Connection;

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
      .then(async (response) => {
        const processedRequest = response;
        if (response?.dataRequest?.Connection.type === "mongodb") {
          processedRequest.responseData = JSON.parse(
            JSON.stringify(processedRequest.responseData)
          );
        }

        if (response?.dataRequest?.Connection.type === "firestore") {
          let newConfiguration = {};
          if (response.dataRequest.configuration && typeof response.dataRequest.configuration === "object") {
            newConfiguration = { ...response.dataRequest.configuration };
          }

          if (response?.responseData?.configuration) {
            newConfiguration = { ...newConfiguration, ...response.responseData.configuration };
          }

          if (newConfiguration && Object.keys(newConfiguration).length > 0) {
            processedRequest.dataRequest.configuration = newConfiguration;

            db.DataRequest.update(
              { configuration: newConfiguration },
              { where: { id: response.dataRequest.id } },
            );

            try {
              const drCache = await drCacheController.findLast(dataRequest.id);
              if (drCache?.responseData?.configuration) {
                drCache.responseData.configuration = newConfiguration;
                drCacheController.update(drCache, dataRequest.id);
              }
            } catch (e) {
              // do nothing
            }
          }
          // console.log("newConfiguration", newConfiguration);
        }

        return Promise.resolve({
          options: gDataset,
          dataRequest: processedRequest,
        });
      })
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  delete(id) {
    return db.DataRequest.destroy({
      where: { id },
    })
      .then(() => {
        return new Promise((resolve) => resolve({ deleted: true }));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  askAi(id, question, conversationHistory, currentQuery) {
    return this.findById(id)
      .then(async (dataRequest) => {
        const connection = await db.Connection.findByPk(dataRequest.Connection.id);
        if (!connection?.schema) {
          return Promise.reject(new Error("No schema found. Please test your connection first."));
        }

        const aiResponse = await generateSqlQuery(
          connection.schema, question, conversationHistory, currentQuery
        );
        return aiResponse;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }
}

module.exports = RequestController;
