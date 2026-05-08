const Sequelize = require("sequelize");

const ConnectionController = require("./ConnectionController");
const db = require("../models/models");
const { generateSqlQuery } = require("../modules/ai/generateSqlQuery");
const { applyTransformation } = require("../modules/dataTransformations");
const { findSourceForConnection } = require("../sources");
const { applySourceVariables } = require("../sources/applySourceVariables");
const { runSourceDataRequest } = require("../sources/runSourceDataRequest");
const { assertSourceServerEnabled } = require("../sources/sourceAvailability");

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
      include: [
        { model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "DataRequest" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("DataRequest.id")
            )
          ),
          required: false
        }
      ],
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
      include: [
        { model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "DataRequest" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("DataRequest.id")
            )
          ),
          required: false
        }
      ]
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
      include: [
        { model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "DataRequest" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("DataRequest.id")
            )
          ),
          required: false
        }
      ]
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

  async getBuilderMetadata(id, options = {}) {
    const dataRequest = await this.findById(id);
    if (!dataRequest?.Connection?.id) {
      return Promise.reject(new Error(404));
    }

    const source = findSourceForConnection(dataRequest.Connection);
    if (source?.backend?.getBuilderMetadata) {
      assertSourceServerEnabled(source);
      return source.backend.getBuilderMetadata({
        connection: dataRequest.Connection,
        dataRequest,
        options,
      });
    }

    return Promise.resolve({ type: dataRequest.Connection.type });
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

  runRequest({
    id, chartId, noSource, getCache, variables = {},
  }) {
    let gDataset;
    let dataRequest;
    return this.findById(id)
      .then((dr) => {
        dataRequest = dr;
        return db.Dataset.findOne({ where: { id: dataRequest.dataset_id } });
      })
      .then((dataset) => {
        gDataset = dataset;
        const {
          dataRequest: originalDataRequest,
          processedQuery,
          processedDataRequest,
        } = applySourceVariables(dataRequest, variables);

        // go through all data requests
        const connection = originalDataRequest.Connection;

        if (!originalDataRequest || (originalDataRequest && originalDataRequest.length === 0)) {
          return new Promise((resolve, reject) => reject(new Error("404")));
        }

        if (!connection) {
          return new Promise((resolve, reject) => reject(new Error("404")));
        }

        if (noSource === true) {
          return new Promise((resolve) => resolve({}));
        }

        const sourceResponse = runSourceDataRequest({
          connection,
          dataRequest: originalDataRequest,
          chartId,
          getCache,
          variables,
          processedQuery,
          processedDataRequest,
        });
        if (sourceResponse) {
          return sourceResponse;
        }

        return new Promise((resolve, reject) => reject(new Error("Invalid connection type")));
      })
      .then(async (response) => {
        const processedRequest = response;

        // Apply transformation if enabled
        if (processedRequest.dataRequest.transform
          && processedRequest.dataRequest.transform.enabled
        ) {
          processedRequest.responseData.data = applyTransformation(
            processedRequest?.responseData?.data,
            processedRequest.dataRequest.transform
          );
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
        const source = findSourceForConnection(connection);
        let schema = connection?.schema;
        if (!schema) {
          if (source?.backend?.ai?.getSchema) {
            assertSourceServerEnabled(source);
            schema = await source.backend.ai.getSchema({ connection, dataRequest });
          } else if (source?.backend?.getSchema) {
            assertSourceServerEnabled(source);
            schema = await source.backend.getSchema({ connection, dataRequest });
          }
        }

        if (!schema) {
          return Promise.reject(new Error("No schema found. Please test your connection first."));
        }

        let aiResponse;
        if (source?.backend?.ai?.generateQuery) {
          assertSourceServerEnabled(source);
          aiResponse = await source.backend.ai.generateQuery({
            schema,
            question,
            conversationHistory,
            currentQuery,
            connection,
            dataRequest,
          });
        } else {
          aiResponse = await generateSqlQuery(
            schema, question, conversationHistory, currentQuery
          );
        }

        return aiResponse;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  createVariableBinding(id, data) {
    const newVar = {
      ...data,
      entity_type: "DataRequest",
      entity_id: `${id}`,
    };

    return db.VariableBinding.create(newVar)
      .then(() => {
        return this.findById(id);
      });
  }

  updateVariableBinding(id, variable_id, data) {
    return db.VariableBinding.update(data, { where: { id: variable_id } })
      .then(() => {
        return this.findById(id);
      });
  }

  deleteVariableBinding(id, variable_id) {
    return db.VariableBinding.destroy({
      where: {
        id: variable_id,
        entity_id: `${id}`,
        entity_type: "DataRequest",
      },
    })
      .then(() => {
        return this.findById(id);
      });
  }
}

module.exports = RequestController;
