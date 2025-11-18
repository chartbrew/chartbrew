const _ = require("lodash");
const Sequelize = require("sequelize");

const db = require("../models/models");
const ConnectionController = require("./ConnectionController");
const DataRequestController = require("./DataRequestController");
const { applyTransformation } = require("../modules/dataTransformations");
const { applyVariables } = require("../modules/applyVariables");

function joinData(joins, index, requests, data) {
  const dr = requests.find((r) => r?.dataRequest?.id === joins[index].dr_id);
  const joinDr = requests.find((r) => r?.dataRequest?.id === joins[index].join_id);

  if (!dr || !joinDr) return data;

  let drData = data;
  const joinDrData = joinDr.responseData.data;

  if (!drData || !joinDrData) return data;

  const drField = joins[index].dr_field;
  const joinField = joins[index].join_field;

  if (!drField || !joinField) return data;

  const newData = [];

  // extract the selected data from the object
  let drSelector = drField;
  // if (index === 0) {
  if (drField.indexOf("root[]") > -1) {
    drSelector = drSelector.replace("root[].", "");
    // and data stays the same
    drData = data;
  } else {
    const arrayFinder = drSelector.substring(0, drSelector.indexOf("]") - 1).replace("root.", "");
    drSelector = drSelector.substring(drSelector.indexOf("]") + 2);

    drData = _.get(data, arrayFinder);
  }
  // }

  // extract the selected data from the second request
  let joinSelectedData = joinDrData;
  let joinSelector = joinField;
  if (joinField.indexOf("root[]") > -1) {
    joinSelector = joinSelector.replace("root[].", "");
    joinSelectedData = joinDrData;
  } else {
    const arrayFinder = joinSelector.substring(0, joinSelector.indexOf("]") - 1).replace("root.", "");
    joinSelector = joinSelector.substring(joinSelector.indexOf("]") + 2);

    joinSelectedData = _.get(joinDrData, arrayFinder);
  }

  drData.forEach((drItem) => {
    // check if the dr was a join previously
    const existingIndex = joins.findIndex((j) => {
      return (j.join_id === dr?.dataRequest?.id && j.dr_id !== dr?.dataRequest?.id);
    });
    const newObjectFields = {};

    joinSelectedData.forEach((joinItem) => {
      if (existingIndex > -1
        && (_.get(drItem, `${joins[index - 1].alias}.${drSelector}`, drItem[joins[index - 1].alias][drSelector]) === _.get(joinItem, joinSelector, joinItem[joinSelector]))
      ) {
        Object.keys(joinItem).forEach((key) => {
          if (!newObjectFields[joins[index].alias]) {
            newObjectFields[joins[index].alias] = {};
          }
          newObjectFields[joins[index].alias][key] = joinItem[key];
        });
      } else if (_.get(drItem, drSelector, drItem[drSelector])
        && _.get(drItem, drSelector, drItem[drSelector])
          === _.get(joinItem, joinSelector, joinItem[joinSelector])
      ) {
        Object.keys(joinItem).forEach((key) => {
          if (!newObjectFields[joins[index].alias]) {
            newObjectFields[joins[index].alias] = {};
          }
          newObjectFields[joins[index].alias][key] = joinItem[key];
        });
      }
    });

    newData.push({ ...drItem, ...newObjectFields });
  });

  return newData;
}

class DatasetController {
  constructor() {
    this.connectionController = new ConnectionController();
    this.dataRequestController = new DataRequestController();
  }

