const mongoose = require("mongoose");
const request = require("request-promise");
const Sequelize = require("sequelize");
const querystring = require("querystring");
const moment = require("moment");
const _ = require("lodash");
const fs = require("fs");
const { Queue } = require("bullmq");

const { ObjectId } = mongoose.Types;

const db = require("../models/models");
const ProjectController = require("./ProjectController");
const externalDbConnection = require("../modules/externalDbConnection");
const assembleMongoUrl = require("../modules/assembleMongoUrl");
const paginateRequests = require("../modules/paginateRequests");
const firebaseConnector = require("../modules/firebaseConnector");
const googleConnector = require("../modules/googleConnector");
const FirestoreConnection = require("../connections/FirestoreConnection");
const oauthController = require("./OAuthController");
const determineType = require("../modules/determineType");
const drCacheController = require("./DataRequestCacheController");
const RealtimeDatabase = require("../connections/RealtimeDatabase");
const CustomerioConnection = require("../connections/CustomerioConnection");
const { getQueueOptions } = require("../redisConnection");
const updateMongoSchema = require("../crons/workers/updateMongoSchema");
const ClickhouseConnector = require("../modules/clickhouse/clickhouseConnector");
const { applyApiVariables, applyVariables } = require("../modules/applyVariables");

const getMomentObj = (timezone) => {
  if (timezone) {
    return (...args) => moment(...args).tz(timezone);
  } else {
    return (...args) => moment.utc(...args);
  }
};

async function checkAndGetCache(connection_id, dataRequest) {
  // check if there is a cache available and valid
  try {
    const drCache = await drCacheController.findLast(dataRequest.id);
    const cachedDataRequest = { ...drCache.dataRequest };
    cachedDataRequest.updatedAt = "";
    cachedDataRequest.createdAt = "";
    delete cachedDataRequest.Connection;

    const liveDataRequest = dataRequest.toJSON();
    liveDataRequest.updatedAt = "";
    liveDataRequest.createdAt = "";
    delete liveDataRequest.Connection;

    if (_.isEqual(cachedDataRequest, liveDataRequest) && drCache.connection_id === connection_id) {
      return {
        responseData: drCache.responseData,
        dataRequest: drCache.dataRequest,
      };
    }
  } catch (e) {
    return false;
  }

  return false;
}

function isArrayPresent(responseData) {
  let arrayFound = false;
  Object.keys(responseData).forEach((k1) => {
    if (determineType(responseData[k1]) === "array") {
      arrayFound = true;
    }

    if (!arrayFound && determineType(responseData[k1]) === "object") {
      Object.keys(responseData[k1]).forEach((k2) => {
        if (determineType(responseData[k1][k2]) === "array") {
          arrayFound = true;
        }

        if (!arrayFound && determineType(responseData[k1][k2]) === "object") {
          Object.keys(responseData[k1][k2]).forEach((k3) => {
            if (determineType(responseData[k1][k2][k3]) === "array") {
              arrayFound = true;
            }
          });
        }
      });
    }
  });

  return arrayFound;
}

class ConnectionController {
  constructor() {
    this.projectController = new ProjectController();
  }

