const mongoose = require("mongoose");
const requestP = require("request-promise");
const querystring = require("querystring");
const _ = require("lodash");

const db = require("../models/models");
const ProjectController = require("./ProjectController");
const externalDbConnection = require("../modules/externalDbConnection");

/*
** Helper functions
*/

function paginateRequests(options, limit, items, offset, totalResults) {
  return requestP(options)
    .then((response) => {
      responseCode = response.responseCode; // eslint-disable-line
      let results;
      try {
        const parsedResponse = JSON.parse(response.body);

        if (parsedResponse instanceof Array) {
          results = parsedResponse;
        } else {
          Object.keys(parsedResponse).forEach((key) => {
            if (parsedResponse[key] instanceof Array) {
              results = parsedResponse[key];
            }
          });
        }
      } catch (error) {
        return new Promise((resolve, reject) => reject(response.statusCode));
      }

      // check if results are the same as previous ones (infinite request loop?)
      let skipping = false;

      if (_.isEqual(results, totalResults)) {
        skipping = true;
      }

      const tempResults = totalResults.concat(results);

      if (skipping || results.length === 0 || (tempResults.length >= limit && limit !== 0)) {
        let finalResults = skipping ? results : tempResults;

        // check if it goes above the limit
        if (tempResults.length > limit && limit !== 0) {
          finalResults = tempResults.slice(0, limit);
        }

        return new Promise(resolve => resolve(finalResults));
      }

      const newOptions = options;
      newOptions.qs[offset] =
        parseInt(options.qs[offset], 10) + parseInt(options.qs[items], 10);

      return paginateRequests(newOptions, limit, items, offset, tempResults);
    })
    .catch((e) => {
      return Promise.reject(e);
    });
}

// ----------------

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
          return connection.getMongoConnectionUrl(connection);
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

    const globalHeaders = connection.getHeaders(connection);
    if (globalHeaders && globalHeaders.length > 0) {
      for (const option of connection.options) {
        testOptions.headers[Object.keys(option)[0]] = option[Object.keys(option)[0]];
      }
    }

    return testOptions;
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
        } else {
          throw new Error(400);
        }
      })
      .then((response) => {
        if (gConnection.type === "mongodb") {
          return mongoose.connect(response);
        } else if (gConnection.type === "api" && response.statusCode < 300) {
          return new Promise(resolve => resolve({ success: true }));
        } else if (gConnection.type === "postgres" || gConnection.type === "mysql") {
          return new Promise(resolve => resolve({ success: true }));
        } else {
          throw new Error(400);
        }
      })
      .then(() => {
        return new Promise(resolve => resolve({ success: true }));
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  testApiRequest({
    connection_id, apiRequest, itemsLimit, items, offset, pagination,
  }) {
    const limit = itemsLimit
      ? parseInt(itemsLimit, 10) : 0;

    return this.findById(connection_id)
      .then((connection) => {
        const tempUrl = `${connection.getApiUrl(connection)}${apiRequest.route || ""}`;
        const queryParams = querystring.parse(tempUrl.split("?")[1]);

        let url = tempUrl;
        if (url.indexOf("?") > -1) {
          url = tempUrl.substring(0, tempUrl.indexOf("?"));
        }

        const options = {
          url,
          method: apiRequest.method || "GET",
          headers: {},
          qs: queryParams,
          resolveWithFullResponse: true,
          simple: false,
        };

        // prepare the headers
        let headers = {};
        if (apiRequest.useGlobalHeaders) {
          const globalHeaders = connection.getHeaders(connection);
          for (const opt of globalHeaders) {
            headers = Object.assign(opt, headers);
          }

          if (apiRequest.headers) {
            headers = Object.assign(apiRequest.headers, headers);
          }
        }

        options.headers = headers;

        if (apiRequest.body && apiRequest.method !== "GET") {
          options.body = apiRequest.body;
        }

        if (pagination) {
          if ((options.url.indexOf(`?${items}=`) || options.url.indexOf(`&${items}=`))
            && (options.url.indexOf(`?${offset}=`) || options.url.indexOf(`&${offset}=`))
          ) {
            return paginateRequests(options, limit, items, offset, []);
          }
        }

        return requestP(options);
      })
      .then((response) => {
        if (pagination) {
          return new Promise(resolve => resolve(response));
        }

        if (response.statusCode < 300) {
          try {
            return new Promise(resolve => resolve(JSON.parse(response.body)));
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
}

module.exports = ConnectionController;