  findByTeam(teamId) {
    return db.Dataset.findAll({
      where: { team_id: teamId },
      include: [
        {
          model: db.DataRequest,
          include: [
            { model: db.Connection, attributes: ["id", "name", "type", "subType"] },
            {
              model: db.VariableBinding,
              on: Sequelize.and(
                { "$DataRequests->VariableBindings.entity_type$": "DataRequest" },
                Sequelize.where(
                  Sequelize.cast(Sequelize.col("DataRequests->VariableBindings.entity_id"), "INTEGER"),
                  Sequelize.col("DataRequests.id")
                )
              ),
              required: false
            },
          ],
        },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "Dataset" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("Dataset.id")
            )
          ),
          required: false
        },
      ],
      order: [["createdAt", "DESC"]],
    })
      .then((datasets) => {
        return datasets;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findById(id) {
    return db.Dataset.findOne({
      where: { id },
      include: [
        { model: db.DataRequest, include: [{ model: db.Connection, attributes: ["id", "name", "type", "subType"] }] },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "Dataset" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("Dataset.id")
            )
          ),
          required: false
        },
      ],
    })
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
      include: [
        { model: db.DataRequest, include: [{ model: db.Connection, attributes: ["id", "name", "type", "subType"] }] },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "Dataset" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("Dataset.id")
            )
          ),
          required: false
        },
      ],
      order: [["order", "ASC"]],
    })
      .then((datasets) => {
        return datasets;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async findByProjects(teamId, projects) {
    const datasets = await db.Dataset.findAll({
      where: { team_id: teamId },
    });

    return datasets.filter((dataset) => {
      if (!dataset?.project_ids) return false;
      return dataset.project_ids.some((projectId) => projects.includes(projectId));
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

  runRequest({
    dataset_id, chart_id, noSource, getCache, filters, timezone, variables = {},
  }) {
    let gDataset;
    let mainDr;
    return db.Dataset.findOne({
      where: { id: dataset_id },
      include: [
        {
          model: db.DataRequest,
          include: [
            { model: db.Connection, attributes: ["id", "name", "type", "subType", "host"] },
            {
              model: db.VariableBinding,
              on: Sequelize.and(
                { "$DataRequests->VariableBindings.entity_type$": "DataRequest" },
                Sequelize.where(
                  Sequelize.cast(Sequelize.col("DataRequests->VariableBindings.entity_id"), "INTEGER"),
                  Sequelize.col("DataRequests.id")
                )
              ),
              required: false
            },
          ]
        },
        {
          model: db.VariableBinding,
          on: Sequelize.and(
            { "$VariableBindings.entity_type$": "Dataset" },
            Sequelize.where(
              Sequelize.cast(Sequelize.col("VariableBindings.entity_id"), "INTEGER"),
              Sequelize.col("Dataset.id")
            )
          ),
          required: false
        },
      ],
    })
      .then((dataset) => {
        gDataset = dataset;
        const drPromises = [];
        let dataRequests = dataset.DataRequests;
        mainDr = dataRequests.find((dr) => dr.id === dataset.main_dr_id);
        if (!mainDr) {
          [mainDr] = dataRequests;
        }

        // if the dataset does not have a main data request, run just the first request
        if (dataset?.joinSettings?.joins) {
          const newDataRequests = [mainDr];

          // determine if we need to run the requests based on the join settings
          dataset.joinSettings.joins.forEach((join) => {
            if (join.dr_id && join.join_id && join.dr_field && join.join_field) {
              const dr = dataRequests.find((dr) => dr.id === join.dr_id);
              // add the data request to the new array if it's not in there already
              if (dr && !newDataRequests.find((n) => n.id === dr.id)) {
                newDataRequests.push(dr);
              }

              const joinDr = dataRequests.find((jDr) => jDr.id === join.join_id);
              // add the data request to the new array if it's not in there already
              if (joinDr && !newDataRequests.find((n) => n.id === joinDr.id)) {
                newDataRequests.push(joinDr);
              }
            }
          });

          if (newDataRequests.length > 0) {
            dataRequests = newDataRequests;
          }
        }

        if (!mainDr) throw new Error("There is no main data request for this dataset.");

        // go through all data requests
        dataRequests.forEach((dataRequest) => {
          // Apply variables before processing the request
          const {
            dataRequest: originalDataRequest,
            processedQuery,
          } = applyVariables(dataRequest, variables);
          const connection = originalDataRequest.Connection;

          if (!originalDataRequest
            || (originalDataRequest && originalDataRequest.length === 0)
          ) {
            drPromises.push(
              new Promise((resolve, reject) => reject(new Error("404")))
            );
          }

          if (!connection) {
            drPromises.push(
              new Promise((resolve) => { resolve({}); })
            );
          }

          if (noSource === true) {
            drPromises.push(new Promise((resolve) => resolve({})));
          }

          if (connection.type === "mongodb") {
            drPromises.push(
              this.connectionController.runMongo(
                connection.id,
                originalDataRequest,
                getCache,
                processedQuery
              )
            );
          } else if (connection.type === "api") {
            drPromises.push(
              this.connectionController.runApiRequest(
                connection.id,
                chart_id,
                originalDataRequest,
                getCache,
                filters,
                timezone,
                variables,
              )
            );
          } else if (connection.type === "postgres" || connection.type === "mysql") {
            drPromises.push(
              this.connectionController.runMysqlOrPostgres(
                connection.id,
                originalDataRequest,
                getCache,
                processedQuery,
              )
            );
          } else if (connection.type === "clickhouse") {
            drPromises.push(
              this.connectionController.runClickhouse(
                connection.id,
                originalDataRequest,
                getCache,
                processedQuery,
              )
            );
          } else if (connection.type === "firestore") {
            drPromises.push(
              this.connectionController.runFirestore(
                connection.id,
                originalDataRequest,
                getCache,
                variables,
              )
            );
          } else if (connection.type === "googleAnalytics") {
            drPromises.push(
              this.connectionController.runGoogleAnalytics(
                connection,
                originalDataRequest,
                getCache,
              )
            );
          } else if (connection.type === "realtimedb") {
            drPromises.push(
              this.connectionController.runRealtimeDb(
                connection.id,
                originalDataRequest,
                getCache,
                variables,
              )
            );
          } else if (connection.type === "customerio") {
            drPromises.push(
              this.connectionController.runCustomerio(connection, originalDataRequest, getCache)
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
        let data = [];
        const mainResponseData = filteredRequests
          .find((r) => r?.dataRequest?.id === mainDr.id)?.responseData?.data;

        if (filteredRequests.length === 1 || gDataset?.joinSettings?.joins?.length === 0) {
          data = mainResponseData;
        } else {
          const joins = gDataset?.joinSettings?.joins;
          data = mainResponseData;

          if (joins) {
            joins.forEach((join, index) => {
              data = joinData(joins, index, filteredRequests, data);
            });
          }
        }

        // Apply transformation if enabled
        if (mainDr.transform && mainDr.transform.enabled) {
          data = applyTransformation(data, mainDr.transform);
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

  async findRelatedCharts(id) {
    try {
      // get cdcs, but make sure to avoid getting them for ghost projects
      const cdcs = await db.ChartDatasetConfig.findAll({
        where: { dataset_id: id, "$Chart.Project.ghost$": false },
        include: [{
          model: db.Chart,
          attributes: ["id", "name"],
          include: [{ model: db.Project, attributes: ["id", "ghost"] }],
        }],
      });

      // return all unique charts
      const charts = [];
      cdcs.forEach((cdc) => {
        if (!charts.find((c) => c.id === cdc.Chart.id)) {
          charts.push(cdc.Chart);
        }
      });

      return charts;
    } catch (error) {
      return new Promise((resolve, reject) => reject(error));
    }
  }

  async duplicateDataset(id, name) {
    const dataset = await db.Dataset.findByPk(id);
    const datasetToSave = dataset.toJSON();
    delete datasetToSave.id;
    delete datasetToSave.createdAt;
    delete datasetToSave.updatedAt;

    if (name) {
      datasetToSave.legend = name;
    }

    // Create the new dataset
    const newDataset = await db.Dataset.create(datasetToSave);

    // Get all data requests for the original dataset
    const dataRequests = await db.DataRequest.findAll({
      where: { dataset_id: id }
    });

    // Create new data requests and map them to the new dataset
    const newDataRequests = await Promise.all(
      dataRequests.map(async (dr) => {
        const drToSave = dr.toJSON();
        delete drToSave.id;
        delete drToSave.createdAt;
        delete drToSave.updatedAt;
        drToSave.dataset_id = newDataset.id;

        return db.DataRequest.create(drToSave);
      })
    );

    // Set the mainSource if it exists in the original dataset
    if (dataset.main_dr_id) {
      const mainSourceDr = dataRequests.find((dr) => dr.id === dataset.main_dr_id);
      if (mainSourceDr) {
        const newMainSourceDr = newDataRequests.find(
          (dr) => dr.query === mainSourceDr.query
        );
        if (newMainSourceDr) {
          await newDataset.update({ main_dr_id: newMainSourceDr.id });
        }
      }
    }

    return this.findById(newDataset.id);
  }

  async removeDrafts(teamId) {
    return db.Dataset.destroy({ where: { team_id: teamId, draft: true } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async createVariableBinding(id, data) {
    await db.VariableBinding.create({ ...data, entity_id: id, entity_type: "Dataset" });
    return this.findById(id);
  }

  async updateVariableBinding(id, variable_id, data) {
    await db.VariableBinding.update(data, { where: { id: variable_id, entity_id: id, entity_type: "Dataset" } });
    return this.findById(id);
  }

  /**
   * Create a dataset with all its data requests in one go
   * @param {Object} data - Dataset data with dataRequests array
   * @param {Array} data.dataRequests - Array of data request objects to create
   * @param {number|string} data.main_dr_index - Optional index of main data request (defaults to 0)
   * @returns {Promise<Object>} Created dataset with all data requests
   */
  async createWithDataRequests(data) {
    const {
      dataRequests = [],
      main_dr_index = 0,
      joinSettings,
      variableBindings: datasetVariableBindings = [],
      ...datasetData
    } = data;

    // Helper function to extract variable name from {{variableName}} format
    const extractVariableName = (name) => {
      if (typeof name !== "string") return name;
      // Remove {{ }} wrapper if present
      const match = name.match(/^\{\{([^}]+)\}\}$/);
      return match ? match[1].trim() : name.trim();
    };

    // Filter out legacy fields from dataset data
    const legacyFields = [
      "chart_id", "connection_id", "query", "excludedFields", "averageByTotal",
      "configuration", "datasetColor", "fillColor", "fill", "multiFill",
      "pointRadius", "patterns", "groups", "groupBy", "sort", "columnsOrder",
      "order", "maxRecords", "goal"
    ];

    const cleanDatasetData = {};
    const allowedFields = [
      "team_id", "project_ids", "draft", "xAxis", "xAxisOperation", "yAxis",
      "yAxisOperation", "dateField", "dateFormat", "legend", "conditions",
      "fieldsSchema"
    ];

    allowedFields.forEach((field) => {
      if (datasetData[field] !== undefined && !legacyFields.includes(field)) {
        cleanDatasetData[field] = datasetData[field];
      }
    });

    // Create the dataset first (without joinSettings - will be set after data requests are created)
    const dataset = await db.Dataset.create(cleanDatasetData);

    // Create all data requests with their variable bindings
    const createdDataRequests = await Promise.all(
      dataRequests.map(async (drData) => {
        const { variableBindings: drVariableBindings = [], ...drToCreateData } = drData;
        const drToCreate = {
          ...drToCreateData,
          dataset_id: dataset.id
        };
        const createdDr = await db.DataRequest.create(drToCreate);

        // Create variable bindings for this data request
        if (drVariableBindings && drVariableBindings.length > 0) {
          await Promise.all(
            drVariableBindings.map((vb) => {
              const { entity_type, entity_id, ...vbRest } = vb;
              const vbData = {
                ...vbRest,
                entity_type: "DataRequest",
                entity_id: createdDr.id.toString(),
                name: extractVariableName(vb.name || vb.variableName || "")
              };
              return db.VariableBinding.create(vbData);
            })
          );
        }

        return createdDr;
      })
    );

    // Create variable bindings for the dataset
    if (datasetVariableBindings && datasetVariableBindings.length > 0) {
      await Promise.all(
        datasetVariableBindings.map((vb) => {
          const { entity_type, entity_id, ...vbRest } = vb;
          const vbData = {
            ...vbRest,
            entity_type: "Dataset",
            entity_id: dataset.id.toString(),
            name: extractVariableName(vb.name || vb.variableName || "")
          };
          return db.VariableBinding.create(vbData);
        })
      );
    }

    // Determine main_dr_id
    let mainDrId = null;
    if (createdDataRequests.length > 0) {
      if (typeof main_dr_index === "number" && createdDataRequests[main_dr_index]) {
        mainDrId = createdDataRequests[main_dr_index].id;
      } else if (typeof main_dr_index === "string") {
        // Try to find by some identifier if provided as string
        const found = createdDataRequests.find((dr) => dr.id.toString() === main_dr_index);
        if (found) {
          mainDrId = found.id;
        } else {
          mainDrId = createdDataRequests[0].id;
        }
      } else {
        mainDrId = createdDataRequests[0].id;
      }
    }

    // Update joinSettings if provided - map any indices to actual data request IDs
    const updateData = { main_dr_id: mainDrId };
    if (joinSettings && joinSettings.joins) {
      const updatedJoinSettings = {
        ...joinSettings,
        joins: joinSettings.joins.map((join) => {
          const updatedJoin = { ...join };

          // If join references use indices (0-based), map them to actual IDs
          if (typeof join.dr_id === "number" && join.dr_id >= 0 && join.dr_id < createdDataRequests.length) {
            updatedJoin.dr_id = createdDataRequests[join.dr_id].id;
          }
          if (typeof join.join_id === "number" && join.join_id >= 0 && join.join_id < createdDataRequests.length) {
            updatedJoin.join_id = createdDataRequests[join.join_id].id;
          }

          return updatedJoin;
        })
      };
      updateData.joinSettings = updatedJoinSettings;
    }

    await dataset.update(updateData);

    // Return the full dataset with all data requests
    return this.findById(dataset.id);
  }
}

module.exports = DatasetController;