  findAll() {
    return db.Connection.findAll({
      attributes: { exclude: ["dbName", "password", "username", "options", "port", "host", "sslCa", "sslCert", "sslKey"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connections) => {
        return Promise.resolve(connections);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  findById(id) {
    return db.Connection.findByPk(id, {
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connection) => {
        if (!connection) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return connection;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByTeam(teamId) {
    return db.Connection.findAll({
      where: { team_id: teamId },
      attributes: { exclude: ["password", "schema"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
      order: [["createdAt", "DESC"]],
    })
      .then((connections) => {
        return connections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByProject(projectId) {
    return db.Connection.findAll({
      where: { project_id: projectId },
      attributes: { exclude: ["password"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connections) => {
        return connections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByProjects(teamId, projects) {
    return db.Connection.findAll({
      where: { team_id: teamId },
      attributes: { exclude: ["password"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
      order: [["createdAt", "DESC"]],
    })
      .then((connections) => {
        const filteredConnections = connections.filter((connection) => {
          if (!connection.project_ids) return false;
          return connection.project_ids.some((projectId) => {
            return projects.includes(projectId);
          });
        });

        return filteredConnections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async create(data) {
    const dataToSave = { ...data };

    if (!data.type) data.type = "mongodb"; // eslint-disable-line
    if (data.type === "mysql" || data.type === "postgres") {
      try {
        const testData = await this.testMysql(data);
        dataToSave.schema = testData.schema;
      } catch (e) {
        //
      }
    }

    return db.Connection.create(dataToSave)
      .then((connection) => {
        if (connection.type === "mongodb") {
          // update the schema in the background
          this.addMongoSchemaUpdateJob(connection.id);
        }

        return connection;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    return db.Connection.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getConnectionUrl(id) {
    return db.Connection.findByPk(id)
      .then((connection) => {
        if (!connection) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }

        if (connection.type === "mongodb") {
          return assembleMongoUrl(connection);
        } else {
          return new Promise((resolve, reject) => reject(new Error(400)));
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async removeConnection(id, removeDatasets) {
    if (removeDatasets) {
      try {
        const drs = await db.DataRequest.findAll({ where: { connection_id: id } });
        const datasetIds = drs.map((dr) => dr.dataset_id);

        await db.DataRequest.destroy({ where: { connection_id: id } });
        await db.Dataset.destroy({ where: { id: datasetIds } });
      } catch (e) {
        //
      }
    }

    const connection = await this.findById(id);
    // remove certificates and keys if present
    try {
      if (connection.sslCa) {
        fs.unlink(connection.sslCa, () => {});
      }
      if (connection.sslCert) {
        fs.unlink(connection.sslCert, () => {});
      }
      if (connection.sslKey) {
        fs.unlink(connection.sslKey, () => {});
      }
      if (connection.sshPrivateKey) {
        fs.unlink(connection.sshPrivateKey, () => {});
      }
    } catch (e) {
      //
    }

    return db.Connection.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getApiTestOptions(connection) {
    if (connection.type !== "api") return false;

    const testOptions = {
      url: connection.host,
      method: "GET",
      headers: {},
      resolveWithFullResponse: true,
    };

    let globalHeaders = connection.options;
    if (connection.getHeaders) {
      globalHeaders = connection.getHeaders(connection);
    } else if (connection.authentication && connection.authentication.type === "bearer_token") {
      testOptions.headers.authorization = `Bearer ${connection.authentication.token}`;
    }

    if (globalHeaders && globalHeaders.length > 0) {
      for (const option of connection.options) {
        testOptions.headers[Object.keys(option)[0]] = option[Object.keys(option)[0]];
      }
    }

    // Basic Auth
    if (connection.authentication && connection.authentication.type === "basic_auth") {
      testOptions.auth = {
        user: connection.authentication.user,
        pass: connection.authentication.pass,
      };
    }

    return testOptions;
  }

  testRequest(data, extras) {
    const certificates = {};
    if (extras?.files?.length > 0) {
      try {
        extras.files.forEach((file) => {
          // Handle SSL certificates
          if (file.fieldname === "sslCa" || file.fieldname === "sslCert" || file.fieldname === "sslKey") {
            certificates[file.fieldname] = file.path; // Use the temporary file path for testing
          }
          // Handle SSH private key
          if (file.fieldname === "sshPrivateKey") {
            certificates.sshPrivateKey = file.path;
          }
        });
      } catch (error) {
        return Promise.reject(new Error(`Error processing certificate files: ${error.message}`));
      }
    }

    let connectionParams = { ...data };

    if (Object.keys(certificates).length > 0) {
      connectionParams = { ...connectionParams, ...certificates };
    }

    if (data.type === "api") {
      return this.testApi(connectionParams);
    } else if (data.type === "mongodb") {
      return this.testMongo(connectionParams);
    } else if (data.type === "mysql" || data.type === "postgres") {
      return this.testMysql(connectionParams);
    } else if (data.type === "realtimedb") {
      return this.testFirebase(connectionParams);
    } else if (data.type === "firestore") {
      return this.testFirestore(connectionParams);
    } else if (data.type === "googleAnalytics") {
      return this.testGoogleAnalytics(connectionParams);
    } else if (data.type === "customerio") {
      return this.testCustomerio(connectionParams);
    } else if (data.type === "clickhouse") {
      return this.testClickhouse(connectionParams);
    }

    return new Promise((resolve, reject) => reject(new Error("No request type specified")));
  }

  testApi(data) {
    const testOpt = this.getApiTestOptions(data);
    return request(testOpt);
  }

  testMongo(data) {
    const mongoString = assembleMongoUrl(data);

    const mongoConnection = mongoose.createConnection(mongoString);
    return mongoConnection.asPromise()
      .then((connection) => {
        return connection.db.listCollections().toArray();
      })
      .then((collections) => {
        // Close the connection
        mongoConnection.close();

        return Promise.resolve({
          success: true,
          collections
        });
      })
      .catch((err) => {
        // Close the connection
        mongoConnection.close();

        return Promise.reject(err.message || err);
      });
  }

  async getSchema(dbConnection) {
    const tables = await dbConnection.getQueryInterface().showAllTables();
    const schemaPromises = tables.map((table) => {
      return dbConnection.getQueryInterface().describeTable(table)
        .then((description) => ({ table, description }));
    });

    const schemas = await Promise.all(schemaPromises);
    const schema = schemas.reduce((acc, { table, description }) => {
      acc[table] = description;
      return acc;
    }, {});

    return {
      tables,
      description: schema,
    };
  }

  async testMysql(data) {
    let sqlDb;
    try {
      sqlDb = await externalDbConnection(data);
      const schema = await this.getSchema(sqlDb);

      return Promise.resolve({
        success: true,
        schema
      });
    } catch (err) {
      return Promise.reject(err.message || err);
    } finally {
      // Close SSH tunnel if it exists
      if (sqlDb && sqlDb.sshTunnel) {
        sqlDb.sshTunnel.close();
      }
    }
  }

  async testClickhouse(data) {
    const clickhouse = new ClickhouseConnector(data);
    return clickhouse.getDatabaseSchema();
  }

  async getClickhouseSchema(connectionId) {
    const connection = await db.Connection.findByPk(connectionId);
    const clickhouse = new ClickhouseConnector(connection);
    return clickhouse.getDatabaseSchema();
  }

  testFirebase(data) {
    const parsedData = data;
    if (typeof data.firebaseServiceAccount !== "object") {
      try {
        parsedData.firebaseServiceAccount = JSON.parse(data.firebaseServiceAccount);
      } catch (e) {
        return Promise.reject("The authentication JSON is not formatted correctly.");
      }
    } else if (data.firebaseServiceAccount) {
      parsedData.firebaseServiceAccount = data.firebaseServiceAccount;
    } else {
      return Promise.reject("The firebase authentication is missing");
    }

    const realtimeDatabase = new RealtimeDatabase(parsedData);

    if (realtimeDatabase.db) {
      return Promise.resolve("Connection successful");
    }

    return Promise.reject("Could not connect to the database. Please check if the Service Account details are correct.");
  }

  testFirestore(data) {
    const parsedData = data;
    if (typeof data.firebaseServiceAccount !== "object") {
      try {
        parsedData.firebaseServiceAccount = JSON.parse(data.firebaseServiceAccount);
      } catch (e) {
        return Promise.reject("The authentication JSON is not formatted correctly.");
      }
    } else if (data.firebaseServiceAccount) {
      parsedData.firebaseServiceAccount = data.firebaseServiceAccount;
    } else {
      return Promise.reject("The firebase authentication is missing");
    }

    const firestore = new FirestoreConnection(parsedData);

    return firestore.listCollections()
      .then((data) => {
        return Promise.resolve(data);
      })
      .catch((err) => {
        return Promise.reject(err.message || err);
      });
  }

  testConnection(id) {
    let gConnection;
    let mongoConnection;
    return db.Connection.findByPk(id)
      .then((connection) => {
        gConnection = connection;
        switch (connection.type) {
          case "mongodb":
            return this.getConnectionUrl(id);
          case "api":
            return request(this.getApiTestOptions(connection));
          case "postgres":
          case "mysql":
            return externalDbConnection(connection);
          case "realtimedb":
          case "firestore":
            return firebaseConnector.getAuthToken(connection);
          case "googleAnalytics":
            return this.testGoogleAnalytics(connection);
          case "customerio":
            return this.testCustomerio(connection);
          default:
            return new Promise((resolve, reject) => reject(new Error(400)));
        }
      })
      .then((response) => {
        switch (gConnection.type) {
          case "mongodb": {
            mongoConnection = mongoose.createConnection(response);
            return mongoConnection.asPromise();
          }
          case "api":
            if (response.statusCode < 300) {
              return new Promise((resolve) => resolve({ success: true }));
            }
            return new Promise((resolve, reject) => reject(new Error(400)));
          case "postgres":
          case "mysql":
            return new Promise((resolve) => resolve({ success: true }));
          case "realtimedb":
          case "firestore":
            return new Promise((resolve) => resolve(response));
          case "googleAnalytics":
            return new Promise((resolve) => resolve(response));
          case "customerio":
            return new Promise((resolve) => resolve(response));
          default:
            return new Promise((resolve, reject) => reject(new Error(400)));
        }
      })
      .then(() => {
        // close the mongodb connection if it exists
        if (mongoConnection) {
          mongoConnection.close();
        }

        return new Promise((resolve) => resolve({ success: true }));
      })
      .catch((err) => {
        // close the mongodb connection if it exists
        if (mongoConnection) {
          mongoConnection.close();
        }

        return new Promise((resolve, reject) => reject(err));
      });
  }

  testApiRequest({
    connection_id, dataRequest, itemsLimit, items, offset, pagination, paginationField,
  }) {
    const limit = itemsLimit
      ? parseInt(itemsLimit, 10) : 0;
    return this.findById(connection_id)
      .then((connection) => {
        const tempUrl = `${connection.getApiUrl(connection)}${dataRequest.route || ""}`;
        const queryParams = querystring.parse(tempUrl.split("?")[1]);

        let url = tempUrl;
        if (url.indexOf("?") > -1) {
          url = tempUrl.substring(0, tempUrl.indexOf("?"));
        }

        const options = {
          url,
          method: dataRequest.method || "GET",
          headers: {},
          qs: queryParams,
          resolveWithFullResponse: true,
          simple: false,
        };

        // prepare the headers
        let headers = {};
        if (dataRequest.useGlobalHeaders) {
          const globalHeaders = connection.getHeaders(connection);
          for (const opt of globalHeaders) {
            headers = Object.assign(opt, headers);
          }

          if (dataRequest.headers) {
            headers = Object.assign(dataRequest.headers, headers);
          }
        }

        options.headers = headers;

        if (dataRequest.body && dataRequest.method !== "GET") {
          options.body = dataRequest.body;
          options.headers["Content-Type"] = "application/json";
        }

        if (pagination) {
          if ((options.url.indexOf(`?${items}=`) || options.url.indexOf(`&${items}=`))
            && (options.url.indexOf(`?${offset}=`) || options.url.indexOf(`&${offset}=`))
          ) {
            return paginateRequests(dataRequest.template, {
              options,
              limit,
              items,
              offset,
              paginationField,
            });
          }
        }

        return request(options);
      })
      .then((response) => {
        if (pagination) {
          return new Promise((resolve) => resolve(response));
        }

        if (response.statusCode < 300) {
          try {
            return new Promise((resolve) => resolve(JSON.parse(response.body)));
          } catch (e) {
            return new Promise((resolve, reject) => reject(400));
          }
        } else {
          return new Promise((resolve, reject) => reject(response.statusCode));
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async runMongo(id, dataRequest, getCache, queryOverride = null) {
    if (getCache) {
      const drCache = await checkAndGetCache(id, dataRequest);
      if (drCache) return drCache;
    }

    let mongoConnection;

    // Use the processed query if provided, otherwise use the original query
    let formattedQuery = queryOverride || dataRequest.query;

    // formatting required since introducing the multiple mongo connection support
    if (formattedQuery.indexOf("connection.") === 0) {
      formattedQuery = formattedQuery.replace("connection.", "");
    }

    return this.getConnectionUrl(id)
      .then((url) => {
        const options = {
          connectTimeoutMS: 100000,
        };
        mongoConnection = mongoose.createConnection(url, options);
        return mongoConnection.asPromise();
      })
      .then(() => {
        return Function(`'use strict';return (mongoConnection, ObjectId) => mongoConnection.${formattedQuery}.toArray()`)()(mongoConnection, ObjectId); // eslint-disable-line
      })
      // if array fails, check if it works with object (for example .findOne() return object)
      .catch(() => {
        return Function(`'use strict';return (mongoConnection, ObjectId) => mongoConnection.${formattedQuery}`)()(mongoConnection, ObjectId); // eslint-disable-line
      })
      .then(async (data) => {
        let finalData = data;
        if (data && typeof data?.next === "function") {
          finalData = await data.toArray();
        }
        // MonogoDB returns a plain number when count() is used, transform this into an object
        if (formattedQuery.indexOf("count(") > -1) {
          finalData = { count: data };
        }
        // cache the data for later use - use ORIGINAL dataRequest to preserve variable placeholders
        const dataToCache = {
          dataRequest,
          responseData: {
            data: finalData,
          },
          connection_id: id,
        };

        await drCacheController.create(dataRequest.id, dataToCache);

        // close the mongodb connection
        mongoConnection.close();

        // Trigger schema update in the background
        try {
          this.addMongoSchemaUpdateJob(id);
        } catch (error) {
          // do nothing
        }

        return Promise.resolve(dataToCache);
      })
      .catch((error) => {
        // close the mongodb connection
        mongoConnection.close();

        return new Promise((resolve, reject) => reject(error));
      });
  }

  async runMysqlOrPostgres(id, dataRequest, getCache, queryOverride = null) {
    if (getCache) {
      const drCache = await checkAndGetCache(id, dataRequest);
      if (drCache) return drCache;
    }

    let dbConnection = null;

    try {
      const connection = await this.findById(id);
      dbConnection = await externalDbConnection(connection);

      // Update schema in the background
      this.getSchema(dbConnection)
        .then((schema) => {
          db.Connection.update({ schema }, { where: { id } });
        });

      // Use the processed query if provided, otherwise use the original query
      const queryToExecute = queryOverride || dataRequest.query;
      const results = await dbConnection
        .query(queryToExecute, { type: Sequelize.QueryTypes.SELECT });

      // cache the data for later use - use ORIGINAL dataRequest to preserve variable placeholders
      const dataToCache = {
        dataRequest,
        responseData: {
          data: results,
        },
        connection_id: id,
      };

      await drCacheController.create(dataRequest.id, dataToCache);

      return dataToCache;
    } catch (error) {
      return Promise.reject(error);
    } finally {
      // Close SSH tunnel if it exists
      if (dbConnection && dbConnection.sshTunnel) {
        dbConnection.sshTunnel.close();
      }
    }
  }

  async runClickhouse(id, dataRequest, getCache, queryOverride = null) {
    if (getCache) {
      const drCache = await checkAndGetCache(id, dataRequest);
      if (drCache) return drCache;
    }

    try {
      const connection = await this.findById(id);
      const clickhouse = new ClickhouseConnector(connection);

      // Use the processed query if provided, otherwise use the original query
      const queryToExecute = queryOverride || dataRequest.query;
      const result = await clickhouse.query(queryToExecute);

      // cache the data for later use - use ORIGINAL dataRequest to preserve variable placeholders
      const dataToCache = {
        dataRequest,
        responseData: {
          data: result,
        },
        connection_id: id,
      };

      await drCacheController.create(dataRequest.id, dataToCache);
      return dataToCache;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async runApiRequest(id, chartId, dataRequest, getCache, filters, timezone = "", runtimeVariables = {}) {
    if (getCache) {
      const drCache = await checkAndGetCache(id, dataRequest);
      if (drCache) return drCache;
    }

    const limit = dataRequest.itemsLimit
      ? parseInt(dataRequest.itemsLimit, 10) : 0;
    const { variables } = dataRequest;

    return this.findById(id)
      .then(async (connection) => {
        // Apply variable substitution for API requests
        let processedRoute = dataRequest.route || "";
        let processedHeaders = dataRequest.headers || {};
        let processedBody = dataRequest.body || "";

        try {
          const result = applyApiVariables(dataRequest, runtimeVariables);
          processedRoute = result.processedRoute || processedRoute;
          processedHeaders = result.processedHeaders || processedHeaders;
          processedBody = result.processedBody || processedBody;
        } catch (error) {
          // If there's an error in variable processing, return it
          return Promise.reject(error);
        }

        let tempUrl = connection.getApiUrl(connection);
        let route = processedRoute;
        if (route && (route[0] !== "/" && route[0] !== "?")) {
          route = `/${route}`;
        }

        tempUrl += route;

        const queryParams = querystring.parse(tempUrl.split("?")[1]);

        // if any queryParams has variables, modify them here
        if (queryParams && Object.keys(queryParams).length > 0) {
          // first, check for the keys to avoid making an unnecessary query to the DB
          const keysFound = {};
          Object.keys(queryParams).forEach((q) => {
            const paramValue = queryParams[q];
            // Check for exact matches
            if (paramValue === "{{start_date}}") {
              keysFound[q] = { type: "startDate", format: "single" };
            } else if (paramValue === "{{end_date}}") {
              keysFound[q] = { type: "endDate", format: "single" };
            } else if (typeof paramValue === "string") {
              // Check for combined variables using regex
              const startDateMatch = paramValue.match(/{{start_date}}/);
              const endDateMatch = paramValue.match(/{{end_date}}/);
              if (startDateMatch || endDateMatch) {
                keysFound[q] = {
                  type: "combined",
                  hasStartDate: !!startDateMatch,
                  hasEndDate: !!endDateMatch,
                  originalValue: paramValue
                };
              }
            }
          });

          // something was found, go through all and replace the variables
          if (Object.keys(keysFound).length > 0) {
            const chart = await db.Chart.findByPk(chartId);
            if (chart?.startDate && chart?.endDate) {
              Object.keys(keysFound).forEach((q) => {
                const value = keysFound[q];
                let startDate = getMomentObj(timezone)(chart.startDate);
                let endDate = getMomentObj(timezone)(chart.endDate);

                if (value.type === "startDate" && chart.currentEndDate) {
                  const timeDiff = endDate.diff(startDate, chart.timeInterval);
                  endDate = getMomentObj(timezone)().endOf(chart.timeInterval);
                  if (!chart.fixedStartDate) {
                    startDate = endDate.clone()
                      .subtract(timeDiff, chart.timeInterval)
                      .startOf(chart.timeInterval);
                  }
                } else if (value.type === "endDate" && chart.currentEndDate) {
                  const timeDiff = endDate.diff(startDate, chart.timeInterval);
                  endDate = getMomentObj(timezone)().endOf(chart.timeInterval);
                  if (!chart.fixedStartDate) {
                    startDate = endDate.clone()
                      .subtract(timeDiff, chart.timeInterval)
                      .startOf(chart.timeInterval);
                  }
                }

                if (filters && filters.length > 0) {
                  const dateRangeFilter = filters.find((o) => o.type === "date");
                  if (dateRangeFilter) {
                    startDate = getMomentObj(timezone)(dateRangeFilter.startDate).startOf("day");
                    endDate = getMomentObj(timezone)(dateRangeFilter.endDate);
                  }
                }

                if (value.format === "single") {
                  if (value.type === "startDate" && startDate) {
                    queryParams[q] = startDate.format(chart.dateVarsFormat || "");
                  } else if (value.type === "endDate" && endDate) {
                    queryParams[q] = endDate.format(chart.dateVarsFormat || "");
                  }
                } else if (value.type === "combined") {
                  let formattedValue = value.originalValue;
                  if (value.hasStartDate && startDate) {
                    formattedValue = formattedValue.replace(/{{start_date}}/g, startDate.format(chart.dateVarsFormat || ""));
                  }
                  if (value.hasEndDate && endDate) {
                    formattedValue = formattedValue.replace(/{{end_date}}/g, endDate.format(chart.dateVarsFormat || ""));
                  }
                  queryParams[q] = formattedValue;
                }
              });
            } else if (variables?.startDate?.value && variables?.endDate?.value) {
              Object.keys(keysFound).forEach((q) => {
                const value = keysFound[q];
                const startDate = getMomentObj(timezone)(variables.startDate.value);
                const endDate = getMomentObj(timezone)(variables.endDate.value);

                if (value.format === "single") {
                  if (value.type === "startDate" && startDate) {
                    queryParams[q] = startDate.format(variables.dateFormat?.value || "");
                  } else if (value.type === "endDate" && endDate) {
                    queryParams[q] = endDate.format(variables.dateFormat?.value || "");
                  }
                } else if (value.type === "combined") {
                  let formattedValue = value.originalValue;
                  if (value.hasStartDate && startDate) {
                    formattedValue = formattedValue.replace(/{{start_date}}/g, startDate.format(variables.dateFormat?.value || ""));
                  }
                  if (value.hasEndDate && endDate) {
                    formattedValue = formattedValue.replace(/{{end_date}}/g, endDate.format(variables.dateFormat?.value || ""));
                  }
                  queryParams[q] = formattedValue;
                }
              });
            }
          }
        }

        let url = tempUrl;
        if (url.indexOf("?") > -1) {
          url = tempUrl.substring(0, tempUrl.indexOf("?"));
        }

        // if ant variable queryParams are left, remove them
        if (queryParams && Object.keys(queryParams).length > 0) {
          Object.keys(queryParams).forEach((q) => {
            if (queryParams[q] === "{{start_date}}" || queryParams[q] === "{{end_date}}") {
              delete queryParams[q];
            }
          });
        }

        const options = {
          url,
          method: dataRequest.method || "GET",
          headers: {},
          qs: queryParams,
          resolveWithFullResponse: true,
          simple: false,
        };

        // prepare the headers
        let headers = {};
        if (dataRequest.useGlobalHeaders) {
          const globalHeaders = connection.getHeaders(connection);
          for (const opt of globalHeaders) {
            headers = Object.assign(opt, headers);
          }

          if (processedHeaders) {
            headers = Object.assign(processedHeaders, headers);
          }
        }

        options.headers = headers;

        if (processedBody && dataRequest.method !== "GET") {
          options.body = processedBody;
          options.headers["Content-Type"] = "application/json";
        }

        // Basic auth
        if (connection.authentication && connection.authentication.type === "basic_auth") {
          options.auth = {
            user: connection.authentication.user,
            pass: connection.authentication.pass,
          };
        }

        if (dataRequest.pagination) {
          if ((options.url.indexOf(`?${dataRequest.items}=`) || options.url.indexOf(`&${dataRequest.items}=`))
            && (options.url.indexOf(`?${dataRequest.offset}=`) || options.url.indexOf(`&${dataRequest.offset}=`))
          ) {
            return paginateRequests(dataRequest.template, {
              options,
              limit,
              items: dataRequest.items,
              offset: dataRequest.offset,
              paginationField: dataRequest.paginationField,
            });
          }
        }

        return request(options);
      })
      .then(async (response) => {
        if (dataRequest.pagination) {
          // cache the data for later use
          const dataToCache = {
            dataRequest,
            responseData: {
              data: response,
            },
            connection_id: id,
          };

          await drCacheController.create(dataRequest.id, dataToCache);

          return new Promise((resolve) => resolve(dataToCache));
        }

        if (response.statusCode < 300) {
          try {
            let responseData = JSON.parse(response.body);

            // check if there are arrays to take into account
            // transform the data in 1-item array if that's the case
            // check for arrays in 3 levels
            if (determineType(responseData) === "object" && !isArrayPresent(responseData)) {
              responseData = [responseData];
            }

            // cache the data for later use
            const dataToCache = {
              dataRequest,
              responseData: {
                data: responseData,
              },
              connection_id: id,
            };

            await drCacheController.create(dataRequest.id, dataToCache);

            return new Promise((resolve) => resolve(dataToCache));
          } catch (e) {
            return new Promise((resolve, reject) => reject(400));
          }
        } else {
          return new Promise((resolve, reject) => reject(response.statusCode));
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async runFirestore(id, dataRequest, getCache, runtimeVariables = {}) {
    if (getCache) {
      const drCache = await checkAndGetCache(id, dataRequest);
      if (drCache) return drCache;
    }

    return this.findById(id)
      .then((connection) => {
        const firestoreConnection = new FirestoreConnection(connection);

        // Apply variable substitution using the centralized function
        let processedDataRequest = dataRequest;
        if (dataRequest.VariableBindings && dataRequest.VariableBindings.length > 0) {
          try {
            // Add connection info to dataRequest for applyVariables to work
            const dataRequestWithConnection = {
              ...JSON.parse(JSON.stringify(dataRequest)),
              Connection: connection,
            };
            const result = applyVariables(dataRequestWithConnection, runtimeVariables);
            processedDataRequest = result.processedDataRequest;
          } catch (error) {
            // If there's an error in variable processing, return it
            return Promise.reject(error);
          }
        }

        return firestoreConnection.get(processedDataRequest);
      })
      .then(async (responseData) => {
        // cache the data for later use - use ORIGINAL dataRequest to preserve variable placeholders
        const dataToCache = {
          dataRequest,
          responseData,
          connection_id: id,
        };

        await drCacheController.create(dataRequest.id, dataToCache);

        return dataToCache;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  async runRealtimeDb(id, dataRequest, getCache) {
    if (getCache) {
      const drCache = await checkAndGetCache(id, dataRequest);
      if (drCache) return drCache;
    }

    return this.findById(id)
      .then((connection) => {
        const realtimeDatabase = new RealtimeDatabase(connection);

        return realtimeDatabase.getData(dataRequest);
      })
      .then(async (responseData) => {
        // cache the data for later use
        const dataToCache = {
          dataRequest,
          responseData: {
            data: responseData,
          },
          connection_id: id,
        };

        await drCacheController.create(dataRequest.id, dataToCache);

        return dataToCache;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  async runGoogleAnalytics(conn, dataRequest, getCache) {
    let connection = conn;
    if (connection.id) {
      try {
        connection = await this.findById(connection.id);
      } catch (e) {
        connection = conn;
      }
    }

    if (getCache) {
      const drCache = await checkAndGetCache(connection.id, dataRequest);
      if (drCache) return drCache;
    }

    if (!connection.oauth_id) return Promise.reject({ error: "No oauth token" });

    const oauth = await oauthController.findById(connection.oauth_id);
    return googleConnector.getAnalytics(oauth, dataRequest)
      .then(async (responseData) => {
        // cache the data for later use
        const dataToCache = {
          dataRequest,
          responseData: {
            data: responseData,
          },
          connection_id: connection.id,
        };

        await drCacheController.create(dataRequest.id, dataToCache);

        return dataToCache;
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  async testGoogleAnalytics(connection) {
    if (!connection.oauth_id) return Promise.reject({ error: "No oauth token" });

    const oauth = await oauthController.findById(connection.oauth_id);
    return googleConnector.getAccounts(oauth.refreshToken, connection.oauth_id);
  }

  async runCustomerio(conn, dataRequest, getCache) {
    let connection = conn;
    if (getCache) {
      const drCache = await checkAndGetCache(conn.id, dataRequest);
      if (drCache) return drCache;
    }

    if (conn.id) {
      try {
        connection = await this.findById(conn.id);
      } catch (e) {
        connection = conn;
      }
    }

    let cioRoute = "customers";
    if (dataRequest?.route?.indexOf("campaigns") === 0) {
      cioRoute = "campaigns";
    } else if (dataRequest?.route?.indexOf("activities") === 0) {
      cioRoute = "activities";
    }

    if (cioRoute === "customers") {
      return CustomerioConnection.getCustomers(connection, dataRequest)
        .then(async (responseData) => {
          // cache the data for later use
          const dataToCache = {
            dataRequest,
            responseData: {
              data: responseData,
            },
            connection_id: connection.id,
          };

          await drCacheController.create(dataRequest.id, dataToCache);

          return dataToCache;
        })
        .catch((err) => {
          return new Promise((resolve, reject) => reject(err));
        });
    } else if (cioRoute === "campaigns") {
      return CustomerioConnection.getCampaignMetrics(connection, dataRequest)
        .then(async (responseData) => {
          // cache the data for later use
          const dataToCache = {
            dataRequest,
            responseData: {
              data: responseData,
            },
            connection_id: connection.id,
          };

          await drCacheController.create(dataRequest.id, dataToCache);

          return dataToCache;
        })
        .catch((err) => {
          return new Promise((resolve, reject) => reject(err));
        });
    } else if (cioRoute === "activities") {
      return CustomerioConnection.getActivities(connection, dataRequest)
        .then(async (responseData) => {
          // cache the data for later use
          const dataToCache = {
            dataRequest,
            responseData: {
              data: responseData,
            },
            connection_id: connection.id,
          };

          await drCacheController.create(dataRequest.id, dataToCache);

          return dataToCache;
        })
        .catch((err) => {
          return new Promise((resolve, reject) => reject(err));
        });
    }

    return new Promise((resolve, reject) => reject(404));
  }

  async testCustomerio(connection) {
    const options = CustomerioConnection
      .getConnectionOpt(connection, {
        method: "GET",
        route: "activities"
      });
    options.json = true;

    return request(options);
  }

  runHelperMethod(connectionId, method, body) {
    return this.findById(connectionId)
      .then((connection) => {
        if (connection.type === "customerio") {
          return CustomerioConnection[method](connection, body);
        }

        return Promise.reject("Method not found");
      })
      .catch((err) => {
        return err;
      });
  }

  async duplicateConnection(connectionId, name) {
    const connection = await db.Connection.findByPk(connectionId);
    const connectionToSave = connection.toJSON();
    delete connectionToSave.id;
    delete connectionToSave.createdAt;
    delete connectionToSave.updatedAt;

    if (name) {
      connectionToSave.name = name;
    }

    const newConnection = await db.Connection.create(connectionToSave);
    return newConnection;
  }

  async addMongoSchemaUpdateJob(connectionId) {
    try {
      const connection = await this.findById(connectionId);

      if (!connection) {
        return Promise.reject(new Error("Connection not found"));
      }

      if (connection.type !== "mongodb") {
        return Promise.reject(new Error("Connection is not a MongoDB connection"));
      }

      // Get the queue from the global scope
      const queue = new Queue("updateMongoDBSchemaQueue", getQueueOptions());

      // Add a job to update the schema
      const job = await queue.add(`update-mongo-schema-${connectionId}`, { connection_id: connectionId }, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      });

      // Wait for job to complete
      const result = await job.waitUntilFinished(queue);

      return result;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async updateMongoSchema(connectionId) {
    await updateMongoSchema({
      data: {
        connection_id: connectionId,
      },
    });

    return this.findById(connectionId);
  }
}

module.exports = ConnectionController;
