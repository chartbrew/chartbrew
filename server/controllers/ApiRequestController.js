const ConnectionController = require("./ConnectionController");
const db = require("../models/models");

class ApiRequestController {
  constructor() {
    this.connectionController = new ConnectionController();
  }

  create(data) {
    return db.ApiRequest.findOne({
      where: { chart_id: data.chart_id },
    })
      .then((apiRequest) => {
        if (apiRequest) return this.update(apiRequest.id, data);

        return db.ApiRequest.create(data);
      })
      .then((apiRequest) => {
        return db.ApiRequest.findByPk(apiRequest.id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findById(id) {
    return db.ApiRequest.findByPk(id)
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
    return db.ApiRequest.findOne({ where: { chart_id: chartId } })
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
    return db.ApiRequest.update(data, {
      where: { id },
    })
      .then(() => {
        return db.ApiRequest.findByPk(id);
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

        return db.Chart.findByPk(chartId);
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
