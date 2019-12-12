const ApiRequest = require("../models/ApiRequest");
const ConnectionController = require("./ConnectionController");
const Chart = require("../models/Chart");

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

  sendRequest(chartId) {
    let gApiRequest;
    return this.findByChart(chartId)
      .then((apiRequest) => {
        if (!apiRequest) throw new Error(404);
        gApiRequest = JSON.parse(JSON.stringify(apiRequest));

        return Chart.findByPk(chartId);
      })
      .then((chart) => {
        const jsChart = chart.get({ plain: true });
        return this.connectionController.testApiRequest({ ...jsChart, apiRequest: gApiRequest });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }
}

module.exports = ApiRequestController;
