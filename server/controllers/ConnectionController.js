const mongoose = require("mongoose");
const requestP = require("request-promise");

const Connection = require("../models/Connection");
const ProjectController = require("./ProjectController");
const externalDbConnection = require("../modules/externalDbConnection");

class ConnectionController {
  constructor() {
    this.connection = Connection;
    this.projectController = new ProjectController();
  }

  findById(id) {
    return this.connection.findByPk(id)
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
    return this.connection.findAll({
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
    return this.connection.create(data)
      .then((connection) => {
        return connection;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    return this.connection.update(data, { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getConnectionUrl(id) {
    return this.connection.findByPk(id)
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
    return this.connection.destroy({ where: { id } })
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
    return this.connection.findByPk(id)
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

  testApiRequest(connectionId, apiRequest) {
    return this.findById(connectionId)
      .then((connection) => {
        const options = {
          url: `${connection.getApiUrl(connection)}${apiRequest.route || ""}`,
          method: apiRequest.method || "GET",
          headers: {},
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

        return requestP(options);
      })
      .then((response) => {
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
