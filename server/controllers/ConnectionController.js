const mongoose = require("mongoose");
const requestP = require("request-promise");
const Sequelize = require("sequelize");
const querystring = require("querystring");
const moment = require("moment");

const db = require("../models/models");
const ProjectController = require("./ProjectController");
const externalDbConnection = require("../modules/externalDbConnection");
const assembleMongoUrl = require("../modules/assembleMongoUrl");
const paginateRequests = require("../modules/paginateRequests");
const firebaseConnector = require("../modules/firebaseConnector");

const FirestoreConnection = require("../connections/FirestoreConnection");

class ConnectionController {
  constructor() {
    this.projectController = new ProjectController();
  }

  findAll() {
    return db.Connection.findAll({
      attributes: { exclude: ["dbName", "password", "username", "options", "port", "host"] },
    })
      .then((connections) => {
        return Promise.resolve(connections);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  findById(id) {
    return db.Connection.findByPk(id)
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

  findByProject(projectId) {
    return db.Connection.findAll({
      where: { project_id: projectId },
      attributes: { exclude: ["password"] },
    })
      .then((connections) => {
        return connections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  create(data) {
    if (!data.type) data.type = "mongodb"; // eslint-disable-line
    return db.Connection.create(data)
      .then((connection) => {
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

  removeConnection(id) {
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

  testRequest(data) {
    if (data.type === "api") {
      return this.testApi(data);
    } else if (data.type === "mongodb") {
      return this.testMongo(data);
    } else if (data.type === "mysql" || data.type === "postgres") {
      return this.testMysql(data);
    } else if (data.type === "firebase") {
      return this.testFirebase(data);
    } else if (data.type === "firestore") {
      return this.testFirestore(data);
    }

    return new Promise((resolve, reject) => reject(new Error("No request type specified")));
  }

  testApi(data) {
    const testOpt = this.getApiTestOptions(data);

    return requestP(testOpt);
  }

  testMongo(data) {
    const mongoString = assembleMongoUrl(data);

    return mongoose.connect(mongoString, { useNewUrlParser: true, useUnifiedTopology: true })
      .then((connection) => {
        return connection.connection.db.listCollections().toArray();
      })
      .then((collections) => {
        return Promise.resolve({
          success: true,
          collections
        });
      })
      .catch((err) => Promise.reject(err.message || err));
  }

  testMysql(data) {
    return externalDbConnection(data)
      .then((sequelize) => {
        return sequelize.getQueryInterface().showAllSchemas();
      })
      .then((tables) => {
        return Promise.resolve({
          success: true,
          tables,
        });
      })
      .catch((err) => Promise.reject(err.message || err));
  }

  testFirebase(data) {
    const parsedData = data;
    try {
      parsedData.firebaseServiceAccount = JSON.parse(data.firebaseServiceAccount);
    } catch (e) {
      return Promise.reject("The authentication JSON is not formatted correctly.");
    }

    return firebaseConnector.getAuthToken(parsedData)
      .then(() => {
        return Promise.resolve("The Firebase gods granted us access. The connection was successful 🙌");
      })
      .catch((err) => {
        return Promise.reject(err.message || err);
      });
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
    return db.Connection.findByPk(id)
      .then((connection) => {
        gConnection = connection;
        if (connection.type === "mongodb") {
          return this.getConnectionUrl(id);
        } else if (connection.type === "api") {
          return requestP(this.getApiTestOptions(connection));
        } else if (connection.type === "postgres" || connection.type === "mysql") {
          return externalDbConnection(connection);
        } else if (connection.type === "firebase" || connection.type === "firestore") {
          return firebaseConnector.getAuthToken(connection);
        } else {
          return new Promise((resolve, reject) => reject(new Error(400)));
        }
      })
      .then((response) => {
        if (gConnection.type === "mongodb") {
          return mongoose.connect(response);
        } else if (gConnection.type === "api" && response.statusCode < 300) {
          return new Promise((resolve) => resolve({ success: true }));
        } else if (gConnection.type === "postgres" || gConnection.type === "mysql") {
          return new Promise((resolve) => resolve({ success: true }));
        } else if (gConnection.type === "firebase" || gConnection.type === "firestore") {
          return new Promise((resolve) => resolve(response));
        } else {
          return new Promise((resolve, reject) => reject(new Error(400)));
        }
      })
      .then(() => {
        return new Promise((resolve) => resolve({ success: true }));
      })
      .catch((err) => {
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

        return requestP(options);
      })
      .then((response) => {
        if (pagination) {
          return new Promise((resolve) => resolve(response));
        }

        if (response.statusCode < 300) {
          try {
            return new Promise((resolve) => resolve(JSON.parse(response.body)));
          } catch (e) {
            return new Promise((resolve, reject) => reject(406));
          }
        } else {
          return new Promise((resolve, reject) => reject(response.statusCode));
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runMongo(id, dataRequest) {
    return this.getConnectionUrl(id)
      .then((url) => {
        const options = {
          keepAlive: 1,
          connectTimeoutMS: 30000,
        };
        return mongoose.connect(url, options);
      })
      .then(() => {
        return Function(`'use strict';return (mongoose) => mongoose.${dataRequest.query}.toArray()`)()(mongoose); // eslint-disable-line
      })
      // if array fails, check if it works with object (for example .findOne() return object)
      .catch(() => {
        return Function(`'use strict';return (mongoose) => mongoose.${dataRequest.query}`)()(mongoose); // eslint-disable-line
      })
      .then((data) => {
        return Promise.resolve(data);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runMysqlOrPostgres(id, dataRequest) {
    return this.findById(id)
      .then((connection) => {
        return externalDbConnection(connection);
      })
      .then((dbConnection) => {
        return dbConnection.query(dataRequest.query, { type: Sequelize.QueryTypes.SELECT });
      })
      .then((results) => {
        return new Promise((resolve) => resolve(results));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runApiRequest(id, chartId, dataRequest) {
    const limit = dataRequest.itemsLimit
      ? parseInt(dataRequest.itemsLimit, 10) : 0;
    return this.findById(id)
      .then(async (connection) => {
        const tempUrl = `${connection.getApiUrl(connection)}${dataRequest.route || ""}`;
        const queryParams = querystring.parse(tempUrl.split("?")[1]);

        // if any queryParams has variables, modify them here
        if (queryParams && Object.keys(queryParams).length > 0) {
          // first, check for the keys to avoid making an unnecessary query to the DB
          const keysFound = {};
          Object.keys(queryParams).forEach((q) => {
            if (queryParams[q] === "{{start_date}}") keysFound[q] = "startDate";
            if (queryParams[q] === "{{end_date}}") keysFound[q] = "endDate";
          });

          // something was found, go through all and replace the variables
          if (Object.keys(keysFound).length > 0) {
            const chart = await db.Chart.findByPk(chartId);
            if (chart.startDate && chart.endDate) {
              Object.keys(keysFound).forEach((q) => {
                const value = keysFound[q];
                let startDate = moment(chart.startDate);
                let endDate = moment(chart.endDate);

                if (value === "startDate" && chart.currentEndDate) {
                  const timeDiff = endDate.diff(startDate, "days");
                  endDate = moment().endOf("day");
                  startDate = endDate.clone().subtract(timeDiff, "days").startOf("day");
                  queryParams[q] = startDate.format();
                } else if (value === "endDate" && chart.currentEndDate) {
                  const timeDiff = endDate.diff(startDate, "days");
                  endDate = moment().endOf("day");
                  startDate = endDate.clone().subtract(timeDiff, "days").startOf("day");
                  queryParams[q] = endDate.format();
                } else {
                  queryParams[q] = chart[value];
                }
              });
            }
          }
        }

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

        return requestP(options);
      })
      .then((response) => {
        if (dataRequest.pagination) {
          return new Promise((resolve) => resolve(response));
        }

        if (response.statusCode < 300) {
          try {
            return new Promise((resolve) => resolve(JSON.parse(response.body)));
          } catch (e) {
            return new Promise((resolve, reject) => reject(406));
          }
        } else {
          return new Promise((resolve, reject) => reject(response.statusCode));
        }
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  runFirestore(id, dataRequest) {
    return this.findById(id)
      .then((connection) => {
        const firestoreConnection = new FirestoreConnection(connection);

        return firestoreConnection.get(dataRequest);
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }
}

module.exports = ConnectionController;
