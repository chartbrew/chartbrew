const requestP = require("request-promise");

const ApiRequest = require("../models/ApiRequest");
const ConnectionController = require("./ConnectionController");

class ApiRequestController {
  constructor() {
    this.apiRequest = ApiRequest;
    this.connectionController = new ConnectionController();
  }

  create(data) {
    return this.apiRequest.create(data)
      .then((apiRequest) => {
        return this.apiRequest.findByPk(apiRequest.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findById(id) {
    return this.apiRequest.findByPk(id)
      .then((apiRequest) => {
        if (!apiRequest) {
          throw new Error(404);
        }
        return new Promise(resolve => resolve(apiRequest));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByChart(chartId) {
    return this.apiRequest.findOne({ where: { chart_id: chartId } })
      .then((apiRequest) => {
        if (!apiRequest) {
          throw new Error(404);
        }
        return new Promise(resolve => resolve(apiRequest));
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    return this.apiRequest.update(data, {
      where: { id },
    })
      .then(() => {
        return this.apiRequest.findByPk(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  sendRequest(chartId, connectionId) {
    let gApiRequest;
    return this.findByChart(chartId)
      .then((apiRequest) => {
        if (!apiRequest) throw new Error(404);
        gApiRequest = JSON.parse(JSON.stringify(apiRequest));
        return this.connectionController.findById(connectionId);
      })
      .then((connection) => {
        if (gApiRequest.useGlobalHeaders) {
          const globalHeaders = connection.getHeaders(connection);
          for (const header of globalHeaders) {
            gApiRequest.headers = Object.assign(header, gApiRequest.headers);
          }
        }

        const options = {
          url: `${connection.getApiUrl(connection)}${gApiRequest.route}`,
          method: gApiRequest.method,
          headers: {},
          resolveWithFullResponse: true,
          simple: false,
        };

        // prepare the headers
        let headers = {};
        if (gApiRequest.useGlobalHeaders) {
          const globalHeaders = connection.getHeaders(connection);
          for (const opt of globalHeaders) {
            headers = Object.assign(opt, headers);
          }
        }
        if (gApiRequest.headers) {
          headers = Object.assign(gApiRequest.headers, headers);
        }
        options.headers = headers;

        if (gApiRequest.body) {
          options.body = JSON.stringify(gApiRequest.body);
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

module.exports = ApiRequestController;
